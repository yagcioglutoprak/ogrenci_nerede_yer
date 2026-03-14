"""
Download all food/drink places from Overture Maps for Istanbul.

Uses the overturemaps CLI to query the S3-hosted Parquet files.
Bounding box covers greater Istanbul.

Outputs: data/overture_istanbul_food.csv
"""

import csv
import json
import subprocess
import sys
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"
RAW_FILE = DATA_DIR / "overture_istanbul_raw.geojson"
OUTPUT_FILE = DATA_DIR / "overture_istanbul_food.csv"

# Greater Istanbul bounding box (generous to catch edges)
ISTANBUL_BBOX = "28.4,40.75,29.95,41.65"

FOOD_PRIMARY_CATEGORIES = {
    "restaurant", "fast_food_restaurant",
    "bakery", "food_court", "ice_cream_shop",
    "pastry_shop", "confectionery", "deli",
    "kebab_shop", "pizza_restaurant", "dessert_shop",
    "desserts", "sandwich_shop", "noodle_shop", "sushi_restaurant",
    "seafood_restaurant", "steakhouse", "buffet_restaurant",
    "breakfast_restaurant", "brunch_restaurant",
    "turkish_restaurant", "mediterranean_restaurant",
    "donut_shop", "bagel_shop",
    "soup_restaurant", "ramen_restaurant", "falafel_restaurant",
    "fried_chicken_restaurant", "burger_restaurant",
    "chicken_restaurant", "wings_restaurant",
    "doner_kebab",
}

EXCLUDED_CATEGORIES = {
    "cafe", "coffee_shop", "bar", "pub", "tea_house",
    "wine_bar", "brewery", "juice_bar", "bubble_tea_shop",
    "lounge", "nightclub", "hookah_bar",
    "supermarket", "grocery_store", "convenience_store",
    "gas_station", "hotel", "gym", "spa",
}

CSV_FIELDS = [
    "overture_id", "name", "latitude", "longitude", "address",
    "phone", "website", "categories", "source",
]


def is_food_venue(primary_category: str, all_categories_str: str) -> bool:
    if primary_category in EXCLUDED_CATEGORIES:
        return False
    if primary_category in FOOD_PRIMARY_CATEGORIES:
        return True
    for cat in all_categories_str.split(","):
        stripped = cat.strip()
        if stripped in EXCLUDED_CATEGORIES:
            continue
        if stripped in FOOD_PRIMARY_CATEGORIES:
            return True
    return False


def download_overture():
    print("Downloading Overture Maps places for Istanbul bbox...")
    print(f"  Bbox: {ISTANBUL_BBOX}")

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    cmd = [
        "overturemaps", "download",
        "--bbox", ISTANBUL_BBOX,
        "-f", "geojson",
        "--type", "place",
        "-o", str(RAW_FILE),
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    if result.returncode != 0:
        print(f"  ERROR: {result.stderr}", file=sys.stderr)
        sys.exit(1)

    print(f"  Raw download complete: {RAW_FILE}")
    print(f"  File size: {RAW_FILE.stat().st_size / 1024 / 1024:.1f} MB")


def parse_and_filter():
    print("Parsing and filtering food venues...")

    venues = []
    total = 0
    skipped_no_name = 0
    skipped_not_food = 0

    with open(RAW_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip().rstrip(",")
            if not line.startswith("{"):
                continue

            try:
                feature = json.loads(line)
            except json.JSONDecodeError:
                continue

            if feature.get("type") != "Feature":
                continue

            total += 1
            props = feature.get("properties", {})
            names = props.get("names", {})

            primary_name = ""
            if isinstance(names, dict):
                primary = names.get("primary", "")
                if isinstance(primary, str):
                    primary_name = primary
                elif isinstance(primary, list) and primary:
                    primary_name = primary[0]

            if not primary_name:
                skipped_no_name += 1
                continue

            categories = props.get("categories", {})
            cat_primary = ""
            cat_alternate = []
            if isinstance(categories, dict):
                cat_primary = categories.get("primary", "")
                cat_alternate = categories.get("alternate", []) or []
            all_cats = [cat_primary] + (cat_alternate if isinstance(cat_alternate, list) else [])
            cat_str = ", ".join(c for c in all_cats if c)

            if not is_food_venue(cat_primary, cat_str):
                skipped_not_food += 1
                continue

            geometry = feature.get("geometry", {})
            coords = geometry.get("coordinates", [])
            if not coords or len(coords) < 2:
                continue

            lon, lat = coords[0], coords[1]

            addresses = props.get("addresses", [])
            address = ""
            if isinstance(addresses, list) and addresses:
                addr = addresses[0]
                if isinstance(addr, dict):
                    parts = [
                        addr.get("freeform", ""),
                        addr.get("locality", ""),
                        addr.get("region", ""),
                        addr.get("postcode", ""),
                    ]
                    address = ", ".join(p for p in parts if p)

            phones = props.get("phones", [])
            phone = ""
            if isinstance(phones, list) and phones:
                phone = phones[0] if isinstance(phones[0], str) else ""

            websites = props.get("websites", [])
            website = ""
            if isinstance(websites, list) and websites:
                website = websites[0] if isinstance(websites[0], str) else ""

            venues.append({
                "overture_id": f"ovt-{props.get('id', '')}",
                "name": primary_name.strip(),
                "latitude": round(float(lat), 7),
                "longitude": round(float(lon), 7),
                "address": address,
                "phone": phone,
                "website": website,
                "categories": cat_str,
                "source": "overture",
            })

    print(f"  Total features parsed: {total}")
    print(f"  Skipped (no name): {skipped_no_name}")
    print(f"  Skipped (not food): {skipped_not_food}")
    print(f"  Food venues extracted: {len(venues)}")

    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(venues)

    print(f"  Saved to: {OUTPUT_FILE}")
    return venues


def print_stats(venues: list[dict]):
    with_phone = sum(1 for v in venues if v["phone"])
    with_website = sum(1 for v in venues if v["website"])
    with_address = sum(1 for v in venues if v["address"])

    cat_counts = {}
    for v in venues:
        primary = v["categories"].split(",")[0].strip() if v["categories"] else "unknown"
        cat_counts[primary] = cat_counts.get(primary, 0) + 1

    print("\n--- Overture Maps Istanbul Food Venues Stats ---")
    print(f"Total venues: {len(venues)}")
    print(f"\nTop categories:")
    for cat, count in sorted(cat_counts.items(), key=lambda x: -x[1])[:15]:
        print(f"  {cat}: {count}")
    print(f"\nField coverage:")
    print(f"  phone:   {with_phone:>5} ({100*with_phone/len(venues):.1f}%)")
    print(f"  website: {with_website:>5} ({100*with_website/len(venues):.1f}%)")
    print(f"  address: {with_address:>5} ({100*with_address/len(venues):.1f}%)")


if __name__ == "__main__":
    if not RAW_FILE.exists():
        download_overture()
    else:
        print(f"Raw file exists ({RAW_FILE.stat().st_size / 1024 / 1024:.1f} MB), skipping download.")
    venues = parse_and_filter()
    if venues:
        print_stats(venues)
    else:
        print("ERROR: No food venues found!", file=sys.stderr)
        sys.exit(1)
