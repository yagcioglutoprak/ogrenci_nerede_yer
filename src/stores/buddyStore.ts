import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { checkAndAwardBadges, addXP } from '../lib/badgeChecker';
import { sendPushNotification } from '../lib/notifications';
import type { MealBuddy, BuddyMatch, BuddyMessage } from '../types';

// Sender profile cache to avoid re-fetching the same user on every incoming message
const buddySenderProfileCache = new Map<string, any>();

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
  goAvailable: (data: { user_id: string; latitude: number; longitude: number; available_from: string; available_until: string; note?: string; radius_km?: number }) => Promise<MealBuddy | null>;
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
    try {
      const { data } = await supabase
        .from('meal_buddies')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'available')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      set({ myBuddy: data as MealBuddy | null });
    } catch {
      // Keep current myBuddy state on error
    }
  },

  goAvailable: async ({ user_id, latitude, longitude, available_from, available_until, note, radius_km }) => {
    set({ loading: true });
    const radiusValue = radius_km ?? 3;
    try {
      await supabase.from('meal_buddies').update({ status: 'expired' }).eq('user_id', user_id).eq('status', 'available');

      const { data, error } = await supabase
        .from('meal_buddies')
        .insert({ user_id, latitude, longitude, available_from, available_until, note, radius_km: radiusValue, status: 'available' })
        .select('*')
        .single();

      if (error) throw error;
      const buddy = data as MealBuddy;
      set({ myBuddy: buddy, loading: false });
      return buddy;
    } catch {
      set({ loading: false });
      return null;
    }
  },

  goUnavailable: async () => {
    const { myBuddy } = get();
    if (myBuddy) {
      try {
        await supabase
          .from('buddy_matches')
          .update({ status: 'expired' })
          .eq('requester_buddy_id', myBuddy.id)
          .eq('status', 'pending');

        await supabase
          .from('buddy_matches')
          .update({ status: 'declined' })
          .eq('target_buddy_id', myBuddy.id)
          .eq('status', 'pending');

        await supabase.from('meal_buddies').update({ status: 'expired' }).eq('id', myBuddy.id);
      } catch {
        // Ignore Supabase errors, still clear local state
      }
      set({ myBuddy: null, nearbyBuddies: [], pendingMatches: [] });
    }
  },

  fetchNearbyBuddies: async (lat, lng) => {
    set({ loading: true });
    const { myBuddy: currentBuddy } = get();

    try {
      const delta = 0.045;
      const { data, error } = await supabase
        .from('meal_buddies')
        .select('*, user:users(*)')
        .eq('status', 'available')
        .gte('available_until', new Date().toISOString())
        .gte('latitude', lat - delta)
        .lte('latitude', lat + delta)
        .gte('longitude', lng - delta)
        .lte('longitude', lng + delta)
        .limit(20);

      if (error) throw error;

      const filtered = (data as MealBuddy[] || []).filter(b => b.id !== currentBuddy?.id);
      set({ nearbyBuddies: filtered, loading: false });
    } catch {
      set({ nearbyBuddies: [], loading: false });
    }
  },

  sendMatchRequest: async (targetBuddyId) => {
    const { myBuddy } = get();
    if (!myBuddy) return null;

    try {
      // Check for existing pending/accepted match
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
    } catch {
      return null;
    }
  },

  respondToMatch: async (matchId, accept) => {
    try {
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
        set({ pendingMatches: get().pendingMatches.filter(m => m.id !== matchId) });
      }
    } catch {
      // On error, still update local state
      set({ pendingMatches: get().pendingMatches.filter(m => m.id !== matchId) });
    }
  },

  fetchMessages: async (matchId) => {
    try {
      const { data } = await supabase
        .from('buddy_messages')
        .select('*, user:users(*)')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true });

      if (data) set({ messages: data as BuddyMessage[] });
    } catch {
      // Keep current messages on error
    }
  },

  sendMessage: async (matchId, senderId, content) => {
    try {
      await supabase.from('buddy_messages').insert({ match_id: matchId, sender_id: senderId, content });
    } catch {
      // Message send failed silently
    }
  },

  subscribeToMessages: (matchId) => {
    try {
      const channel = supabase
        .channel(`buddy-messages-${matchId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'buddy_messages',
          filter: `match_id=eq.${matchId}`,
        }, async (payload) => {
          const newMsg = payload.new as any;

          // Use sender profile cache to avoid re-fetching the same user repeatedly
          let userData = buddySenderProfileCache.get(newMsg.sender_id);
          if (!userData) {
            const { data } = await supabase.from('users').select('*').eq('id', newMsg.sender_id).single();
            userData = data || undefined;
            if (userData) {
              buddySenderProfileCache.set(newMsg.sender_id, userData);
            }
          }

          const message: BuddyMessage = { ...newMsg, user: userData };
          const { messages } = get();
          if (!messages.find(m => m.id === message.id)) {
            set({ messages: [...messages, message] });
          }
        })
        .subscribe();
      return channel;
    } catch {
      return null;
    }
  },

  rateBuddy: async (matchId, raterId, thumbsUp) => {
    try {
      await supabase.from('buddy_ratings').insert({ match_id: matchId, rater_id: raterId, rating: thumbsUp });
    } catch {
      // Ignore rating insert errors
    }
    addXP(raterId, 20).catch(() => {});
    checkAndAwardBadges(raterId).catch(() => {});
  },

  fetchActiveMatch: async (userId) => {
    try {
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
    } catch {
      // Keep current activeMatch on error
    }
  },

  fetchPendingMatches: async (userId) => {
    try {
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
    } catch {
      // Keep current pendingMatches on error
    }
  },

  subscribeToMatchUpdates: (userId) => {
    try {
      const handleMatchChange = async (payload: any) => {
          const match = payload.new as any;
          if (!match) return;

          const { myBuddy } = get();
          if (!myBuddy) return;
          // Skip events not related to this user's buddy
          if (match.requester_buddy_id !== myBuddy.id && match.target_buddy_id !== myBuddy.id) return;

          if (match.status === 'accepted') {
              const { data: fullMatch } = await supabase
                .from('buddy_matches')
                .select('*, requester:meal_buddies!requester_buddy_id(*, user:users(*)), target:meal_buddies!target_buddy_id(*, user:users(*))')
                .eq('id', match.id)
                .single();
              if (fullMatch) {
                set({ activeMatch: fullMatch as BuddyMatch, pendingMatches: [] });
              }
          }

          if (match.status === 'pending') {
            get().fetchPendingMatches(userId);
          }
      };

      const channel = supabase
        .channel(`buddy-match-updates-${userId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'buddy_matches',
        }, handleMatchChange)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'buddy_matches',
        }, handleMatchChange)
        .subscribe();
      return channel;
    } catch {
      return null;
    }
  },

  unsubscribeChannel: (channel) => {
    if (channel) {
      try {
        supabase.removeChannel(channel);
      } catch {
        // Ignore cleanup errors
      }
    }
  },

  setRatingDone: (val: boolean) => set({ ratingDone: val }),

  clearActiveSession: () => set({
    myBuddy: null,
    activeMatch: null,
    messages: [],
    pendingMatches: [],
    nearbyBuddies: [],
    ratingDone: false,
  }),
}));
