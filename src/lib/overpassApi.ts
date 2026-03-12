import type { Venue } from '../types';

// Istanbul bounding box (covers the whole city)
const ISTANBUL_BBOX = {
  south: 40.80,
  west: 28.50,
  north: 41.35,
  east: 29.45,
};

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

// In-memory cache
let cachedVenues: Venue[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function mapToVenue(el: OverpassElement): Venue | null {
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (!lat || !lon) return null;

  const tags = el.tags || {};
  const name = tags.name || tags['name:tr'] || tags['name:en'];
  if (!name) return null;

  // Build address from available OSM tags
  const addressParts = [
    tags['addr:street'],
    tags['addr:housenumber'],
    tags['addr:district'] || tags['addr:suburb'],
  ].filter(Boolean);
  const address = addressParts.length > 0
    ? addressParts.join(' ')
    : tags['addr:city'] || 'Istanbul';

  return {
    id: `osm-${el.type[0]}${el.id}`,
    name,
    description: null,
    latitude: lat,
    longitude: lon,
    address,
    phone: tags.phone || tags['contact:phone'] || null,
    price_range: 1 as const,
    is_verified: false,
    youtube_video_url: null,
    avg_taste_rating: 0,
    avg_value_rating: 0,
    avg_friendliness_rating: 0,
    overall_rating: 0,
    total_reviews: 0,
    level: 1,
    cover_image_url: null,
    tags: [],
    created_by: '',
    created_at: '2026-01-01T00:00:00Z',
    source: 'google_places' as const,
    google_rating: undefined,
    google_place_id: undefined,
  };
}

export async function fetchIstanbulRestaurants(): Promise<Venue[]> {
  // Return cache if still valid
  if (cachedVenues && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cachedVenues;
  }

  const { south, west, north, east } = ISTANBUL_BBOX;
  const bbox = `${south},${west},${north},${east}`;

  // Query restaurants, cafes, and fast food places in Istanbul
  const query = `
    [out:json][timeout:30];
    (
      node["amenity"="restaurant"](${bbox});
      node["amenity"="cafe"](${bbox});
      node["amenity"="fast_food"](${bbox});
      way["amenity"="restaurant"](${bbox});
      way["amenity"="cafe"](${bbox});
      way["amenity"="fast_food"](${bbox});
    );
    out center tags;
  `;

  const response = await fetch(OVERPASS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status}`);
  }

  const data = await response.json();
  const elements: OverpassElement[] = data.elements || [];

  const venues = elements
    .map(mapToVenue)
    .filter((v): v is Venue => v !== null);

  // Cache results
  cachedVenues = venues;
  cacheTimestamp = Date.now();

  return venues;
}
