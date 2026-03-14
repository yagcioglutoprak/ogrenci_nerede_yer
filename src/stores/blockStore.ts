import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface BlockState {
  blockedUsers: string[];
  blockedUserSet: Set<string>;
  loading: boolean;

  fetchBlockedUsers: (userId: string) => Promise<void>;
  blockUser: (blockerId: string, blockedId: string) => Promise<void>;
  unblockUser: (blockerId: string, blockedId: string) => Promise<void>;
  isBlocked: (userId: string) => boolean;
  checkBlockedBetween: (userA: string, userB: string) => Promise<boolean>;
}

export const useBlockStore = create<BlockState>((set, get) => ({
  blockedUsers: [],
  blockedUserSet: new Set<string>(),
  loading: false,

  fetchBlockedUsers: async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_blocks')
        .select('blocked_id')
        .eq('blocker_id', userId);

      if (error) throw error;
      const ids = (data || []).map((b) => b.blocked_id);
      set({ blockedUsers: ids, blockedUserSet: new Set(ids) });
    } catch {
      set({ blockedUsers: [], blockedUserSet: new Set() });
    }
  },

  blockUser: async (blockerId, blockedId) => {
    // Optimistic update
    const prevUsers = get().blockedUsers;
    const newUsers = [...prevUsers, blockedId];
    set({ blockedUsers: newUsers, blockedUserSet: new Set(newUsers) });

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
      set({ blockedUsers: prevUsers, blockedUserSet: new Set(prevUsers) });
    }
  },

  unblockUser: async (blockerId, blockedId) => {
    // Optimistic update
    const prevUsers = get().blockedUsers;
    const newUsers = prevUsers.filter((id) => id !== blockedId);
    set({ blockedUsers: newUsers, blockedUserSet: new Set(newUsers) });

    try {
      await supabase
        .from('user_blocks')
        .delete()
        .eq('blocker_id', blockerId)
        .eq('blocked_id', blockedId);
    } catch {
      // Rollback
      set({ blockedUsers: prevUsers, blockedUserSet: new Set(prevUsers) });
    }
  },

  isBlocked: (userId) => {
    return get().blockedUserSet.has(userId);
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
