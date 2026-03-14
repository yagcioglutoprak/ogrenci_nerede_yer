import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { sendPushNotification } from '../lib/notifications';
import { useBlockStore } from './blockStore';
import type { Conversation, DirectMessage, DirectMessageType, DirectMessageMetadata, MessageStatus, User } from '../types';

// Sender profile cache to avoid re-fetching the same user on every incoming message
const senderProfileCache = new Map<string, any>();

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
    } catch {
      set({ conversations: [], loading: false });
    }
  },

  fetchOrCreateConversation: async (myId, otherId) => {
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

    // Batch messages + conversations update into a single set() call
    set({
      messages: [...get().messages, optimisticMessage],
      conversations: get().conversations.map((c) =>
        c.id === convId
          ? { ...c, last_message_text: previewText, last_message_at: optimisticMessage.created_at, last_message_sender_id: senderId, last_message_status: 'sent' as const }
          : c,
      ),
    });

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
    // Batch messages + conversations update into a single set() call
    const updatedMessages = get().messages.map((m) =>
      m.conversation_id === convId && m.sender_id !== myId && m.status !== 'seen'
        ? { ...m, status: 'seen' as MessageStatus }
        : m,
    );

    const { conversations } = get();
    const target = conversations.find((c) => c.id === convId);
    if (target && (target.unread_count ?? 0) > 0) {
      const updatedConversations = conversations.map((c) =>
        c.id === convId ? { ...c, unread_count: 0 } : c,
      );
      set({
        messages: updatedMessages,
        conversations: updatedConversations,
        totalUnreadCount: updatedConversations.reduce((sum, c) => sum + (c.unread_count ?? 0), 0),
      });
    } else {
      set({ messages: updatedMessages });
    }

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

            // Use sender profile cache to avoid fetching the same user repeatedly
            let senderProfile = senderProfileCache.get(incoming.sender_id);
            if (!senderProfile) {
              const { data } = await supabase
                .from('users')
                .select('*')
                .eq('id', incoming.sender_id)
                .single();
              senderProfile = data || undefined;
              if (senderProfile) {
                senderProfileCache.set(incoming.sender_id, senderProfile);
              }
            }

            const message: DirectMessage = { ...incoming, status: incoming.status ?? 'sent', user: senderProfile };
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

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .neq('id', currentUserId)
        .or(`username.ilike.%${trimmed}%,full_name.ilike.%${trimmed}%`)
        .limit(20);

      if (error || !data) return [];

      const blockedUsers = useBlockStore.getState().blockedUsers;
      return (data as User[])
        .filter((u) => !blockedUsers.includes(u.id))
        .map((u) => ({ ...u, mutual_followers: 0 }));
    } catch {
      return [];
    }
  },

  fetchMessageRequests: async (userId) => {
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
