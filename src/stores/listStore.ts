import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { checkAndAwardBadges, addXP } from '../lib/badgeChecker';
import type { List, ListVenue } from '../types';

interface ListState {
  lists: List[];
  userLists: List[];
  selectedList: List | null;
  loading: boolean;
  error: string | null;

  fetchPopularLists: () => Promise<void>;
  fetchUserLists: (userId: string) => Promise<void>;
  fetchListById: (id: string) => Promise<void>;
  createList: (data: { title: string; description?: string; cover_image_url?: string; user_id: string }) => Promise<List | null>;
  deleteList: (id: string) => Promise<void>;
  addVenueToList: (listId: string, venueId: string, note?: string) => Promise<void>;
  removeVenueFromList: (listId: string, venueId: string) => Promise<void>;
  toggleListLike: (listId: string, userId: string) => Promise<boolean | null>;
  toggleListFollow: (listId: string, userId: string) => Promise<boolean | null>;
  clearError: () => void;
}

export const useListStore = create<ListState>((set, get) => ({
  lists: [],
  userLists: [],
  selectedList: null,
  loading: false,
  error: null,

  clearError: () => set({ error: null }),

  fetchPopularLists: async () => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('lists')
        .select('*, user:users(*)')
        .eq('is_public', true)
        .order('likes_count', { ascending: false })
        .limit(10);

      if (!error && data) {
        set({ lists: data as List[] });
      } else if (error) {
        set({ error: error.message });
      }
    } catch (err: any) {
      set({ error: err?.message || 'Populer listeler yuklenirken hata olustu' });
    }
    set({ loading: false });
  },

  fetchUserLists: async (userId) => {
    set({ error: null });
    try {
      const { data, error } = await supabase
        .from('lists')
        .select('*, venues:list_venues(*, venue:venues(*))')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        set({ userLists: data as List[] });
      } else if (error) {
        set({ error: error.message });
      }
    } catch (err: any) {
      set({ error: err?.message || 'Kullanici listeleri yuklenirken hata olustu' });
    }
  },

  fetchListById: async (id) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('lists')
        .select('*, user:users(*), venues:list_venues(*, venue:venues(*))')
        .eq('id', id)
        .single();

      if (!error && data) {
        if (data.venues) {
          (data.venues as any[]).sort((a: any, b: any) => a.position - b.position);
        }
        set({ selectedList: data as List });
      } else if (error) {
        set({ error: error.message });
      }
    } catch (err: any) {
      set({ error: err?.message || 'Liste detayi yuklenirken hata olustu' });
    }
    set({ loading: false });
  },

  createList: async ({ title, description, cover_image_url, user_id }) => {
    set({ error: null });
    try {
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const { data, error } = await supabase
        .from('lists')
        .insert({ title, description, cover_image_url, user_id, slug: `${slug}-${Date.now()}` })
        .select('*, user:users(*)')
        .single();

      if (error) throw error;

      addXP(user_id, 10).catch(() => {});
      checkAndAwardBadges(user_id).catch(() => {});

      const list = data as List;
      set({ userLists: [list, ...get().userLists] });
      return list;
    } catch (err: any) {
      set({ error: err?.message || 'Liste olusturulurken hata olustu' });
      return null;
    }
  },

  deleteList: async (id) => {
    try {
      await supabase.from('lists').delete().eq('id', id);
      set({ userLists: get().userLists.filter(l => l.id !== id) });
    } catch {
      // Still remove locally even if Supabase fails
      set({ userLists: get().userLists.filter(l => l.id !== id) });
    }
  },

  addVenueToList: async (listId, venueId, note) => {
    try {
      const { data: existing } = await supabase
        .from('list_venues')
        .select('position')
        .eq('list_id', listId)
        .order('position', { ascending: false })
        .limit(1);

      const nextPosition = existing?.length ? existing[0].position + 1 : 0;

      await supabase.from('list_venues').insert({
        list_id: listId,
        venue_id: venueId,
        position: nextPosition,
        note,
      });
    } catch {
      // Non-critical — venue may not appear in list until refresh
    }
  },

  removeVenueFromList: async (listId, venueId) => {
    try {
      await supabase.from('list_venues').delete().eq('list_id', listId).eq('venue_id', venueId);
    } catch {
      // Non-critical
    }
  },

  toggleListLike: async (listId, userId) => {
    const previousSelectedList = get().selectedList;

    try {
      const { data: existing } = await supabase
        .from('list_likes')
        .select('*')
        .eq('list_id', listId)
        .eq('user_id', userId)
        .single();

      const isUnliking = !!existing;
      const currentCount = get().selectedList?.likes_count ?? 0;
      const newCount = isUnliking ? Math.max(0, currentCount - 1) : currentCount + 1;

      // Optimistic update: update local selectedList immediately
      const selectedList = get().selectedList;
      if (selectedList && selectedList.id === listId) {
        set({ selectedList: { ...selectedList, likes_count: newCount } });
      }
      // Also update in lists array
      set({
        lists: get().lists.map(l => l.id === listId ? { ...l, likes_count: newCount } : l),
      });

      if (isUnliking) {
        await supabase.from('list_likes').delete().eq('list_id', listId).eq('user_id', userId);
        await supabase.from('lists').update({ likes_count: newCount }).eq('id', listId);
        return false;
      } else {
        await supabase.from('list_likes').insert({ list_id: listId, user_id: userId });
        await supabase.from('lists').update({ likes_count: newCount }).eq('id', listId);
        return true;
      }
    } catch (err: any) {
      // Rollback optimistic update on failure
      if (previousSelectedList && previousSelectedList.id === listId) {
        set({ selectedList: previousSelectedList });
      }
      set({ error: err?.message || 'Liste begenilirken hata olustu' });
      return null;
    }
  },

  toggleListFollow: async (listId, userId) => {
    const previousSelectedList = get().selectedList;

    try {
      const { data: existing } = await supabase
        .from('list_follows')
        .select('*')
        .eq('list_id', listId)
        .eq('user_id', userId)
        .single();

      const isUnfollowing = !!existing;
      const currentCount = get().selectedList?.followers_count ?? 0;
      const newCount = isUnfollowing ? Math.max(0, currentCount - 1) : currentCount + 1;

      // Optimistic update: update local selectedList immediately
      const selectedList = get().selectedList;
      if (selectedList && selectedList.id === listId) {
        set({ selectedList: { ...selectedList, followers_count: newCount } });
      }
      // Also update in lists array
      set({
        lists: get().lists.map(l => l.id === listId ? { ...l, followers_count: newCount } : l),
      });

      if (isUnfollowing) {
        await supabase.from('list_follows').delete().eq('list_id', listId).eq('user_id', userId);
        await supabase.from('lists').update({ followers_count: newCount }).eq('id', listId);
        return false;
      } else {
        await supabase.from('list_follows').insert({ list_id: listId, user_id: userId });
        await supabase.from('lists').update({ followers_count: newCount }).eq('id', listId);
        return true;
      }
    } catch (err: any) {
      // Rollback optimistic update on failure
      if (previousSelectedList && previousSelectedList.id === listId) {
        set({ selectedList: previousSelectedList });
      }
      set({ error: err?.message || 'Liste takip edilirken hata olustu' });
      return null;
    }
  },
}));
