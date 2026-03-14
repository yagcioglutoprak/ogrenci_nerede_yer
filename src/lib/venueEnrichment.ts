// ==========================================
// Venue Enrichment Service — Google Places API (v1)
// On-demand enrichment when a user taps a venue
// ==========================================

import { supabase } from './supabase';
import type { Venue } from '../types';

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

const ENRICHMENT_TTL_DAYS = 30;

// ==========================================
// Types
// ==========================================

export interface PlaceDetails {
  rating?: number;
  userRatingCount?: number;
  nationalPhoneNumber?: string;
  regularOpeningHours?: {
    weekdayDescriptions: string[];
  };
  priceLevel?: string;
  photos?: Array<{ name: string }>;
  websiteUri?: string;
}

/** Venue row shape including the enrichment timestamp column */
interface VenueRow extends Venue {
  google_enriched_at?: string | null;
}

// ==========================================
// Helpers
// ==========================================

function isApiKeyConfigured(): boolean {
  if (!API_KEY) {
    console.warn('[venueEnrichment] EXPO_PUBLIC_GOOGLE_PLACES_API_KEY is not set — skipping enrichment');
    return false;
  }
  return true;
}

function isFresh(enrichedAt: string | null | undefined): boolean {
  if (!enrichedAt) return false;
  const enrichedDate = new Date(enrichedAt);
  const now = new Date();
  const diffMs = now.getTime() - enrichedDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays < ENRICHMENT_TTL_DAYS;
}

// ==========================================
// Public Functions
// ==========================================

/**
 * Find the Google Place ID for a venue using Text Search (IDs only).
 * This endpoint is free and unlimited.
 */
export async function findGooglePlaceId(
  name: string,
  lat: number,
  lng: number,
): Promise<string | null> {
  if (!isApiKeyConfigured()) return null;

  try {
    const response = await fetch(
      'https://places.googleapis.com/v1/places:searchText',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': API_KEY!,
          'X-Goog-FieldMask': 'places.id',
        },
        body: JSON.stringify({
          textQuery: name,
          locationBias: {
            circle: {
              center: { latitude: lat, longitude: lng },
              radius: 100,
            },
          },
        }),
      },
    );

    if (!response.ok) {
      console.warn(
        `[venueEnrichment] findGooglePlaceId failed: ${response.status} ${response.statusText}`,
      );
      return null;
    }

    const data = await response.json();
    const places = data.places as Array<{ id: string }> | undefined;

    if (!places || places.length === 0) {
      console.warn(`[venueEnrichment] No Google Place found for "${name}"`);
      return null;
    }

    return places[0].id;
  } catch (error) {
    console.warn('[venueEnrichment] findGooglePlaceId error:', error);
    return null;
  }
}

/**
 * Fetch place details from Google Places API (Enterprise tier — 1,000 free/month).
 */
export async function fetchPlaceDetails(
  placeId: string,
): Promise<PlaceDetails | null> {
  if (!isApiKeyConfigured()) return null;

  const fieldMask = [
    'displayName',
    'rating',
    'userRatingCount',
    'nationalPhoneNumber',
    'regularOpeningHours',
    'priceLevel',
    'photos',
    'websiteUri',
  ].join(',');

  try {
    const response = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}`,
      {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': API_KEY!,
          'X-Goog-FieldMask': fieldMask,
        },
      },
    );

    if (!response.ok) {
      console.warn(
        `[venueEnrichment] fetchPlaceDetails failed: ${response.status} ${response.statusText}`,
      );
      return null;
    }

    const data = await response.json();

    const details: PlaceDetails = {
      rating: data.rating,
      userRatingCount: data.userRatingCount,
      nationalPhoneNumber: data.nationalPhoneNumber,
      regularOpeningHours: data.regularOpeningHours,
      priceLevel: data.priceLevel,
      photos: data.photos,
      websiteUri: data.websiteUri,
    };

    return details;
  } catch (error) {
    console.warn('[venueEnrichment] fetchPlaceDetails error:', error);
    return null;
  }
}

/**
 * Main enrichment function — call when a user taps a venue.
 *
 * 1. Fetch venue from Supabase
 * 2. If google data is fresh (< 30 days), return as-is
 * 3. Otherwise: find Google Place ID -> fetch details -> update Supabase -> return
 */
export async function enrichVenue(venueId: string): Promise<Venue | null> {
  try {
    // 1. Fetch venue from database
    const { data: venue, error } = await supabase
      .from('venues')
      .select('*')
      .eq('id', venueId)
      .single();

    if (error || !venue) {
      console.warn('[venueEnrichment] Venue not found:', venueId, error?.message);
      return null;
    }

    const venueRow = venue as VenueRow;

    // 2. Check freshness — skip enrichment if data is recent
    if (venueRow.google_place_id && isFresh(venueRow.google_enriched_at)) {
      return venueRow as Venue;
    }

    // 3. No API key means we can't enrich, just return existing data
    if (!isApiKeyConfigured()) {
      return venueRow as Venue;
    }

    // 4. Resolve Google Place ID (use existing or find new)
    let googlePlaceId = venueRow.google_place_id ?? null;
    if (!googlePlaceId) {
      googlePlaceId = await findGooglePlaceId(
        venueRow.name,
        venueRow.latitude,
        venueRow.longitude,
      );
    }

    if (!googlePlaceId) {
      // Could not find a matching place — mark as attempted so we don't retry too often
      await supabase
        .from('venues')
        .update({ google_enriched_at: new Date().toISOString() })
        .eq('id', venueId);

      return venueRow as Venue;
    }

    // 5. Fetch details from Google
    const details = await fetchPlaceDetails(googlePlaceId);

    // 6. Build update payload
    const updatePayload: Record<string, unknown> = {
      google_place_id: googlePlaceId,
      google_enriched_at: new Date().toISOString(),
    };

    if (details) {
      if (details.rating != null) {
        updatePayload.google_rating = details.rating;
      }
      // Only fill phone if the venue doesn't already have one
      if (details.nationalPhoneNumber && !venueRow.phone) {
        updatePayload.phone = details.nationalPhoneNumber;
      }
    }

    // 7. Update Supabase
    const { data: updated, error: updateError } = await supabase
      .from('venues')
      .update(updatePayload)
      .eq('id', venueId)
      .select('*')
      .single();

    if (updateError || !updated) {
      console.warn('[venueEnrichment] Update failed or blocked by RLS:', updateError?.message);
      return venueRow as Venue;
    }

    return updated as Venue;
  } catch (error) {
    console.warn('[venueEnrichment] enrichVenue error:', error);
    return null;
  }
}

/**
 * Build a Google Places photo URL.
 * Photos require the API key as a query parameter.
 */
export function fetchPlacePhoto(
  photoName: string,
  maxWidth: number = 400,
): string {
  if (!API_KEY) {
    console.warn('[venueEnrichment] Cannot build photo URL — API key not set');
    return '';
  }

  return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${API_KEY}`;
}
