# 3-Tier Map Marker System

## Problem
All map markers render identically as liquid glass cards. No visual distinction between well-reviewed venues and unreviewed ones.

## Solution
Three visually distinct marker tiers based on venue source and review status.

## Tiers

| Tier | Condition | Visual | Size |
|------|-----------|--------|------|
| 1 - Grey Dot | `source === 'google_places'` | 8px grey circle, no label | Smallest |
| 2 - Muted Pill | `source === 'ony' && total_reviews === 0` | Small pill with name, muted colors | Medium |
| 3 - Full Card | `source === 'ony' && total_reviews > 0` | Liquid glass card with red dot, rating, price | Largest |

## Data Model Changes

Add to `Venue` interface:
- `source?: 'google_places' | 'ony'` (default `'ony'`)
- `google_rating?: number`
- `google_place_id?: string`

## Marker Visuals

### Tier 1 (Grey Dot)
- 8px solid grey circle (#9CA3AF), no stem, no label
- Callout on tap: venue name, Google rating, "Ilk degerlendirmeyi yap!" CTA

### Tier 2 (Muted Pill)
- Small pill: venue name in muted text
- Semi-transparent background, thin border
- Small stem + anchor
- Callout on tap: name, address, price, "Degerlendir" CTA

### Tier 3 (Full Card)
- Current liquid glass card (unchanged)
- Red accent dot, name, rating, price
- Rich callout with image, rating bars, "Detaylar" link

## Mock Data
- ~10-15 Google Places venues around Istanbul (name, lat/lng, google_rating)
- Existing venues with 0 reviews → Tier 2
- Existing venues with reviews → Tier 3

## Clustering
- Grey dots excluded from clustering
- Tier 2 + 3 cluster as before

## Files
1. `src/types/index.ts` — add source, google_rating, google_place_id
2. `src/lib/mockData.ts` — add mock Google Places venues
3. `src/app/(tabs)/map.tsx` — 3-tier rendering, updated tier logic, grey dot callout
