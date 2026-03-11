import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { sendPushNotification } from '../lib/notifications';
import type { Conversation, DirectMessage, DirectMessageType, DirectMessageMetadata, User } from '../types';

function isMockId(id: string): boolean {
  return id.startsWith('local-') || id.startsWith('mock-') || id.startsWith('conv-') || id.startsWith('u-') || id.startsWith('dm-');
}

interface MessageState {
  conversations: Conversation[];
  messages: DirectMessage[];
  totalUnreadCount: number;
  loading: boolean;

  fetchConversations: (userId: string) => Promise<void>;
  fetchOrCreateConversation: (myId: string, otherId: string) => Promise<string | null>;
  fetchMessages: (conversationId: string) => Promise<void>;
  sendMessage: (convId: string, senderId: string, content: string, otherUserId: string, messageType?: DirectMessageType, metadata?: DirectMessageMetadata) => Promise<void>;
  searchUsers: (query: string, currentUserId: string) => Promise<Array<User & { mutual_followers: number }>>;
  markAsRead: (convId: string, myId: string) => Promise<void>;
  subscribeToMessages: (convId: string) => any;
  subscribeToConversations: (userId: string) => any;
  fetchUnreadCount: (userId: string) => Promise<void>;
  unsubscribeChannel: (channel: any) => void;
}

export const useMessageStore = create<MessageState>((set, get) => ({
  conversations: [],
  messages: [],
  totalUnreadCount: 0,
  loading: false,

  fetchConversations: async (userId) => {
    set({ loading: true });
    try {
      if (isMockId(userId)) throw new Error('mock-user');

      const { data, error } = await supabase
        .from('conversations')
        .select('*, user1:users!conversations_participant_1_fkey(*), user2:users!conversations_participant_2_fkey(*)')
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
            .eq('is_read', false)
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
        (c) => c.participant_1 === userId || c.participant_2 === userId,
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
      if (error) throw error;
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
      is_read: false,
      created_at: new Date().toISOString(),
    };

    set({ messages: [...get().messages, optimisticMessage] });

    const updatedConversations = get().conversations.map((c) =>
      c.id === convId
        ? { ...c, last_message_text: previewText, last_message_at: optimisticMessage.created_at, last_message_sender_id: senderId }
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
        })
        .eq('id', convId);

      sendPushNotification(
        otherUserId,
        'Yeni Mesaj',
        previewText.length > 80 ? previewText.substring(0, 80) + '...' : previewText,
        { route: `/chat/${convId}` },
      ).catch(() => {});
    } catch {
      // Optimistic message stays in place
    }
  },

  markAsRead: async (convId, myId) => {
    set({
      messages: get().messages.map((m) =>
        m.conversation_id === convId && m.sender_id !== myId ? { ...m, is_read: true } : m,
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
        .update({ is_read: true })
        .eq('conversation_id', convId)
        .eq('is_read', false)
        .neq('sender_id', myId);
    } catch {
      // Read status is non-critical
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

            const message: DirectMessage = { ...incoming, user: senderProfile || undefined };
            const currentMessages = get().messages;
            if (!currentMessages.find((m) => m.id === message.id)) {
              set({ messages: [...currentMessages, message] });
            }
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
        .or(`participant_1.eq.${userId},participant_2.eq.${userId}`);

      if (!userConversations?.length) {
        set({ totalUnreadCount: 0 });
        return;
      }

      const { count } = await supabase
        .from('direct_messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', userConversations.map((c) => c.id))
        .eq('is_read', false)
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
        return MOCK_USERS
          .filter((u) =>
            u.id !== currentUserId && (
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

      return (data as User[]).map((u) => ({ ...u, mutual_followers: 0 }));
    } catch {
      return [];
    }
  },

  unsubscribeChannel: (channel) => {
    if (channel) {
      try { supabase.removeChannel(channel); } catch { /* cleanup non-critical */ }
    }
  },
}));
