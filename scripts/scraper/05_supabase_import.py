"""
Import merged venue CSV into Supabase.

Reads data/merged_istanbul_venues.csv and upserts into the public.venues table
via the Supabase REST API.

Idempotent: skips venues whose osm_id, overture_id, or fsq_id already exist.
Re-runnable without creating duplicates.

Usage:
    python 05_supabase_import.py
    python 05_supabase_import.py --dry-run        # preview without inserting
    python 05_supabase_import.py --limit 100       # import only first N rows
"""

import csv
import json
import os
import sys
import time
from pathlib import Path

import requests

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).parent
DATA_DIR = SCRIPT_DIR / "data"
CSV_FILE = DATA_DIR / "merged_istanbul_venues.csv"
PROJECT_ROOT = SCRIPT_DIR.parent.parent  # ogrenci_nerede_yer/

# ---------------------------------------------------------------------------
# Supabase credentials (env -> expo env -> .env file)
# ---------------------------------------------------------------------------


def _load_dotenv(path: Path) -> dict[str, str]:
    """Minimal .env parser -- no external dependency needed."""
    env = {}
    if not path.exists():
        return env
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            env[key.strip()] = value.strip()
    return env


def get_supabase_config() -> tuple[str, str]:
    """Return (url, service_role_key) from environment or .env file.

    IMPORTANT: The import script MUST use the service role key (not anon key)
    because scraped venues have created_by=NULL, and the RLS INSERT policy
    requires auth.uid() = created_by. The service role key bypasses RLS.
    """
    dotenv = _load_dotenv(PROJECT_ROOT / ".env")

    url = (
        os.environ.get("SUPABASE_URL")
        or os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
        or dotenv.get("SUPABASE_URL")
        or dotenv.get("EXPO_PUBLIC_SUPABASE_URL")
    )

    # Prefer service role key (bypasses RLS) over anon key
    key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or dotenv.get("SUPABASE_SERVICE_ROLE_KEY")
    )

    if not url:
        print("ERROR: Supabase URL not found.")
        print("Set SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL in env or .env file.")
        sys.exit(1)

    if not key:
        print("ERROR: Service role key not found.")
        print("The import script requires the SERVICE ROLE KEY (not anon key)")
        print("because scraped venues bypass RLS INSERT policies.")
        print("")
        print("Set SUPABASE_SERVICE_ROLE_KEY in your environment or .env file.")
        print("Find it at: https://supabase.com/dashboard/project/fcuwuokxtptshksjvles/settings/api")
        sys.exit(1)

    return url, key


# ---------------------------------------------------------------------------
# Cuisine -> tags mapping
# ---------------------------------------------------------------------------

# The app's VENUE_TAGS keys (from src/lib/constants.ts):
#   ev-yemegi, fast-food, kahvalti, cay, doner, tost, vejetaryen,
#   wifi, ogrenci-menu, tatli, kofte, pide

CUISINE_TAG_MAP: dict[str, list[str]] = {
    # Kebab / doner family
    "kebab": ["doner"],
    "kebap": ["doner"],
    "doner": ["doner"],
    "döner": ["doner"],
    "adana": ["doner"],
    "iskender": ["doner"],
    "lahmacun": ["pide"],
    "pide": ["pide"],
    # Kofte
    "kofte": ["kofte"],
    "köfte": ["kofte"],
    "meatball": ["kofte"],
    # Fast food
    "fast_food": ["fast-food"],
    "fast-food": ["fast-food"],
    "burger": ["fast-food"],
    "hamburger": ["fast-food"],
    "pizza": ["fast-food"],
    "fried_chicken": ["fast-food"],
    # Breakfast
    "breakfast": ["kahvalti"],
    "kahvalti": ["kahvalti"],
    "kahvaltı": ["kahvalti"],
    "brunch": ["kahvalti"],
    # Sandwich / toast
    "sandwich": ["tost"],
    "tost": ["tost"],
    "toast": ["tost"],
    "dürüm": ["tost"],
    "durum": ["tost"],
    "wrap": ["tost"],
    # Home cooking / Turkish
    "turkish": ["ev-yemegi"],
    "ev_yemegi": ["ev-yemegi"],
    "home_cooking": ["ev-yemegi"],
    "lokanta": ["ev-yemegi"],
    # Dessert
    "dessert": ["tatli"],
    "pastry": ["tatli"],
    "bakery": ["tatli"],
    "baklava": ["tatli"],
    "kunefe": ["tatli"],
    "ice_cream": ["tatli"],
    "pastane": ["tatli"],
    # Tea/coffee
    "cafe": ["cay"],
    "coffee": ["cay"],
    "tea": ["cay"],
    "tea_house": ["cay"],
    "cay": ["cay"],
    # Vegetarian
    "vegetarian": ["vejetaryen"],
    "vegan": ["vejetaryen"],
    # Seafood (no specific tag, skip)
    # Regional / international (no specific tag, skip)
}

# Category keywords from the categories column that also map to tags
CATEGORY_TAG_MAP: dict[str, list[str]] = {
    "fast_food": ["fast-food"],
    "fast_food_restaurant": ["fast-food"],
    "burger_restaurant": ["fast-food"],
    "pizza_restaurant": ["fast-food"],
    "kebab_restaurant": ["doner"],
    "doner_kebab": ["doner"],
    "breakfast_and_brunch_restaurant": ["kahvalti"],
    "cafe": ["cay"],
    "coffee_shop": ["cay"],
    "tea_room": ["cay"],
    "bakery": ["tatli"],
    "dessert_shop": ["tatli"],
    "ice_cream_shop": ["tatli"],
    "sandwich_shop": ["tost"],
    "vegetarian_restaurant": ["vejetaryen"],
    "vegan_restaurant": ["vejetaryen"],
    "seafood_restaurant": [],
    "steakhouse": [],
    "diner": ["ev-yemegi"],
    "restaurant": [],
}


def cuisine_to_tags(cuisine: str, categories: str) -> list[str]:
    """Map cuisine and category strings to app tag keys."""
    tags: set[str] = set()

    # Process cuisine field
    if cuisine:
        for part in cuisine.lower().replace(",", ";").split(";"):
            part = part.strip().replace(" ", "_")
            if part in CUISINE_TAG_MAP:
                tags.update(CUISINE_TAG_MAP[part])

    # Process categories field
    if categories:
        for part in categories.lower().replace(",", ";").split(";"):
            part = part.strip().replace(" ", "_")
            if part in CATEGORY_TAG_MAP:
                tags.update(CATEGORY_TAG_MAP[part])

    return sorted(tags)


# ---------------------------------------------------------------------------
# CSV -> venue row mapping
# ---------------------------------------------------------------------------


def csv_row_to_venue(row: dict) -> dict:
    """Convert a merged CSV row to a Supabase venues table row."""
    address = (row.get("address") or "").strip()
    if not address:
        address = "Istanbul"

    tags = cuisine_to_tags(row.get("cuisine", ""), row.get("categories", ""))

    venue = {
        "name": row["name"],
        "latitude": float(row["latitude"]),
        "longitude": float(row["longitude"]),
        "address": address,
        "phone": row.get("phone") or None,
        "price_range": 1,
        "is_verified": False,
        "avg_taste_rating": 0,
        "avg_value_rating": 0,
        "avg_friendliness_rating": 0,
        "overall_rating": 0,
        "total_reviews": 0,
        "level": 1,
        "tags": tags,
        "source": "scraped",
        "osm_id": row.get("osm_id") or None,
        "overture_id": row.get("overture_id") or None,
        "fsq_id": row.get("fsq_id") or None,
        "cuisine": row.get("cuisine") or None,
    }

    return venue


# ---------------------------------------------------------------------------
# Supabase REST API helpers
# ---------------------------------------------------------------------------


def make_headers(api_key: str, prefer: str = "return=minimal") -> dict[str, str]:
    return {
        "apikey": api_key,
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Prefer": prefer,
    }


def fetch_existing_ids(base_url: str, api_key: str) -> tuple[set[str], set[str], set[str]]:
    """Fetch all existing osm_id, overture_id, and fsq_id values from Supabase.

    Uses pagination (1000 rows at a time) to handle large tables.
    Returns three sets of existing IDs.
    """
    osm_ids: set[str] = set()
    overture_ids: set[str] = set()
    fsq_ids: set[str] = set()

    headers = make_headers(api_key, prefer="return=representation")
    # We only need the three ID columns to save bandwidth
    url = f"{base_url}/rest/v1/venues"
    params = {
        "select": "osm_id,overture_id,fsq_id",
        "source": "eq.scraped",
        "limit": 1000,
        "offset": 0,
    }

    print("  Fetching existing venue IDs from Supabase...")
    total_fetched = 0

    while True:
        resp = requests.get(url, headers=headers, params=params, timeout=30)
        if resp.status_code != 200:
            print(f"  WARNING: Failed to fetch existing IDs (HTTP {resp.status_code})")
            print(f"  Response: {resp.text[:500]}")
            break

        rows = resp.json()
        if not rows:
            break

        for r in rows:
            if r.get("osm_id"):
                osm_ids.add(r["osm_id"])
            if r.get("overture_id"):
                overture_ids.add(r["overture_id"])
            if r.get("fsq_id"):
                fsq_ids.add(r["fsq_id"])

        total_fetched += len(rows)
        if len(rows) < 1000:
            break
        params["offset"] += 1000

    print(f"  Found {total_fetched} existing scraped venues "
          f"({len(osm_ids)} osm, {len(overture_ids)} overture, {len(fsq_ids)} fsq)")

    return osm_ids, overture_ids, fsq_ids


def is_duplicate(row: dict, existing_osm: set, existing_overture: set, existing_fsq: set) -> bool:
    """Check if a venue already exists based on source IDs."""
    osm = row.get("osm_id") or ""
    overture = row.get("overture_id") or ""
    fsq = row.get("fsq_id") or ""

    if osm and osm in existing_osm:
        return True
    if overture and overture in existing_overture:
        return True
    if fsq and fsq in existing_fsq:
        return True

    return False


def insert_batch(
    base_url: str,
    api_key: str,
    batch: list[dict],
    batch_num: int,
) -> tuple[int, int]:
    """Insert a batch of venues. Returns (success_count, fail_count)."""
    url = f"{base_url}/rest/v1/venues"
    headers = make_headers(api_key, prefer="return=minimal,resolution=ignore-duplicates")

    try:
        resp = requests.post(
            url,
            headers=headers,
            data=json.dumps(batch, ensure_ascii=False),
            timeout=60,
        )
        if resp.status_code in (200, 201):
            return len(batch), 0
        else:
            print(f"  ERROR batch {batch_num}: HTTP {resp.status_code}")
            error_text = resp.text[:500]
            print(f"  Response: {error_text}")

            # If the full batch fails, try inserting one by one to salvage what we can
            if len(batch) > 1:
                return _insert_individually(base_url, api_key, batch, batch_num)
            return 0, len(batch)

    except requests.exceptions.RequestException as e:
        print(f"  ERROR batch {batch_num}: {e}")
        return 0, len(batch)


def _insert_individually(
    base_url: str,
    api_key: str,
    batch: list[dict],
    batch_num: int,
) -> tuple[int, int]:
    """Fallback: insert venues one by one when a batch fails."""
    url = f"{base_url}/rest/v1/venues"
    headers = make_headers(api_key, prefer="return=minimal,resolution=ignore-duplicates")
    success = 0
    fail = 0

    for venue in batch:
        try:
            resp = requests.post(
                url,
                headers=headers,
                data=json.dumps(venue, ensure_ascii=False),
                timeout=15,
            )
            if resp.status_code in (200, 201):
                success += 1
            else:
                fail += 1
                # Only log first few individual failures to avoid spam
                if fail <= 3:
                    print(f"    Individual insert failed ({resp.status_code}): "
                          f"{venue['name'][:40]} -- {resp.text[:200]}")
        except requests.exceptions.RequestException:
            fail += 1

    print(f"  Batch {batch_num} fallback: {success} ok, {fail} failed (of {len(batch)})")
    return success, fail


# ---------------------------------------------------------------------------
# Main import
# ---------------------------------------------------------------------------


def run(dry_run: bool = False, limit: int | None = None):
    if not CSV_FILE.exists():
        print(f"ERROR: Input file not found: {CSV_FILE}")
        print("Run 04_merge_dedup.py first.")
        sys.exit(1)

    supabase_url, supabase_key = get_supabase_config()
    print(f"Supabase URL: {supabase_url}")
    print(f"Input file:   {CSV_FILE}")

    # ---- Read CSV ----
    print("\nReading CSV...")
    csv_rows: list[dict] = []
    with open(CSV_FILE, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            csv_rows.append(row)
            if limit and len(csv_rows) >= limit:
                break

    print(f"  Read {len(csv_rows)} rows from CSV" + (f" (limited to {limit})" if limit else ""))

    # ---- Convert to venue dicts ----
    venues = []
    conversion_errors = 0
    for i, row in enumerate(csv_rows):
        try:
            venue = csv_row_to_venue(row)
            venues.append(venue)
        except (ValueError, KeyError) as e:
            conversion_errors += 1
            if conversion_errors <= 5:
                print(f"  WARNING: Row {i + 1} conversion error: {e}")

    if conversion_errors:
        print(f"  Skipped {conversion_errors} rows due to conversion errors")
    print(f"  Converted {len(venues)} venues")

    # ---- Tag stats ----
    tag_counts: dict[str, int] = {}
    tagged = 0
    for v in venues:
        if v["tags"]:
            tagged += 1
        for t in v["tags"]:
            tag_counts[t] = tag_counts.get(t, 0) + 1
    print(f"\n  Tag coverage: {tagged}/{len(venues)} venues ({100 * tagged / len(venues):.1f}%)")
    if tag_counts:
        print("  Tag distribution:")
        for tag, count in sorted(tag_counts.items(), key=lambda x: -x[1]):
            print(f"    {tag}: {count}")

    if dry_run:
        print("\n--- DRY RUN: No data will be inserted ---")
        print(f"Would insert up to {len(venues)} venues")
        # Show a few sample rows
        print("\nSample venues (first 3):")
        for v in venues[:3]:
            print(f"  {v['name'][:50]}: ({v['latitude']:.4f}, {v['longitude']:.4f}) "
                  f"tags={v['tags']} source_ids=[osm={v['osm_id']}, "
                  f"overture={v['overture_id']}, fsq={v['fsq_id']}]")
        return

    # ---- Check existing IDs for idempotency ----
    existing_osm, existing_overture, existing_fsq = fetch_existing_ids(supabase_url, supabase_key)

    # ---- Filter out duplicates ----
    new_venues: list[dict] = []
    skipped = 0
    for v in venues:
        if is_duplicate(v, existing_osm, existing_overture, existing_fsq):
            skipped += 1
        else:
            new_venues.append(v)

    print(f"\n  Skipping {skipped} venues already in database")
    print(f"  Will insert {len(new_venues)} new venues")

    if not new_venues:
        print("\nNothing to insert. Database is up to date.")
        return

    # ---- Batch insert ----
    BATCH_SIZE = 500
    total_success = 0
    total_fail = 0
    total_batches = (len(new_venues) + BATCH_SIZE - 1) // BATCH_SIZE
    start_time = time.time()

    print(f"\nInserting in {total_batches} batches of up to {BATCH_SIZE}...")

    for batch_idx in range(total_batches):
        batch_start = batch_idx * BATCH_SIZE
        batch_end = min(batch_start + BATCH_SIZE, len(new_venues))
        batch = new_venues[batch_start:batch_end]

        success, fail = insert_batch(supabase_url, supabase_key, batch, batch_idx + 1)
        total_success += success
        total_fail += fail

        # Progress update every 1000 rows (every 2 batches)
        processed = batch_end
        if processed % 1000 == 0 or batch_idx == total_batches - 1:
            elapsed = time.time() - start_time
            rate = processed / elapsed if elapsed > 0 else 0
            success_rate = 100 * total_success / processed if processed > 0 else 0
            print(f"  Progress: {processed:>7}/{len(new_venues)} "
                  f"({100 * processed / len(new_venues):.1f}%) | "
                  f"OK: {total_success} | Failed: {total_fail} | "
                  f"Rate: {rate:.0f} rows/s | "
                  f"Success: {success_rate:.1f}%")

    elapsed = time.time() - start_time

    # ---- Final stats ----
    print(f"\n{'=' * 50}")
    print(f"Import complete in {elapsed:.1f}s")
    print(f"  CSV rows read:    {len(csv_rows)}")
    print(f"  Conversion errors:{conversion_errors}")
    print(f"  Skipped (exists): {skipped}")
    print(f"  Inserted:         {total_success}")
    print(f"  Failed:           {total_fail}")
    print(f"  Total in DB now:  ~{total_success + skipped} scraped venues")
    print(f"{'=' * 50}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Import merged venue CSV into Supabase"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview what would be imported without making any API calls",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Only import first N rows (useful for testing)",
    )
    args = parser.parse_args()

    run(dry_run=args.dry_run, limit=args.limit)
