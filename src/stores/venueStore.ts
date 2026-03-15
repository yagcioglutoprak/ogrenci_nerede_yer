import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { uploadImage } from '../lib/imageUpload';
import { checkAndAwardBadges, addXP } from '../lib/badgeChecker';
import { haptic } from '../lib/haptics';
import type { Venue, Review, VenueFilters } from '../types';

const PAGE_SIZE = 30;

let filterFetchTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Build a Supabase query for venues with the given filters and optional geo bounding box.
 */
function buildVenueQuery(filters: VenueFilters, region?: { lat: number; lng: number; radius: number }) {
  let query = supabase.from('venues').select('*');

  if (filters.minRating) {
    query = query.gte('overall_rating', filters.minRating);
  }
  if (filters.priceRange && filters.priceRange.length > 0) {
    query = query.in('price_range', filters.priceRange);
  }
  if (filters.isVerified) {
    query = query.eq('is_verified', true);
  }
  if (filters.tags && filters.tags.length > 0) {
    query = query.contains('tags', filters.tags);
  }
  if (filters.searchQuery && filters.searchQuery.trim()) {
    query = query.or(
      `name.ilike.%${filters.searchQuery}%,address.ilike.%${filters.searchQuery}%`,
    );
  }

  // Geo-bounding box filter
  if (region) {
    const delta = region.radius / 111; // ~111 km per degree
    query = query
      .gte('latitude', region.lat - delta)
      .lte('latitude', region.lat + delta)
      .gte('longitude', region.lng - delta)
      .lte('longitude', region.lng + delta);
  }

  return query;
}

interface VenueState {
  venues: Venue[];
  nearbyScrapedVenues: Venue[];
  nearbyScrapedCount: number;
  selectedVenue: Venue | null;
  reviews: Review[];
  filters: VenueFilters;
  favoriteVenueIds: Set<string>;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;

  fetchVenues: (region?: { lat: number; lng: number; radius: number }) => Promise<void>;
  fetchMoreVenues: () => Promise<void>;
  fetchVenueById: (id: string) => Promise<void>;
  fetchReviews: (venueId: string) => Promise<void>;
  searchVenues: (query: string) => Promise<void>;
  fetchNearbyScraped: (lat: number, lng: number, latDelta: number, lngDelta: number) => Promise<void>;
  countNearbyScraped: (lat: number, lng: number, latDelta: number, lngDelta: number) => Promise<void>;
  fetchNearbyScrapedWithCount: (lat: number, lng: number, latDelta: number, lngDelta: number) => Promise<void>;
  addVenue: (venue: Omit<Venue, 'id' | 'created_at' | 'avg_taste_rating' | 'avg_value_rating' | 'avg_friendliness_rating' | 'overall_rating' | 'total_reviews' | 'level'>) => Promise<{ data: Venue | null; error: string | null }>;
  addReview: (review: Omit<Review, 'id' | 'created_at'>) => Promise<{ error: string | null }>;
  toggleFavorite: (venueId: string, userId: string) => Promise<void>;
  isFavorite: (venueId: string) => boolean;
  setFilters: (filters: VenueFilters) => void;
  clearError: () => void;
}

export const useVenueStore = create<VenueState>((set, get) => ({
  venues: [],
  nearbyScrapedVenues: [],
  nearbyScrapedCount: 0,
  selectedVenue: null,
  reviews: [],
  filters: {},
  favoriteVenueIds: new Set<string>(),
  loading: false,
  loadingMore: false,
  hasMore: true,
  error: null,

  fetchVenues: async (region) => {
    set({ loading: true, error: null });

    try {
      const filters = get().filters;
      const { data, error } = await buildVenueQuery(filters, region)
        .order('overall_rating', { ascending: false })
        .range(0, PAGE_SIZE - 1);

      if (!error && data) {
        set({ venues: data as Venue[], hasMore: data.length >= PAGE_SIZE, loading: false });
      } else if (error) {
        set({ venues: [], hasMore: false, error: error.message, loading: false });
      } else {
        set({ loading: false });
      }
    } catch (err: any) {
      set({
        venues: [],
        hasMore: false,
        error: err?.message || 'Mekanlar yuklenirken hata olustu',
        loading: false,
      });
    }
  },

  fetchMoreVenues: async () => {
    const { venues, loadingMore, hasMore } = get();
    if (loadingMore || !hasMore) return;

    set({ loadingMore: true });
    const from = venues.length;
    const to = from + PAGE_SIZE - 1;

    try {
      const filters = get().filters;
      const { data, error } = await buildVenueQuery(filters)
        .order('overall_rating', { ascending: false })
        .range(from, to);

      if (!error && data && data.length > 0) {
        set({
          venues: [...venues, ...(data as Venue[])],
          hasMore: data.length >= PAGE_SIZE,
          loadingMore: false,
        });
      } else {
        set({ hasMore: false, loadingMore: false });
      }
    } catch {
      set({ hasMore: false, loadingMore: false });
    }
  },

  fetchVenueById: async (id) => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('venues')
      .select('*')
      .eq('id', id)
      .single();

    if (!error && data) {
      set({ selectedVenue: data as Venue, loading: false });
    } else {
      set({ selectedVenue: null, loading: false });
    }
  },

  fetchReviews: async (venueId) => {
    const { data, error } = await supabase
      .from('reviews')
      .select('*, user:users(*)')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      set({ reviews: data as Review[] });
    } else {
      set({ reviews: [] });
    }
  },

  searchVenues: async (query) => {
    if (!query.trim()) {
      await get().fetchVenues();
      return;
    }

    set({ loading: true, error: null });

    try {
      const { data, error } = await supabase
        .from('venues')
        .select('*')
        .or(`name.ilike.%${query}%,address.ilike.%${query}%`)
        .order('overall_rating', { ascending: false })
        .limit(20);

      if (!error && data) {
        set({ venues: data as Venue[], loading: false });
      } else if (error) {
        set({ venues: [], error: error.message, loading: false });
      } else {
        set({ loading: false });
      }
    } catch (err: any) {
      set({
        venues: [],
        error: err?.message || 'Arama sirasinda hata olustu',
        loading: false,
      });
    }
  },

  addVenue: async (venue) => {
    // Upload cover image if it's a local URI
    let coverUrl = venue.cover_image_url;
    if (coverUrl && (coverUrl.startsWith('file://') || coverUrl.startsWith('ph://'))) {
      const { url } = await uploadImage(coverUrl, 'venues');
      coverUrl = url || null; // Don't store local file:// URI if upload fails
    }

    const { data, error } = await supabase
      .from('venues')
      .insert({
        ...venue,
        cover_image_url: coverUrl,
        avg_taste_rating: 0,
        avg_value_rating: 0,
        avg_friendliness_rating: 0,
        overall_rating: 0,
        total_reviews: 0,
        level: 1,
      })
      .select()
      .single();

    if (!error && data) {
      const venues = get().venues;
      set({ venues: [data as Venue, ...venues] });
      // Badge check and XP (fire-and-forget)
      if (venue.created_by) {
        checkAndAwardBadges(venue.created_by);
        addXP(venue.created_by, 15);
      }
      return { data: data as Venue, error: null };
    }

    return { data: null, error: error?.message || 'Mekan eklenirken hata olustu' };
  },

  addReview: async (review) => {
    const { error } = await supabase.from('reviews').insert(review);

    if (!error) {
      // Mekan ortalamalarini guncelle — fetch all reviews and compute client-side
      {
        const { data: reviews } = await supabase
          .from('reviews')
          .select('taste_rating, value_rating, friendliness_rating')
          .eq('venue_id', review.venue_id);

        if (reviews && reviews.length > 0) {
          const avgTaste = reviews.reduce((sum, r) => sum + r.taste_rating, 0) / reviews.length;
          const avgValue = reviews.reduce((sum, r) => sum + r.value_rating, 0) / reviews.length;
          const avgFriendliness = reviews.reduce((sum, r) => sum + r.friendliness_rating, 0) / reviews.length;
          const overall = (avgTaste + avgValue + avgFriendliness) / 3;

          let level = 1;
          if (reviews.length >= 50) level = 4;
          else if (reviews.length >= 15) level = 3;
          else if (reviews.length >= 5) level = 2;

          await supabase.from('venues').update({
            avg_taste_rating: Math.round(avgTaste * 10) / 10,
            avg_value_rating: Math.round(avgValue * 10) / 10,
            avg_friendliness_rating: Math.round(avgFriendliness * 10) / 10,
            overall_rating: Math.round(overall * 10) / 10,
            total_reviews: reviews.length,
            level,
          }).eq('id', review.venue_id);
        }
      }

      await get().fetchReviews(review.venue_id);

      // Badge check and XP (fire-and-forget)
      checkAndAwardBadges(review.user_id);
      addXP(review.user_id, 10);
    }

    return { error: error?.message || null };
  },

  toggleFavorite: async (venueId, userId) => {
    const previousFavorites = new Set(get().favoriteVenueIds);
    const wasFavorited = previousFavorites.has(venueId);

    // Optimistic update: toggle immediately for instant UI feedback
    const updatedFavorites = new Set(previousFavorites);
    if (wasFavorited) {
      updatedFavorites.delete(venueId);
      haptic.light();
    } else {
      updatedFavorites.add(venueId);
      haptic.success();
    }
    set({ favoriteVenueIds: updatedFavorites });

    try {
      if (wasFavorited) {
        const { error } = await supabase.from('favorites').delete().eq('venue_id', venueId).eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('favorites').insert({ venue_id: venueId, user_id: userId });
        if (error) throw error;
      }
    } catch {
      // Rollback optimistic update on failure
      set({ favoriteVenueIds: previousFavorites });
    }
  },

  isFavorite: (venueId) => {
    return get().favoriteVenueIds.has(venueId);
  },

  fetchNearbyScrapedWithCount: async (lat, lng, latDelta, lngDelta) => {
    // Fetch 3x the viewport so panning has pre-loaded buffer in all directions
    const halfLat = latDelta * 1.5;
    const halfLng = lngDelta * 1.5;

    try {
      const { data, count } = await supabase
        .from('venues')
        .select('*', { count: 'exact' })
        .eq('source', 'scraped')
        .gte('latitude', lat - halfLat)
        .lte('latitude', lat + halfLat)
        .gte('longitude', lng - halfLng)
        .lte('longitude', lng + halfLng)
        .limit(500);

      set({
        nearbyScrapedVenues: (data as Venue[]) || [],
        nearbyScrapedCount: count ?? 0,
      });
    } catch {
      // Silent fail — scraped venues are supplementary
    }
  },

  fetchNearbyScraped: async (lat, lng, latDelta, lngDelta) => {
    await get().fetchNearbyScrapedWithCount(lat, lng, latDelta, lngDelta);
  },

  countNearbyScraped: async (lat, lng, latDelta, lngDelta) => {
    await get().fetchNearbyScrapedWithCount(lat, lng, latDelta, lngDelta);
  },

  setFilters: (filters) => {
    set({ filters });
    if (filterFetchTimer) {
      clearTimeout(filterFetchTimer);
    }
    filterFetchTimer = setTimeout(() => {
      get().fetchVenues();
    }, 400);
  },

  clearError: () => set({ error: null }),
}));
