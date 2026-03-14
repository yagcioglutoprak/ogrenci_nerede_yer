"""
Download all food venues from OpenStreetMap for Istanbul via Overpass API.

Outputs: data/osm_istanbul_food.csv
Fields: osm_id, name, latitude, longitude, address, phone, website,
        cuisine, opening_hours, amenity_type
"""

import csv
import json
import sys
import time
from pathlib import Path

import requests

DATA_DIR = Path(__file__).parent / "data"
OUTPUT_FILE = DATA_DIR / "osm_istanbul_food.csv"

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

OVERPASS_QUERY = """
[out:json][timeout:300];
area["name"="İstanbul"]["admin_level"="4"]->.searchArea;
(
  nwr["amenity"="restaurant"](area.searchArea);
  nwr["amenity"="fast_food"](area.searchArea);
  nwr["amenity"="food_court"](area.searchArea);
  nwr["amenity"="ice_cream"](area.searchArea);
  nwr["shop"="bakery"](area.searchArea);
  nwr["shop"="pastry"](area.searchArea);
  nwr["shop"="confectionery"](area.searchArea);
);
out center;
"""

CSV_FIELDS = [
    "osm_id", "name", "latitude", "longitude", "address",
    "phone", "website", "cuisine", "opening_hours", "amenity_type",
    "source",
]


def build_address(tags: dict) -> str:
    parts = []
    street = tags.get("addr:street", "")
    housenumber = tags.get("addr:housenumber", "")
    if street:
        parts.append(f"{street} {housenumber}".strip())
    district = tags.get("addr:district") or tags.get("addr:neighbourhood", "")
    if district:
        parts.append(district)
    city = tags.get("addr:city", "")
    if city:
        parts.append(city)
    postcode = tags.get("addr:postcode", "")
    if postcode:
        parts.append(postcode)
    return ", ".join(parts)


def extract_venue(element: dict) -> dict | None:
    tags = element.get("tags", {})
    name = tags.get("name")
    if not name:
        return None

    lat = element.get("lat") or element.get("center", {}).get("lat")
    lon = element.get("lon") or element.get("center", {}).get("lon")
    if not lat or not lon:
        return None

    amenity = tags.get("amenity") or tags.get("shop", "")

    return {
        "osm_id": f"osm-{element['id']}",
        "name": name.strip(),
        "latitude": round(float(lat), 7),
        "longitude": round(float(lon), 7),
        "address": build_address(tags),
        "phone": tags.get("phone") or tags.get("contact:phone", ""),
        "website": tags.get("website") or tags.get("contact:website", ""),
        "cuisine": tags.get("cuisine", ""),
        "opening_hours": tags.get("opening_hours", ""),
        "amenity_type": amenity,
        "source": "osm",
    }


def download_osm_data():
    print("Querying Overpass API for Istanbul food venues...")
    response = requests.post(
        OVERPASS_URL,
        data={"data": OVERPASS_QUERY},
        timeout=360,
    )
    response.raise_for_status()
    data = response.json()
    elements = data.get("elements", [])
    print(f"  Raw elements returned: {len(elements)}")

    venues = []
    seen_ids = set()
    for el in elements:
        venue = extract_venue(el)
        if venue and venue["osm_id"] not in seen_ids:
            venues.append(venue)
            seen_ids.add(venue["osm_id"])

    print(f"  Venues with names: {len(venues)}")

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(venues)

    print(f"  Saved to: {OUTPUT_FILE}")
    return venues


def print_stats(venues: list[dict]):
    types = {}
    with_phone = 0
    with_website = 0
    with_address = 0
    with_cuisine = 0
    with_hours = 0

    for v in venues:
        t = v["amenity_type"]
        types[t] = types.get(t, 0) + 1
        if v["phone"]:
            with_phone += 1
        if v["website"]:
            with_website += 1
        if v["address"]:
            with_address += 1
        if v["cuisine"]:
            with_cuisine += 1
        if v["opening_hours"]:
            with_hours += 1

    print("\n--- OSM Istanbul Food Venues Stats ---")
    print(f"Total venues: {len(venues)}")
    print("\nBy type:")
    for t, count in sorted(types.items(), key=lambda x: -x[1]):
        print(f"  {t}: {count}")
    print(f"\nField coverage:")
    print(f"  phone:         {with_phone:>5} ({100*with_phone/len(venues):.1f}%)")
    print(f"  website:       {with_website:>5} ({100*with_website/len(venues):.1f}%)")
    print(f"  address:       {with_address:>5} ({100*with_address/len(venues):.1f}%)")
    print(f"  cuisine:       {with_cuisine:>5} ({100*with_cuisine/len(venues):.1f}%)")
    print(f"  opening_hours: {with_hours:>5} ({100*with_hours/len(venues):.1f}%)")


if __name__ == "__main__":
    venues = download_osm_data()
    if venues:
        print_stats(venues)
    else:
        print("ERROR: No venues returned!", file=sys.stderr)
        sys.exit(1)
