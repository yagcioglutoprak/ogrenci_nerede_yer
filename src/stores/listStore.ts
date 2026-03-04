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
}

export const useListStore = create<ListState>((set, get) => ({
  lists: [],
  userLists: [],
  selectedList: null,
  loading: false,
  error: null,

  fetchPopularLists: async () => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('lists')
        .select('*, user:users(*)')
        .eq('is_public', true)
        .order('likes_count', { ascending: false })
        .limit(10);

      if (!error && data) {
        set({ lists: data as List[] });
      }
    } catch {}
    set({ loading: false });
  },

  fetchUserLists: async (userId) => {
    try {
      const { data } = await supabase
        .from('lists')
        .select('*, venues:list_venues(*, venue:venues(*))')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (data) set({ userLists: data as List[] });
    } catch {}
  },

  fetchListById: async (id) => {
    set({ loading: true });
    try {
      const { data } = await supabase
        .from('lists')
        .select('*, user:users(*), venues:list_venues(*, venue:venues(*))')
        .eq('id', id)
        .single();

      if (data) {
        if (data.venues) {
          (data.venues as any[]).sort((a: any, b: any) => a.position - b.position);
        }
        set({ selectedList: data as List });
      }
    } catch {}
    set({ loading: false });
  },

  createList: async ({ title, description, cover_image_url, user_id }) => {
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
    } catch {
      return null;
    }
  },

  deleteList: async (id) => {
    await supabase.from('lists').delete().eq('id', id);
    set({ userLists: get().userLists.filter(l => l.id !== id) });
  },

  addVenueToList: async (listId, venueId, note) => {
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
  },

  removeVenueFromList: async (listId, venueId) => {
    await supabase.from('list_venues').delete().eq('list_id', listId).eq('venue_id', venueId);
  },

  toggleListLike: async (listId, userId) => {
    try {
      const { data: existing } = await supabase
        .from('list_likes')
        .select('*')
        .eq('list_id', listId)
        .eq('user_id', userId)
        .single();

      if (existing) {
        await supabase.from('list_likes').delete().eq('list_id', listId).eq('user_id', userId);
        const { data: list } = await supabase.from('lists').select('likes_count').eq('id', listId).single();
        if (list) await supabase.from('lists').update({ likes_count: Math.max(0, (list.likes_count || 0) - 1) }).eq('id', listId);
        return false;
      } else {
        await supabase.from('list_likes').insert({ list_id: listId, user_id: userId });
        const { data: list } = await supabase.from('lists').select('likes_count').eq('id', listId).single();
        if (list) await supabase.from('lists').update({ likes_count: (list.likes_count || 0) + 1 }).eq('id', listId);
        return true;
      }
    } catch { return null; }
  },

  toggleListFollow: async (listId, userId) => {
    try {
      const { data: existing } = await supabase
        .from('list_follows')
        .select('*')
        .eq('list_id', listId)
        .eq('user_id', userId)
        .single();

      if (existing) {
        await supabase.from('list_follows').delete().eq('list_id', listId).eq('user_id', userId);
        const { data: list } = await supabase.from('lists').select('followers_count').eq('id', listId).single();
        if (list) await supabase.from('lists').update({ followers_count: Math.max(0, (list.followers_count || 0) - 1) }).eq('id', listId);
        return false;
      } else {
        await supabase.from('list_follows').insert({ list_id: listId, user_id: userId });
        const { data: list } = await supabase.from('lists').select('followers_count').eq('id', listId).single();
        if (list) await supabase.from('lists').update({ followers_count: (list.followers_count || 0) + 1 }).eq('id', listId);
        return true;
      }
    } catch { return null; }
  },
}));
