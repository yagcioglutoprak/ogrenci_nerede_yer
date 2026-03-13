import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface BlockState {
  blockedUsers: string[];
  loading: boolean;

  fetchBlockedUsers: (userId: string) => Promise<void>;
  blockUser: (blockerId: string, blockedId: string) => Promise<void>;
  unblockUser: (blockerId: string, blockedId: string) => Promise<void>;
  isBlocked: (userId: string) => boolean;
  checkBlockedBetween: (userA: string, userB: string) => Promise<boolean>;
}

export const useBlockStore = create<BlockState>((set, get) => ({
  blockedUsers: [],
  loading: false,

  fetchBlockedUsers: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_blocks')
        .select('blocked_id')
        .eq('blocker_id', userId);

      if (error) throw error;
      set({ blockedUsers: (data || []).map((b) => b.blocked_id) });
    } catch {
      set({ blockedUsers: [] });
    }
  },

  blockUser: async (blockerId, blockedId) => {
    // Optimistic update
    set({ blockedUsers: [...get().blockedUsers, blockedId] });

    try {
      // Insert block
      await supabase
        .from('user_blocks')
        .insert({ blocker_id: blockerId, blocked_id: blockedId });

      // Remove mutual follows
      await supabase
        .from('follows')
        .delete()
        .or(`and(follower_id.eq.${blockerId},following_id.eq.${blockedId}),and(follower_id.eq.${blockedId},following_id.eq.${blockerId})`);

      // Reject any conversation between the two
      const [p1, p2] = blockerId < blockedId ? [blockerId, blockedId] : [blockedId, blockerId];
      await supabase
        .from('conversations')
        .update({ status: 'rejected' })
        .eq('participant_1', p1)
        .eq('participant_2', p2);
    } catch {
      // Rollback optimistic update
      set({ blockedUsers: get().blockedUsers.filter((id) => id !== blockedId) });
    }
  },

  unblockUser: async (blockerId, blockedId) => {
    // Optimistic update
    set({ blockedUsers: get().blockedUsers.filter((id) => id !== blockedId) });

    try {
      await supabase
        .from('user_blocks')
        .delete()
        .eq('blocker_id', blockerId)
        .eq('blocked_id', blockedId);
    } catch {
      // Rollback
      set({ blockedUsers: [...get().blockedUsers, blockedId] });
    }
  },

  isBlocked: (userId) => {
    return get().blockedUsers.includes(userId);
  },

  checkBlockedBetween: async (userA, userB) => {
    try {
      const { data, error } = await supabase.rpc('is_blocked_between', {
        user_a: userA,
        user_b: userB,
      });
      if (error) throw error;
      return data as boolean;
    } catch {
      return false;
    }
  },
}));
