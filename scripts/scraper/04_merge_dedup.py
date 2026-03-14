"""
Merge and deduplicate venues from OSM, Overture Maps, and Foursquare OS Places.

Deduplication strategy:
1. Normalize names (lowercase, strip diacritics, remove common suffixes)
2. Build a spatial index grid (100m cells)
3. For venues in nearby cells (<100m apart), compute name similarity
4. Merge duplicates: prefer Overture > FSQ > OSM for field richness
5. Combine unique fields from all sources

Outputs: data/merged_istanbul_venues.csv
"""

import csv
import math
import sys
from collections import defaultdict
from pathlib import Path

from thefuzz import fuzz
from unidecode import unidecode

DATA_DIR = Path(__file__).parent / "data"
OUTPUT_FILE = DATA_DIR / "merged_istanbul_venues.csv"

# Istanbul proper coordinate bounds
IST_LAT_MIN, IST_LAT_MAX = 40.85, 41.35
IST_LON_MIN, IST_LON_MAX = 28.55, 29.45

# Two venues closer than this (in meters) with similar names are duplicates
DISTANCE_THRESHOLD_M = 100
NAME_SIMILARITY_THRESHOLD = 75  # fuzz ratio out of 100

MERGED_FIELDS = [
    "id", "name", "latitude", "longitude", "address",
    "phone", "website", "email", "instagram", "twitter",
    "categories", "cuisine", "opening_hours",
    "sources", "osm_id", "overture_id", "fsq_id",
]


def normalize_name(name: str) -> str:
    n = unidecode(name).lower().strip()
    # Remove common Turkish business suffixes
    for suffix in [" restoran", " restaurant", " lokanta", " kebap",
                   " cafe", " kafe", " pastane", " firin", " bakery",
                   " steakhouse", " bistro", " burger"]:
        if n.endswith(suffix):
            n = n[:-len(suffix)].strip()
    # Remove punctuation
    n = "".join(c for c in n if c.isalnum() or c == " ")
    return " ".join(n.split())


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def grid_key(lat: float, lon: float, cell_size_deg: float = 0.001) -> tuple[int, int]:
    return (int(lat / cell_size_deg), int(lon / cell_size_deg))


def load_osm() -> list[dict]:
    filepath = DATA_DIR / "osm_istanbul_food.csv"
    if not filepath.exists():
        print(f"  WARNING: {filepath} not found, skipping OSM")
        return []
    venues = []
    with open(filepath, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            venues.append({
                "name": row["name"],
                "normalized_name": normalize_name(row["name"]),
                "latitude": float(row["latitude"]),
                "longitude": float(row["longitude"]),
                "address": row.get("address", ""),
                "phone": row.get("phone", ""),
                "website": row.get("website", ""),
                "email": "",
                "instagram": "",
                "twitter": "",
                "categories": row.get("amenity_type", ""),
                "cuisine": row.get("cuisine", ""),
                "opening_hours": row.get("opening_hours", ""),
                "osm_id": row.get("osm_id", ""),
                "overture_id": "",
                "fsq_id": "",
                "source": "osm",
                "source_priority": 3,  # lowest
            })
    return venues


def load_overture() -> list[dict]:
    filepath = DATA_DIR / "overture_istanbul_food.csv"
    if not filepath.exists():
        print(f"  WARNING: {filepath} not found, skipping Overture")
        return []
    venues = []
    with open(filepath, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            venues.append({
                "name": row["name"],
                "normalized_name": normalize_name(row["name"]),
                "latitude": float(row["latitude"]),
                "longitude": float(row["longitude"]),
                "address": row.get("address", ""),
                "phone": row.get("phone", ""),
                "website": row.get("website", ""),
                "email": "",
                "instagram": "",
                "twitter": "",
                "categories": row.get("categories", ""),
                "cuisine": "",
                "opening_hours": "",
                "osm_id": "",
                "overture_id": row.get("overture_id", ""),
                "fsq_id": "",
                "source": "overture",
                "source_priority": 1,  # highest
            })
    return venues


def load_fsq() -> list[dict]:
    filepath = DATA_DIR / "fsq_istanbul_food.csv"
    if not filepath.exists():
        print(f"  WARNING: {filepath} not found, skipping FSQ")
        return []
    venues = []
    with open(filepath, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            venues.append({
                "name": row["name"],
                "normalized_name": normalize_name(row["name"]),
                "latitude": float(row["latitude"]),
                "longitude": float(row["longitude"]),
                "address": row.get("address", ""),
                "phone": row.get("phone", ""),
                "website": row.get("website", ""),
                "email": row.get("email", ""),
                "instagram": row.get("instagram", ""),
                "twitter": row.get("twitter", ""),
                "categories": row.get("categories", ""),
                "cuisine": "",
                "opening_hours": "",
                "osm_id": "",
                "overture_id": "",
                "fsq_id": row.get("fsq_id", ""),
                "source": "foursquare",
                "source_priority": 2,
            })
    return venues


def merge_venue_pair(primary: dict, secondary: dict) -> dict:
    """Merge secondary into primary, filling empty fields."""
    merged = dict(primary)
    for field in ["address", "phone", "website", "email", "instagram",
                  "twitter", "cuisine", "opening_hours"]:
        if not merged.get(field) and secondary.get(field):
            merged[field] = secondary[field]

    # Combine categories
    if secondary.get("categories") and secondary["categories"] not in merged.get("categories", ""):
        existing = merged.get("categories", "")
        merged["categories"] = f"{existing}, {secondary['categories']}" if existing else secondary["categories"]

    # Keep all source IDs
    for id_field in ["osm_id", "overture_id", "fsq_id"]:
        if not merged.get(id_field) and secondary.get(id_field):
            merged[id_field] = secondary[id_field]

    # Track all sources
    sources = set(merged.get("sources", merged["source"]).split(", "))
    sources.add(secondary["source"])
    merged["sources"] = ", ".join(sorted(sources))

    return merged


def deduplicate(all_venues: list[dict]) -> list[dict]:
    print(f"  Deduplicating {len(all_venues)} venues...")

    # Sort by source priority (Overture first, then FSQ, then OSM)
    all_venues.sort(key=lambda v: v["source_priority"])

    # Build spatial grid
    grid: dict[tuple[int, int], list[int]] = defaultdict(list)
    merged = []
    merged_flags = [False] * len(all_venues)

    for i, venue in enumerate(all_venues):
        key = grid_key(venue["latitude"], venue["longitude"])
        grid[key].append(i)

    for i, venue in enumerate(all_venues):
        if merged_flags[i]:
            continue

        venue["sources"] = venue["source"]
        key = grid_key(venue["latitude"], venue["longitude"])

        # Check adjacent cells too
        neighbors = []
        for dk in range(-1, 2):
            for dl in range(-1, 2):
                neighbor_key = (key[0] + dk, key[1] + dl)
                if neighbor_key in grid:
                    neighbors.extend(grid[neighbor_key])

        for j in neighbors:
            if j <= i or merged_flags[j]:
                continue

            other = all_venues[j]
            dist = haversine_m(
                venue["latitude"], venue["longitude"],
                other["latitude"], other["longitude"],
            )
            if dist > DISTANCE_THRESHOLD_M:
                continue

            name_score = fuzz.ratio(venue["normalized_name"], other["normalized_name"])
            if name_score < NAME_SIMILARITY_THRESHOLD:
                # Also try token sort for reordered words
                token_score = fuzz.token_sort_ratio(
                    venue["normalized_name"], other["normalized_name"]
                )
                if token_score < NAME_SIMILARITY_THRESHOLD:
                    continue

            venue = merge_venue_pair(venue, other)
            merged_flags[j] = True

        merged.append(venue)

    return merged


def run():
    print("Loading data from all sources...")
    osm = load_osm()
    print(f"  OSM:      {len(osm):>7} venues")
    overture = load_overture()
    print(f"  Overture: {len(overture):>7} venues")
    fsq = load_fsq()
    print(f"  FSQ:      {len(fsq):>7} venues")

    all_venues = overture + fsq + osm

    # Filter to Istanbul proper by coordinates
    before = len(all_venues)
    all_venues = [
        v for v in all_venues
        if IST_LAT_MIN <= v["latitude"] <= IST_LAT_MAX
        and IST_LON_MIN <= v["longitude"] <= IST_LON_MAX
    ]
    print(f"  Filtered to Istanbul coords: {len(all_venues)} (removed {before - len(all_venues)} outside)")
    print(f"  Total:    {len(all_venues):>7} venues (before dedup)")

    merged = deduplicate(all_venues)
    print(f"  After dedup: {len(merged)} unique venues")
    print(f"  Removed:     {len(all_venues) - len(merged)} duplicates")

    # Assign sequential IDs
    for i, venue in enumerate(merged, 1):
        venue["id"] = f"v-{i:06d}"

    # Stats
    source_counts = defaultdict(int)
    multi_source = 0
    for v in merged:
        sources = v.get("sources", "").split(", ")
        for s in sources:
            source_counts[s] += 1
        if len(sources) > 1:
            multi_source += 1

    with_phone = sum(1 for v in merged if v.get("phone"))
    with_website = sum(1 for v in merged if v.get("website"))
    with_address = sum(1 for v in merged if v.get("address"))
    with_email = sum(1 for v in merged if v.get("email"))

    print(f"\n--- Merged Dataset Stats ---")
    print(f"Unique venues: {len(merged)}")
    print(f"Multi-source:  {multi_source} ({100*multi_source/len(merged):.1f}%)")
    print(f"\nSource contribution:")
    for src, count in sorted(source_counts.items(), key=lambda x: -x[1]):
        print(f"  {src}: {count}")
    print(f"\nField coverage:")
    print(f"  phone:   {with_phone:>6} ({100*with_phone/len(merged):.1f}%)")
    print(f"  website: {with_website:>6} ({100*with_website/len(merged):.1f}%)")
    print(f"  address: {with_address:>6} ({100*with_address/len(merged):.1f}%)")
    print(f"  email:   {with_email:>6} ({100*with_email/len(merged):.1f}%)")

    # Write output
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=MERGED_FIELDS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(merged)

    print(f"\nSaved to: {OUTPUT_FILE}")
    file_size = OUTPUT_FILE.stat().st_size / 1024 / 1024
    print(f"File size: {file_size:.1f} MB")


if __name__ == "__main__":
    run()
