import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Venue, Review, VenueFilters } from '../types';

interface VenueState {
  venues: Venue[];
  selectedVenue: Venue | null;
  reviews: Review[];
  filters: VenueFilters;
  loading: boolean;

  fetchVenues: (region?: { lat: number; lng: number; radius: number }) => Promise<void>;
  fetchVenueById: (id: string) => Promise<void>;
  fetchReviews: (venueId: string) => Promise<void>;
  addVenue: (venue: Omit<Venue, 'id' | 'created_at' | 'avg_taste_rating' | 'avg_value_rating' | 'avg_friendliness_rating' | 'overall_rating' | 'total_reviews' | 'level'>) => Promise<{ data: Venue | null; error: string | null }>;
  addReview: (review: Omit<Review, 'id' | 'created_at'>) => Promise<{ error: string | null }>;
  toggleFavorite: (venueId: string, userId: string) => Promise<void>;
  setFilters: (filters: VenueFilters) => void;
}

export const useVenueStore = create<VenueState>((set, get) => ({
  venues: [],
  selectedVenue: null,
  reviews: [],
  filters: {},
  loading: false,

  fetchVenues: async (region) => {
    set({ loading: true });
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

    const { data, error } = await query.order('overall_rating', { ascending: false }).limit(100);

    if (!error && data) {
      set({ venues: data as Venue[] });
    }
    set({ loading: false });
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
    }
    set({ loading: false });
  },

  fetchReviews: async (venueId) => {
    const { data } = await supabase
      .from('reviews')
      .select('*, user:users(*)')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false });

    if (data) {
      set({ reviews: data as Review[] });
    }
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

    return { data: null, error: error?.message || 'Mekan eklenirken hata oluştu' };
  },

  addReview: async (review) => {
    const { error } = await supabase.from('reviews').insert(review);

    if (!error) {
      // Mekan ortalamalarını güncelle
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
}));
