// ==========================================
// Venue Enrichment Service — Google Places API (v1)
// On-demand enrichment when a user taps a venue
// ==========================================

import { supabase } from './supabase';
import type { Venue } from '../types';

const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

// Permanent cache — once enriched, never re-fetch

// ==========================================
// Types
// ==========================================

export interface PlaceDetails {
  rating?: number;
  userRatingCount?: number;
  nationalPhoneNumber?: string;
  formattedAddress?: string;
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

function isAlreadyEnriched(enrichedAt: string | null | undefined): boolean {
  return !!enrichedAt;
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
    'formattedAddress',
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
      formattedAddress: data.formattedAddress,
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
 * 2. If already enriched, return cached data (permanent cache)
 * 3. Otherwise: find Google Place ID -> fetch details -> save to Supabase -> return
 */
export async function enrichVenue(venueId: string): Promise<Venue | null> {
  try {
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

    // Already enriched → return cached data permanently
    if (isAlreadyEnriched(venueRow.google_enriched_at)) {
      return venueRow as Venue;
    }

    if (!isApiKeyConfigured()) {
      return venueRow as Venue;
    }

    // Resolve Google Place ID
    let googlePlaceId = venueRow.google_place_id ?? null;
    if (!googlePlaceId) {
      googlePlaceId = await findGooglePlaceId(
        venueRow.name,
        venueRow.latitude,
        venueRow.longitude,
      );
    }

    if (!googlePlaceId) {
      // Mark as attempted so we don't retry on every tap
      await supabase
        .from('venues')
        .update({ google_enriched_at: new Date().toISOString() })
        .eq('id', venueId);
      return venueRow as Venue;
    }

    // Fetch full details from Google
    const details = await fetchPlaceDetails(googlePlaceId);

    // Build update payload — cache everything permanently
    const updatePayload: Record<string, unknown> = {
      google_place_id: googlePlaceId,
      google_enriched_at: new Date().toISOString(),
    };

    if (details) {
      if (details.rating != null) {
        updatePayload.google_rating = details.rating;
      }
      if (details.userRatingCount != null) {
        updatePayload.google_rating_count = details.userRatingCount;
      }
      if (details.formattedAddress) {
        // Update address if current one is generic (e.g. just "Istanbul")
        if (!venueRow.address || venueRow.address === 'Istanbul') {
          updatePayload.address = details.formattedAddress;
        }
      }
      if (details.nationalPhoneNumber) {
        updatePayload.google_phone = details.nationalPhoneNumber;
        if (!venueRow.phone) {
          updatePayload.phone = details.nationalPhoneNumber;
        }
      }
      if (details.websiteUri) {
        updatePayload.google_website = details.websiteUri;
      }
      if (details.priceLevel) {
        updatePayload.google_price_level = details.priceLevel;
      }
      if (details.regularOpeningHours?.weekdayDescriptions) {
        updatePayload.google_hours = details.regularOpeningHours.weekdayDescriptions;
      }
      if (details.photos && details.photos.length > 0) {
        updatePayload.google_photos = details.photos
          .slice(0, 5)
          .map((p) => p.name);
      }
    }

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
