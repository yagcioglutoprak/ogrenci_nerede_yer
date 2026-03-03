import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Venue, Review, VenueFilters } from '../types';
import { MOCK_VENUES, MOCK_REVIEWS, MOCK_USERS } from '../lib/mockData';

const PAGE_SIZE = 30;

interface VenueState {
  venues: Venue[];
  selectedVenue: Venue | null;
  reviews: Review[];
  filters: VenueFilters;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;

  fetchVenues: (region?: { lat: number; lng: number; radius: number }) => Promise<void>;
  fetchMoreVenues: () => Promise<void>;
  fetchVenueById: (id: string) => Promise<void>;
  fetchReviews: (venueId: string) => Promise<void>;
  searchVenues: (query: string) => Promise<void>;
  addVenue: (venue: Omit<Venue, 'id' | 'created_at' | 'avg_taste_rating' | 'avg_value_rating' | 'avg_friendliness_rating' | 'overall_rating' | 'total_reviews' | 'level'>) => Promise<{ data: Venue | null; error: string | null }>;
  addReview: (review: Omit<Review, 'id' | 'created_at'>) => Promise<{ error: string | null }>;
  toggleFavorite: (venueId: string, userId: string) => Promise<void>;
  setFilters: (filters: VenueFilters) => void;
  clearError: () => void;
}

/**
 * Apply venue filters to a list of venues (used for mock data fallback).
 */
function applyFiltersToMockVenues(venues: Venue[], filters: VenueFilters): Venue[] {
  let filtered = [...venues];

  if (filters.minRating) {
    filtered = filtered.filter((v) => v.overall_rating >= filters.minRating!);
  }
  if (filters.priceRange && filters.priceRange.length > 0) {
    filtered = filtered.filter((v) => filters.priceRange!.includes(v.price_range));
  }
  if (filters.isVerified) {
    filtered = filtered.filter((v) => v.is_verified);
  }
  if (filters.tags && filters.tags.length > 0) {
    filtered = filtered.filter((v) => v.tags.some((t) => filters.tags!.includes(t)));
  }
  if (filters.searchQuery && filters.searchQuery.trim()) {
    const q = filters.searchQuery.toLowerCase();
    filtered = filtered.filter(
      (v) =>
        v.name.toLowerCase().includes(q) ||
        v.address.toLowerCase().includes(q),
    );
  }

  // Sort by rating descending (matches the Supabase query default)
  filtered.sort((a, b) => b.overall_rating - a.overall_rating);

  return filtered;
}

export const useVenueStore = create<VenueState>((set, get) => ({
  venues: [],
  selectedVenue: null,
  reviews: [],
  filters: {},
  loading: false,
  loadingMore: false,
  hasMore: true,
  error: null,

  fetchVenues: async (region) => {
    set({ loading: true, error: null });

    try {
      let query = supabase.from('venues').select('*');
      const filters = get().filters;

      if (filters.minRating) {
        query = query.gte('overall_rating', filters.minRating);
      }
      if (filters.priceRange && filters.priceRange.length > 0) {
        query = query.in('price_range', filters.priceRange);
      }
      if (filters.isVerified) {
        query = query.eq('is_verified', true);
      }
      if (filters.searchQuery && filters.searchQuery.trim()) {
        query = query.or(
          `name.ilike.%${filters.searchQuery}%,address.ilike.%${filters.searchQuery}%`,
        );
      }

      const { data, error } = await query
        .order('overall_rating', { ascending: false })
        .range(0, PAGE_SIZE - 1);

      if (!error && data && data.length > 0) {
        set({ venues: data as Venue[], hasMore: data.length >= PAGE_SIZE });
      } else {
        // Fallback to mock data when Supabase returns empty or error
        const mockFiltered = applyFiltersToMockVenues(MOCK_VENUES, filters);
        set({ venues: mockFiltered, hasMore: false });
      }
    } catch (err: any) {
      const mockFiltered = applyFiltersToMockVenues(MOCK_VENUES, get().filters);
      set({
        venues: mockFiltered,
        hasMore: false,
        error: err?.message || 'Mekanlar yuklenirken hata olustu',
      });
    }

    set({ loading: false });
  },

  fetchMoreVenues: async () => {
    const { venues, loadingMore, hasMore } = get();
    if (loadingMore || !hasMore) return;

    set({ loadingMore: true });
    const from = venues.length;
    const to = from + PAGE_SIZE - 1;

    try {
      let query = supabase.from('venues').select('*');
      const filters = get().filters;

      if (filters.minRating) {
        query = query.gte('overall_rating', filters.minRating);
      }
      if (filters.priceRange && filters.priceRange.length > 0) {
        query = query.in('price_range', filters.priceRange);
      }
      if (filters.isVerified) {
        query = query.eq('is_verified', true);
      }
      if (filters.searchQuery && filters.searchQuery.trim()) {
        query = query.or(
          `name.ilike.%${filters.searchQuery}%,address.ilike.%${filters.searchQuery}%`,
        );
      }

      const { data, error } = await query
        .order('overall_rating', { ascending: false })
        .range(from, to);

      if (!error && data && data.length > 0) {
        set({
          venues: [...venues, ...(data as Venue[])],
          hasMore: data.length >= PAGE_SIZE,
        });
      } else {
        set({ hasMore: false });
      }
    } catch {
      set({ hasMore: false });
    }

    set({ loadingMore: false });
  },

  fetchVenueById: async (id) => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('venues')
      .select('*')
      .eq('id', id)
      .single();

    if (!error && data) {
      set({ selectedVenue: data as Venue });
    } else {
      // Fallback: find venue from mock data
      const mockVenue = MOCK_VENUES.find((v) => v.id === id) || null;
      set({ selectedVenue: mockVenue });
    }
    set({ loading: false });
  },

  fetchReviews: async (venueId) => {
    const { data, error } = await supabase
      .from('reviews')
      .select('*, user:users(*)')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false });

    if (!error && data && data.length > 0) {
      set({ reviews: data as Review[] });
    } else {
      // Fallback: filter mock reviews for this venue and join user data
      const mockReviews = MOCK_REVIEWS
        .filter((r) => r.venue_id === venueId)
        .map((r) => ({
          ...r,
          user: MOCK_USERS.find((u) => u.id === r.user_id),
        }))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      set({ reviews: mockReviews as Review[] });
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

      if (!error && data && data.length > 0) {
        set({ venues: data as Venue[] });
      } else {
        // Fallback: search mock data
        const q = query.toLowerCase();
        const mockResults = MOCK_VENUES.filter(
          (v) =>
            v.name.toLowerCase().includes(q) ||
            v.address.toLowerCase().includes(q),
        );
        set({ venues: mockResults });
      }
    } catch (err: any) {
      const q = query.toLowerCase();
      const mockResults = MOCK_VENUES.filter(
        (v) =>
          v.name.toLowerCase().includes(q) ||
          v.address.toLowerCase().includes(q),
      );
      set({
        venues: mockResults,
        error: err?.message || 'Arama sirasinda hata olustu',
      });
    }

    set({ loading: false });
  },

  addVenue: async (venue) => {
    const { data, error } = await supabase
      .from('venues')
      .insert({
        ...venue,
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
      return { data: data as Venue, error: null };
    }

    return { data: null, error: error?.message || 'Mekan eklenirken hata olustu' };
  },

  addReview: async (review) => {
    const { error } = await supabase.from('reviews').insert(review);

    if (!error) {
      // Mekan ortalamalarini guncelle
      const { data: reviews } = await supabase
        .from('reviews')
        .select('taste_rating, value_rating, friendliness_rating')
        .eq('venue_id', review.venue_id);

      if (reviews && reviews.length > 0) {
        const avgTaste = reviews.reduce((sum, r) => sum + r.taste_rating, 0) / reviews.length;
        const avgValue = reviews.reduce((sum, r) => sum + r.value_rating, 0) / reviews.length;
        const avgFriendliness = reviews.reduce((sum, r) => sum + r.friendliness_rating, 0) / reviews.length;
        const overall = (avgTaste + avgValue + avgFriendliness) / 3;

        // Level hesapla
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

      await get().fetchReviews(review.venue_id);
    }

    return { error: error?.message || null };
  },

  toggleFavorite: async (venueId, userId) => {
    const { data: existing } = await supabase
      .from('favorites')
      .select('*')
      .eq('venue_id', venueId)
      .eq('user_id', userId)
      .single();

    if (existing) {
      await supabase.from('favorites').delete().eq('venue_id', venueId).eq('user_id', userId);
    } else {
      await supabase.from('favorites').insert({ venue_id: venueId, user_id: userId });
    }
  },

  setFilters: (filters) => {
    set({ filters });
    get().fetchVenues();
  },

  clearError: () => set({ error: null }),
}));
