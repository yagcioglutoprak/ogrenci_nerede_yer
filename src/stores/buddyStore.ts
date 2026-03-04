import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { checkAndAwardBadges, addXP } from '../lib/badgeChecker';
import { sendPushNotification } from '../lib/notifications';
import type { MealBuddy, BuddyMatch, BuddyMessage } from '../types';

interface BuddyState {
  myBuddy: MealBuddy | null;
  nearbyBuddies: MealBuddy[];
  activeMatch: BuddyMatch | null;
  pendingMatches: BuddyMatch[];
  messages: BuddyMessage[];
  loading: boolean;
  error: string | null;
  ratingDone: boolean;

  fetchMyBuddy: (userId: string) => Promise<void>;
  goAvailable: (data: { user_id: string; latitude: number; longitude: number; available_from: string; available_until: string; note?: string }) => Promise<MealBuddy | null>;
  goUnavailable: () => Promise<void>;
  fetchNearbyBuddies: (lat: number, lng: number) => Promise<void>;
  sendMatchRequest: (targetBuddyId: string) => Promise<BuddyMatch | null>;
  respondToMatch: (matchId: string, accept: boolean) => Promise<void>;
  fetchMessages: (matchId: string) => Promise<void>;
  sendMessage: (matchId: string, senderId: string, content: string) => Promise<void>;
  subscribeToMessages: (matchId: string) => any;
  rateBuddy: (matchId: string, raterId: string, thumbsUp: boolean) => Promise<void>;
  fetchActiveMatch: (userId: string) => Promise<void>;
  fetchPendingMatches: (userId: string) => Promise<void>;
  subscribeToMatchUpdates: (userId: string) => any;
  unsubscribeChannel: (channel: any) => void;
  setRatingDone: (val: boolean) => void;
  clearActiveSession: () => void;
}

export const useBuddyStore = create<BuddyState>((set, get) => ({
  myBuddy: null,
  nearbyBuddies: [],
  activeMatch: null,
  pendingMatches: [],
  messages: [],
  loading: false,
  error: null,
  ratingDone: false,

  fetchMyBuddy: async (userId) => {
    const { data } = await supabase
      .from('meal_buddies')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'available')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    set({ myBuddy: data as MealBuddy | null });
  },

  goAvailable: async ({ user_id, latitude, longitude, available_from, available_until, note }) => {
    try {
      await supabase.from('meal_buddies').update({ status: 'expired' }).eq('user_id', user_id).eq('status', 'available');

      const { data, error } = await supabase
        .from('meal_buddies')
        .insert({ user_id, latitude, longitude, available_from, available_until, note, status: 'available' })
        .select('*')
        .single();

      if (error) throw error;
      const buddy = data as MealBuddy;
      set({ myBuddy: buddy });
      return buddy;
    } catch { return null; }
  },

  goUnavailable: async () => {
    const { myBuddy } = get();
    if (myBuddy) {
      // Expire pending matches where we're the requester
      await supabase
        .from('buddy_matches')
        .update({ status: 'expired' })
        .eq('requester_buddy_id', myBuddy.id)
        .eq('status', 'pending');

      // Decline pending matches where we're the target
      await supabase
        .from('buddy_matches')
        .update({ status: 'declined' })
        .eq('target_buddy_id', myBuddy.id)
        .eq('status', 'pending');

      await supabase.from('meal_buddies').update({ status: 'expired' }).eq('id', myBuddy.id);
      set({ myBuddy: null, pendingMatches: [] });
    }
  },

  fetchNearbyBuddies: async (lat, lng) => {
    set({ loading: true });
    try {
      const delta = 0.045;
      const { data } = await supabase
        .from('meal_buddies')
        .select('*, user:users(*)')
        .eq('status', 'available')
        .gte('available_until', new Date().toISOString())
        .gte('latitude', lat - delta)
        .lte('latitude', lat + delta)
        .gte('longitude', lng - delta)
        .lte('longitude', lng + delta)
        .limit(20);

      const { myBuddy: currentBuddy } = get();
      const filtered = (data as MealBuddy[] || []).filter(b => b.id !== currentBuddy?.id);
      if (filtered.length === 0) {
        // Try mock data fallback
        try {
          const { MOCK_BUDDIES } = await import('../lib/mockData');
          if (MOCK_BUDDIES?.length) {
            set({ nearbyBuddies: MOCK_BUDDIES.filter(b => b.id !== currentBuddy?.id) });
            set({ loading: false });
            return;
          }
        } catch {}
      }
      set({ nearbyBuddies: filtered });
    } catch {}
    set({ loading: false });
  },

  sendMatchRequest: async (targetBuddyId) => {
    try {
      const { myBuddy } = get();
      if (!myBuddy) return null;

      // Before inserting, check for existing pending/accepted match
      const { data: existing } = await supabase
        .from('buddy_matches')
        .select('id')
        .eq('requester_buddy_id', myBuddy.id)
        .eq('target_buddy_id', targetBuddyId)
        .in('status', ['pending', 'accepted'])
        .maybeSingle();

      if (existing) return null; // Already sent

      const { data, error } = await supabase
        .from('buddy_matches')
        .insert({ requester_buddy_id: myBuddy.id, target_buddy_id: targetBuddyId })
        .select('*')
        .single();

      if (error) throw error;

      const { data: targetBuddy } = await supabase
        .from('meal_buddies')
        .select('user_id')
        .eq('id', targetBuddyId)
        .single();

      if (targetBuddy) {
        sendPushNotification(
          targetBuddy.user_id,
          'Yemek Arkadasi Istegi!',
          'Birisi seninle yemek yemek istiyor!',
          { route: '/buddy' }
        ).catch(() => {});
      }

      return data as BuddyMatch;
    } catch { return null; }
  },

  respondToMatch: async (matchId, accept) => {
    const newStatus = accept ? 'accepted' : 'declined';
    await supabase.from('buddy_matches').update({ status: newStatus }).eq('id', matchId);

    if (accept) {
      const { data: match } = await supabase
        .from('buddy_matches')
        .select('*, requester:meal_buddies!requester_buddy_id(*, user:users(*)), target:meal_buddies!target_buddy_id(*, user:users(*))')
        .eq('id', matchId)
        .single();

      if (match) {
        await supabase.from('meal_buddies').update({ status: 'matched' }).in('id', [match.requester_buddy_id, match.target_buddy_id]);
        set({ activeMatch: match as BuddyMatch, pendingMatches: get().pendingMatches.filter(m => m.id !== matchId) });
      }
    } else {
      // Remove declined match from pending
      set({ pendingMatches: get().pendingMatches.filter(m => m.id !== matchId) });
    }
  },

  fetchMessages: async (matchId) => {
    const { data } = await supabase
      .from('buddy_messages')
      .select('*, user:users(*)')
      .eq('match_id', matchId)
      .order('created_at', { ascending: true });

    if (data) set({ messages: data as BuddyMessage[] });
  },

  sendMessage: async (matchId, senderId, content) => {
    await supabase.from('buddy_messages').insert({ match_id: matchId, sender_id: senderId, content });
  },

  subscribeToMessages: (matchId) => {
    const channel = supabase
      .channel(`buddy-messages-${matchId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'buddy_messages',
        filter: `match_id=eq.${matchId}`,
      }, async (payload) => {
        const newMsg = payload.new as any;
        const { data: userData } = await supabase.from('users').select('*').eq('id', newMsg.sender_id).single();
        const message: BuddyMessage = { ...newMsg, user: userData || undefined };
        const { messages } = get();
        if (!messages.find(m => m.id === message.id)) {
          set({ messages: [...messages, message] });
        }
      })
      .subscribe();
    return channel;
  },

  rateBuddy: async (matchId, raterId, thumbsUp) => {
    await supabase.from('buddy_ratings').insert({ match_id: matchId, rater_id: raterId, rating: thumbsUp });
    addXP(raterId, 20).catch(() => {});
    checkAndAwardBadges(raterId).catch(() => {});
  },

  fetchActiveMatch: async (userId) => {
    const { data: myBuddies } = await supabase
      .from('meal_buddies')
      .select('id')
      .eq('user_id', userId)
      .in('status', ['available', 'matched']);

    if (!myBuddies?.length) { set({ activeMatch: null }); return; }

    const buddyIds = myBuddies.map(b => b.id);
    const { data: match } = await supabase
      .from('buddy_matches')
      .select('*, requester:meal_buddies!requester_buddy_id(*, user:users(*)), target:meal_buddies!target_buddy_id(*, user:users(*))')
      .eq('status', 'accepted')
      .or(`requester_buddy_id.in.(${buddyIds.join(',')}),target_buddy_id.in.(${buddyIds.join(',')})`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    set({ activeMatch: match as BuddyMatch | null });
  },

  fetchPendingMatches: async (userId) => {
    // Get user's available buddy IDs
    const { data: myBuddies } = await supabase
      .from('meal_buddies')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'available');

    if (!myBuddies?.length) { set({ pendingMatches: [] }); return; }

    const buddyIds = myBuddies.map(b => b.id);
    const { data } = await supabase
      .from('buddy_matches')
      .select('*, requester:meal_buddies!requester_buddy_id(*, user:users(*)), target:meal_buddies!target_buddy_id(*, user:users(*))')
      .eq('status', 'pending')
      .in('target_buddy_id', buddyIds)
      .order('created_at', { ascending: false });

    set({ pendingMatches: (data as BuddyMatch[]) || [] });
  },

  subscribeToMatchUpdates: (userId) => {
    const channel = supabase
      .channel(`buddy-match-updates-${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'buddy_matches',
      }, async (payload) => {
        const match = payload.new as any;
        if (!match) return;

        // If a match was accepted, check if we're involved and set activeMatch
        if (match.status === 'accepted') {
          const { myBuddy } = get();
          if (myBuddy && (match.requester_buddy_id === myBuddy.id || match.target_buddy_id === myBuddy.id)) {
            // Fetch full match with joins
            const { data: fullMatch } = await supabase
              .from('buddy_matches')
              .select('*, requester:meal_buddies!requester_buddy_id(*, user:users(*)), target:meal_buddies!target_buddy_id(*, user:users(*))')
              .eq('id', match.id)
              .single();
            if (fullMatch) {
              set({ activeMatch: fullMatch as BuddyMatch, pendingMatches: [] });
            }
          }
        }

        // If new pending match, refresh pending list
        if (match.status === 'pending') {
          get().fetchPendingMatches(userId);
        }
      })
      .subscribe();
    return channel;
  },

  unsubscribeChannel: (channel) => {
    if (channel) supabase.removeChannel(channel);
  },

  setRatingDone: (val: boolean) => set({ ratingDone: val }),

  clearActiveSession: () => set({
    myBuddy: null,
    activeMatch: null,
    messages: [],
    pendingMatches: [],
    ratingDone: false,
  }),
}));
