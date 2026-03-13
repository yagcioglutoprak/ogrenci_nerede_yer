import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { sendPushNotification } from '../lib/notifications';
import type { Conversation, DirectMessage, DirectMessageType, DirectMessageMetadata, MessageStatus, User } from '../types';

function isMockId(id: string): boolean {
  return id.startsWith('local-') || id.startsWith('mock-') || id.startsWith('conv-') || id.startsWith('u-') || id.startsWith('dm-');
}

interface MessageState {
  conversations: Conversation[];
  messages: DirectMessage[];
  messageRequests: Conversation[];
  requestCount: number;
  totalUnreadCount: number;
  loading: boolean;

  fetchConversations: (userId: string) => Promise<void>;
  fetchOrCreateConversation: (myId: string, otherId: string) => Promise<string | null>;
  fetchMessages: (conversationId: string) => Promise<void>;
  sendMessage: (convId: string, senderId: string, content: string, otherUserId: string, messageType?: DirectMessageType, metadata?: DirectMessageMetadata) => Promise<void>;
  searchUsers: (query: string, currentUserId: string) => Promise<Array<User & { mutual_followers: number }>>;
  markAsSeen: (convId: string, myId: string) => Promise<void>;
  subscribeToMessages: (convId: string) => any;
  subscribeToConversations: (userId: string) => any;
  fetchUnreadCount: (userId: string) => Promise<void>;
  fetchMessageRequests: (userId: string) => Promise<void>;
  acceptRequest: (convId: string) => Promise<void>;
  deleteRequest: (convId: string) => Promise<void>;
  blockFromRequest: (convId: string, blockedUserId: string) => Promise<void>;
  unsubscribeChannel: (channel: any) => void;
}

export const useMessageStore = create<MessageState>((set, get) => ({
  conversations: [],
  messages: [],
  messageRequests: [],
  requestCount: 0,
  totalUnreadCount: 0,
  loading: false,

  fetchConversations: async (userId) => {
    set({ loading: true });
    try {
      if (isMockId(userId)) throw new Error('mock-user');

      const { data, error } = await supabase
        .from('conversations')
        .select('*, user1:users!conversations_participant_1_fkey(*), user2:users!conversations_participant_2_fkey(*)')
        .eq('status', 'accepted')
        .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      const mapped: Conversation[] = (data || []).map((c: any) => ({
        id: c.id,
        participant_1: c.participant_1,
        participant_2: c.participant_2,
        last_message_text: c.last_message_text,
        last_message_at: c.last_message_at,
        last_message_sender_id: c.last_message_sender_id,
        last_message_status: c.last_message_status ?? 'sent',
        status: c.status,
        initiated_by: c.initiated_by,
        created_at: c.created_at,
        other_user: c.participant_1 === userId ? c.user2 : c.user1,
        unread_count: 0,
      }));

      // Fetch unread counts in parallel — not sequentially
      const unreadResults = await Promise.all(
        mapped.map((conv) =>
          supabase
            .from('direct_messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .neq('status', 'seen')
            .neq('sender_id', userId),
        ),
      );

      unreadResults.forEach((result, i) => {
        mapped[i].unread_count = result.count ?? 0;
      });

      const totalUnread = mapped.reduce((sum, c) => sum + (c.unread_count ?? 0), 0);
      set({ conversations: mapped, totalUnreadCount: totalUnread, loading: false });
      return;
    } catch {
      // Fall through to mock
    }

    try {
      const { MOCK_CONVERSATIONS } = await import('../lib/mockData');
      const filtered = MOCK_CONVERSATIONS.filter(
        (c) => (c.participant_1 === userId || c.participant_2 === userId)
          && (c.status === 'accepted' || !c.status),
      );
      const totalUnread = filtered.reduce((sum, c) => sum + (c.unread_count ?? 0), 0);
      set({ conversations: filtered, totalUnreadCount: totalUnread, loading: false });
    } catch {
      set({ conversations: [], loading: false });
    }
  },

  fetchOrCreateConversation: async (myId, otherId) => {
    if (isMockId(myId) || isMockId(otherId)) {
      const { conversations } = get();
      const existing = conversations.find(
        (c) =>
          (c.participant_1 === myId && c.participant_2 === otherId) ||
          (c.participant_1 === otherId && c.participant_2 === myId),
      );
      if (existing) return existing.id;

      try {
        const { MOCK_CONVERSATIONS, MOCK_USERS } = await import('../lib/mockData');
        const mockExisting = MOCK_CONVERSATIONS.find(
          (c) =>
            (c.participant_1 === myId && c.participant_2 === otherId) ||
            (c.participant_1 === otherId && c.participant_2 === myId),
        );
        if (mockExisting) {
          if (!conversations.find((c) => c.id === mockExisting.id)) {
            set({ conversations: [mockExisting, ...conversations] });
          }
          return mockExisting.id;
        }

        const otherUser = MOCK_USERS.find((u) => u.id === otherId);
        const [p1, p2] = myId < otherId ? [myId, otherId] : [otherId, myId];
        const newConv: Conversation = {
          id: `conv-local-${Date.now()}`,
          participant_1: p1,
          participant_2: p2,
          last_message_text: null,
          last_message_at: new Date().toISOString(),
          last_message_sender_id: null,
          created_at: new Date().toISOString(),
          other_user: otherUser,
          unread_count: 0,
        };
        set({ conversations: [newConv, ...get().conversations] });
        return newConv.id;
      } catch {
        return null;
      }
    }

    try {
      const { data, error } = await supabase.rpc('get_or_create_conversation', {
        user_a: myId,
        user_b: otherId,
      });
      if (error) {
        if (error.message?.includes('BLOCKED') || error.message?.includes('REJECTED')) {
          return null;
        }
        throw error;
      }
      return data as string;
    } catch {
      return null;
    }
  },

  fetchMessages: async (conversationId) => {
    if (isMockId(conversationId)) {
      try {
        const { MOCK_DIRECT_MESSAGES } = await import('../lib/mockData');
        set({ messages: MOCK_DIRECT_MESSAGES.filter((m) => m.conversation_id === conversationId) });
      } catch {
        set({ messages: [] });
      }
      return;
    }

    try {
      const { data, error } = await supabase
        .from('direct_messages')
        .select('*, user:users(*)')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      set({ messages: (data as DirectMessage[]) || [] });
    } catch {
      // Keep current messages on error
    }
  },

  sendMessage: async (convId, senderId, content, otherUserId, messageType = 'text', metadata) => {
    const previewText = messageType === 'image'
      ? '\ud83d\udcf7 Fotograf'
      : messageType === 'venue'
        ? metadata?.venue_name ?? 'Mekan'
        : content;

    const optimisticMessage: DirectMessage = {
      id: `dm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      conversation_id: convId,
      sender_id: senderId,
      content: previewText,
      message_type: messageType,
      metadata,
      status: 'sending',
      created_at: new Date().toISOString(),
    };

    set({ messages: [...get().messages, optimisticMessage] });

    const updatedConversations = get().conversations.map((c) =>
      c.id === convId
        ? { ...c, last_message_text: previewText, last_message_at: optimisticMessage.created_at, last_message_sender_id: senderId, last_message_status: 'sent' as const }
        : c,
    );
    set({ conversations: updatedConversations });

    if (isMockId(convId)) return;

    try {
      const { data: persisted, error } = await supabase
        .from('direct_messages')
        .insert({
          conversation_id: convId,
          sender_id: senderId,
          content: previewText,
          message_type: messageType,
          metadata: metadata ?? {},
        })
        .select('*')
        .single();

      if (error) throw error;

      set({
        messages: get().messages.map((m) => (m.id === optimisticMessage.id ? (persisted as DirectMessage) : m)),
      });

      await supabase
        .from('conversations')
        .update({
          last_message_text: previewText,
          last_message_at: new Date().toISOString(),
          last_message_sender_id: senderId,
          last_message_status: 'sent',
        })
        .eq('id', convId);

      // Skip push notification for pending conversations (silent request)
      const conv = get().conversations.find((c) => c.id === convId)
        || get().messageRequests.find((c) => c.id === convId);
      if (conv?.status !== 'pending') {
        sendPushNotification(
          otherUserId,
          'Yeni Mesaj',
          previewText.length > 80 ? previewText.substring(0, 80) + '...' : previewText,
          { route: `/chat/${convId}` },
        ).catch(() => {});
      }
    } catch {
      // Optimistic message stays in place
    }
  },

  markAsSeen: async (convId, myId) => {
    set({
      messages: get().messages.map((m) =>
        m.conversation_id === convId && m.sender_id !== myId && m.status !== 'seen'
          ? { ...m, status: 'seen' }
          : m,
      ),
    });

    const { conversations } = get();
    const target = conversations.find((c) => c.id === convId);
    if (target && (target.unread_count ?? 0) > 0) {
      const updated = conversations.map((c) =>
        c.id === convId ? { ...c, unread_count: 0 } : c,
      );
      set({ conversations: updated, totalUnreadCount: updated.reduce((sum, c) => sum + (c.unread_count ?? 0), 0) });
    }

    if (isMockId(convId)) return;

    try {
      await supabase
        .from('direct_messages')
        .update({ status: 'seen' })
        .eq('conversation_id', convId)
        .neq('status', 'seen')
        .neq('sender_id', myId);
    } catch {
      // Seen status is non-critical
    }
  },

  subscribeToMessages: (convId) => {
    if (isMockId(convId)) return null;

    try {
      const channel = supabase
        .channel(`dm-messages-${convId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'direct_messages',
            filter: `conversation_id=eq.${convId}`,
          },
          async (payload) => {
            const incoming = payload.new as any;
            const { data: senderProfile } = await supabase
              .from('users')
              .select('*')
              .eq('id', incoming.sender_id)
              .single();

            const message: DirectMessage = { ...incoming, status: incoming.status ?? 'sent', user: senderProfile || undefined };
            const currentMessages = get().messages;
            if (!currentMessages.find((m) => m.id === message.id)) {
              set({ messages: [...currentMessages, message] });
            }
          },
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'direct_messages',
            filter: `conversation_id=eq.${convId}`,
          },
          (payload) => {
            const updated = payload.new as any;
            set({
              messages: get().messages.map((m) =>
                m.id === updated.id ? { ...m, status: updated.status as MessageStatus } : m,
              ),
            });
          },
        )
        .subscribe();
      return channel;
    } catch {
      return null;
    }
  },

  subscribeToConversations: (userId) => {
    if (isMockId(userId)) return null;

    try {
      // Subscribe to updates on conversations where this user is a participant
      // We use two channels since Supabase filters don't support OR on server side
      const channel = supabase
        .channel(`dm-conversations-${userId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `participant_1=eq.${userId}` },
          () => { get().fetchConversations(userId); },
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `participant_2=eq.${userId}` },
          () => { get().fetchConversations(userId); },
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'conversations', filter: `participant_1=eq.${userId}` },
          () => { get().fetchMessageRequests(userId); get().fetchConversations(userId); },
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'conversations', filter: `participant_2=eq.${userId}` },
          () => { get().fetchMessageRequests(userId); get().fetchConversations(userId); },
        )
        .subscribe();
      return channel;
    } catch {
      return null;
    }
  },

  fetchUnreadCount: async (userId) => {
    if (isMockId(userId)) {
      try {
        const { MOCK_CONVERSATIONS } = await import('../lib/mockData');
        const total = MOCK_CONVERSATIONS
          .filter((c) => c.participant_1 === userId || c.participant_2 === userId)
          .reduce((sum, c) => sum + (c.unread_count ?? 0), 0);
        set({ totalUnreadCount: total });
      } catch {
        // Non-critical
      }
      return;
    }

    try {
      const { data: userConversations } = await supabase
        .from('conversations')
        .select('id')
        .eq('status', 'accepted')
        .or(`participant_1.eq.${userId},participant_2.eq.${userId}`);

      if (!userConversations?.length) {
        set({ totalUnreadCount: 0 });
        return;
      }

      const { count } = await supabase
        .from('direct_messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', userConversations.map((c) => c.id))
        .neq('status', 'seen')
        .neq('sender_id', userId);

      set({ totalUnreadCount: count ?? 0 });
    } catch {
      // Non-critical
    }
  },

  searchUsers: async (query, currentUserId) => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];

    if (isMockId(currentUserId)) {
      try {
        const { MOCK_USERS } = await import('../lib/mockData');
        const { useBlockStore } = await import('./blockStore');
        const blockedUsers = useBlockStore.getState().blockedUsers;
        return MOCK_USERS
          .filter((u) =>
            u.id !== currentUserId &&
            !blockedUsers.includes(u.id) && (
              u.full_name.toLowerCase().includes(trimmed) ||
              u.username.toLowerCase().includes(trimmed)
            ),
          )
          .map((u) => ({ ...u, mutual_followers: Math.floor(Math.random() * 8) }));
      } catch {
        return [];
      }
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .neq('id', currentUserId)
        .or(`username.ilike.%${trimmed}%,full_name.ilike.%${trimmed}%`)
        .limit(20);

      if (error || !data) return [];

      const { useBlockStore } = await import('./blockStore');
      const blockedUsers = useBlockStore.getState().blockedUsers;
      return (data as User[])
        .filter((u) => !blockedUsers.includes(u.id))
        .map((u) => ({ ...u, mutual_followers: 0 }));
    } catch {
      return [];
    }
  },

  fetchMessageRequests: async (userId) => {
    if (isMockId(userId)) {
      try {
        const { MOCK_MESSAGE_REQUESTS } = await import('../lib/mockData');
        const requests = MOCK_MESSAGE_REQUESTS.filter(
          (c) => c.initiated_by !== userId &&
            (c.participant_1 === userId || c.participant_2 === userId)
        );
        set({ messageRequests: requests, requestCount: requests.length });
      } catch {
        set({ messageRequests: [], requestCount: 0 });
      }
      return;
    }

    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*, user1:users!conversations_participant_1_fkey(*), user2:users!conversations_participant_2_fkey(*)')
        .eq('status', 'pending')
        .neq('initiated_by', userId)
        .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      const mapped: Conversation[] = (data || []).map((c: any) => ({
        id: c.id,
        participant_1: c.participant_1,
        participant_2: c.participant_2,
        last_message_text: c.last_message_text,
        last_message_at: c.last_message_at,
        last_message_sender_id: c.last_message_sender_id,
        last_message_status: c.last_message_status ?? 'sent',
        status: c.status,
        initiated_by: c.initiated_by,
        created_at: c.created_at,
        other_user: c.participant_1 === userId ? c.user2 : c.user1,
        unread_count: 0,
      }));

      set({ messageRequests: mapped, requestCount: mapped.length });
    } catch {
      // Keep current state on error
    }
  },

  acceptRequest: async (convId) => {
    // Optimistic: move from requests to conversations
    const { messageRequests, conversations } = get();
    const request = messageRequests.find((r) => r.id === convId);
    if (request) {
      const accepted = { ...request, status: 'accepted' as const };
      set({
        messageRequests: messageRequests.filter((r) => r.id !== convId),
        requestCount: Math.max(0, get().requestCount - 1),
        conversations: [accepted, ...conversations],
      });
    }

    if (isMockId(convId)) return;

    try {
      await supabase
        .from('conversations')
        .update({ status: 'accepted' })
        .eq('id', convId);
    } catch {
      // Rollback on error — refetch both lists
      const userId = request
        ? (request.initiated_by === request.participant_1 ? request.participant_2 : request.participant_1)
        : '';
      if (userId) {
        get().fetchConversations(userId);
        get().fetchMessageRequests(userId);
      }
    }
  },

  deleteRequest: async (convId) => {
    // Optimistic: remove from requests
    const { messageRequests } = get();
    set({
      messageRequests: messageRequests.filter((r) => r.id !== convId),
      requestCount: Math.max(0, get().requestCount - 1),
    });

    if (isMockId(convId)) return;

    try {
      await supabase
        .from('conversations')
        .update({ status: 'rejected' })
        .eq('id', convId);
    } catch {
      // Non-critical — will be hidden on next fetch anyway
    }
  },

  blockFromRequest: async (convId, blockedUserId) => {
    // Remove from requests first
    const { messageRequests } = get();
    set({
      messageRequests: messageRequests.filter((r) => r.id !== convId),
      requestCount: Math.max(0, get().requestCount - 1),
    });

    // Delegate block to blockStore (handles follows + conversation status)
    const { useBlockStore } = await import('./blockStore');
    const blockStore = useBlockStore.getState();
    // Determine blocker (current user) from the request
    const request = messageRequests.find((r) => r.id === convId);
    const blockerId = request
      ? (request.initiated_by === request.participant_1 ? request.participant_2 : request.participant_1)
      : '';
    if (blockerId) {
      await blockStore.blockUser(blockerId, blockedUserId);
    }
  },

  unsubscribeChannel: (channel) => {
    if (channel) {
      try { supabase.removeChannel(channel); } catch { /* cleanup non-critical */ }
    }
  },
}));
