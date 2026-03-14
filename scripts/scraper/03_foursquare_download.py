"""
Download food venues from Foursquare OS Places (Apache 2.0 license).

Queries the S3-hosted Parquet files via DuckDB, filtering by Istanbul
bounding box and food-related categories.

Outputs: data/fsq_istanbul_food.csv
"""

import csv
import sys
from pathlib import Path

import duckdb

DATA_DIR = Path(__file__).parent / "data"
OUTPUT_FILE = DATA_DIR / "fsq_istanbul_food.csv"

# Istanbul bounding box
MIN_LAT, MAX_LAT = 40.75, 41.65
MIN_LON, MAX_LON = 28.4, 29.95

# FSQ OS Places S3 path (public, no auth required)
FSQ_S3_PATH = "s3://fsq-os-places-us-east-1/release/dt=2025-09-09/places/parquet/*"

# Food-related FSQ category labels (partial match on the label hierarchy)
FOOD_CATEGORY_PATTERNS = [
    "%Restaurant%",
    "%Bakery%",
    "%Food Court%",
    "%Diner%",
    "%Pizz%",
    "%Kebab%",
    "%Dessert%",
    "%Ice Cream%",
    "%Pastry%",
    "%Breakfast%",
    "%Brunch%",
    "%Seafood%",
    "%Steak%",
    "%Grill%",
    "%Bistro%",
    "%Deli%",
    "%Sandwich%",
    "%Burger%",
    "%Fried Chicken%",
    "%Donut%",
    "%Bagel%",
    "%Soup%",
    "%Noodle%",
    "%Sushi%",
    "%Buffet%",
    "%Canteen%",
    "%Cafeteria%",
    "%Patisserie%",
    "%Confection%",
    "%Doner%",
    "%Fast Food%",
    "%Comfort Food%",
    "%Home Cooking%",
]

# Exclude these even if they matched a food pattern
EXCLUDED_CATEGORY_PATTERNS = [
    "%Grocery%", "%Lounge%", "%Hookah%", "%Bus %",
    "%Nightclub%", "%Club%", "%Gym%", "%Spa%",
    "%Barber%", "%Salon%", "%Shop%",
]

CSV_FIELDS = [
    "fsq_id", "name", "latitude", "longitude", "address",
    "phone", "website", "email", "instagram", "twitter",
    "facebook_id", "categories", "source",
]


def build_category_filter() -> str:
    include = []
    for pattern in FOOD_CATEGORY_PATTERNS:
        include.append(f"array_to_string(fsq_category_labels, ',') ILIKE '{pattern}'")
    exclude = []
    for pattern in EXCLUDED_CATEGORY_PATTERNS:
        exclude.append(f"array_to_string(fsq_category_labels, ',') NOT ILIKE '{pattern}'")
    return f"({' OR '.join(include)}) AND ({' AND '.join(exclude)})"


def download_fsq():
    print("Querying Foursquare OS Places from S3 via DuckDB...")
    print(f"  Istanbul bbox: lat [{MIN_LAT}, {MAX_LAT}], lon [{MIN_LON}, {MAX_LON}]")

    con = duckdb.connect()

    # Install and load httpfs for S3 access
    con.execute("INSTALL httpfs;")
    con.execute("LOAD httpfs;")
    con.execute("SET s3_region = 'us-east-1';")
    # Public bucket, no credentials needed
    con.execute("SET s3_access_key_id = '';")
    con.execute("SET s3_secret_access_key = '';")
    con.execute("SET s3_url_style = 'path';")

    category_filter = build_category_filter()

    query = f"""
    SELECT
        fsq_place_id,
        name,
        latitude,
        longitude,
        address,
        locality,
        region,
        postcode,
        tel,
        website,
        email,
        instagram,
        twitter,
        facebook_id,
        array_to_string(fsq_category_labels, ' | ') AS categories
    FROM read_parquet('{FSQ_S3_PATH}', hive_partitioning=false)
    WHERE country = 'TR'
      AND latitude BETWEEN {MIN_LAT} AND {MAX_LAT}
      AND longitude BETWEEN {MIN_LON} AND {MAX_LON}
      AND date_closed IS NULL
      AND ({category_filter})
    """

    print("  Running query (this may take a few minutes)...")
    result = con.execute(query).fetchall()
    columns = [
        "fsq_place_id", "name", "latitude", "longitude",
        "address", "locality", "region", "postcode",
        "tel", "website", "email", "instagram", "twitter",
        "facebook_id", "categories",
    ]

    print(f"  Raw results: {len(result)}")

    excluded_primary = {"café", "cafe", "coffee shop", "bar", "pub", "tea room",
                         "lounge", "hookah bar", "beer garden", "wine bar",
                         "brewery", "cocktail bar", "juice bar"}

    venues = []
    for row in result:
        data = dict(zip(columns, row))
        name = data["name"]
        if not name:
            continue

        # Exclude venues whose primary category is cafe/bar
        cat_labels = data["categories"] or ""
        primary_cat = cat_labels.split("|")[0].strip().split(">")[-1].strip().lower()
        if primary_cat in excluded_primary:
            continue

        addr_parts = [
            data["address"] or "",
            data["locality"] or "",
            data["region"] or "",
            data["postcode"] or "",
        ]
        address = ", ".join(p for p in addr_parts if p)

        venues.append({
            "fsq_id": f"fsq-{data['fsq_place_id']}",
            "name": name.strip(),
            "latitude": round(float(data["latitude"]), 7),
            "longitude": round(float(data["longitude"]), 7),
            "address": address,
            "phone": data["tel"] or "",
            "website": data["website"] or "",
            "email": data["email"] or "",
            "instagram": data["instagram"] or "",
            "twitter": data["twitter"] or "",
            "facebook_id": data["facebook_id"] or "",
            "categories": data["categories"] or "",
            "source": "foursquare",
        })

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(venues)

    print(f"  Saved to: {OUTPUT_FILE}")
    con.close()
    return venues


def print_stats(venues: list[dict]):
    with_phone = sum(1 for v in venues if v["phone"])
    with_website = sum(1 for v in venues if v["website"])
    with_email = sum(1 for v in venues if v["email"])
    with_instagram = sum(1 for v in venues if v["instagram"])
    with_address = sum(1 for v in venues if v["address"])

    print(f"\n--- Foursquare OS Places Istanbul Food Stats ---")
    print(f"Total venues: {len(venues)}")
    print(f"\nField coverage:")
    print(f"  phone:     {with_phone:>5} ({100*with_phone/len(venues):.1f}%)")
    print(f"  website:   {with_website:>5} ({100*with_website/len(venues):.1f}%)")
    print(f"  email:     {with_email:>5} ({100*with_email/len(venues):.1f}%)")
    print(f"  instagram: {with_instagram:>5} ({100*with_instagram/len(venues):.1f}%)")
    print(f"  address:   {with_address:>5} ({100*with_address/len(venues):.1f}%)")


if __name__ == "__main__":
    venues = download_fsq()
    if venues:
        print_stats(venues)
    else:
        print("ERROR: No food venues found!", file=sys.stderr)
        sys.exit(1)
