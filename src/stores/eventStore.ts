import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { checkAndAwardBadges, addXP } from '../lib/badgeChecker';
import type { Event, EventAttendee, EventMessage } from '../types';

// Sender profile cache to avoid re-fetching the same user on every incoming message
const eventSenderProfileCache = new Map<string, any>();

/**
 * Helper to fetch an event by a specific column (deduplicates fetchEventByPostId / fetchEventById).
 */
async function fetchEventByColumn(col: 'post_id' | 'id', value: string) {
  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      creator:users!creator_id(*),
      venue:venues(*),
      attendees:event_attendees(*, user:users(*))
    `)
    .eq(col, value)
    .single();

  if (!error && data) {
    const event = {
      ...data,
      attendee_count: (data.attendees as EventAttendee[])
        ?.filter((a) => a.status === 'confirmed').length ?? 0,
    } as Event;
    return { event, error: null };
  }
  return { event: null, error: error?.message || null };
}

interface EventState {
  events: Event[];
  selectedEvent: Event | null;
  attendees: EventAttendee[];
  messages: EventMessage[];
  loading: boolean;
  error: string | null;

  fetchEventByPostId: (postId: string) => Promise<void>;
  fetchEventById: (eventId: string) => Promise<void>;
  fetchUpcomingEvents: () => Promise<void>;
  createEvent: (data: {
    creator_id: string;
    venue_id?: string;
    title: string;
    description?: string;
    location_name?: string;
    latitude?: number;
    longitude?: number;
    event_date: string;
    max_attendees?: number;
    is_public?: boolean;
  }) => Promise<{ error: string | null; eventId?: string }>;
  joinEvent: (eventId: string, userId: string) => Promise<{ error: string | null }>;
  leaveEvent: (eventId: string, userId: string) => Promise<void>;
  fetchAttendees: (eventId: string) => Promise<void>;
  fetchMessages: (eventId: string) => Promise<void>;
  sendMessage: (eventId: string, userId: string, text: string) => Promise<void>;
  subscribeToMessages: (eventId: string) => any;
  unsubscribeFromMessages: (channel: any) => void;
  clearError: () => void;
}

export const useEventStore = create<EventState>((set, get) => ({
  events: [],
  selectedEvent: null,
  attendees: [],
  messages: [],
  loading: false,
  error: null,

  fetchEventByPostId: async (postId) => {
    set({ loading: true, error: null });

    try {
      const result = await fetchEventByColumn('post_id', postId);
      if (result.event) {
        set({ selectedEvent: result.event, loading: false });
      } else {
        set({ selectedEvent: null, loading: false });
      }
    } catch (err: any) {
      set({
        selectedEvent: null,
        error: err?.message || 'Etkinlik yuklenirken hata olustu',
        loading: false,
      });
    }
  },

  fetchEventById: async (eventId) => {
    set({ loading: true, error: null });

    try {
      const result = await fetchEventByColumn('id', eventId);
      if (result.event) {
        set({ selectedEvent: result.event, loading: false });
      } else {
        set({ selectedEvent: null, loading: false });
      }
    } catch (err: any) {
      set({
        selectedEvent: null,
        error: err?.message || 'Etkinlik yuklenirken hata olustu',
        loading: false,
      });
    }
  },

  fetchUpcomingEvents: async () => {
    set({ loading: true, error: null });

    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          creator:users!creator_id(*),
          venue:venues(*),
          attendees:event_attendees(*, user:users(*))
        `)
        .eq('status', 'upcoming')
        .gt('event_date', now)
        .order('event_date', { ascending: true })
        .limit(20);

      if (!error && data && data.length > 0) {
        const events = (data as any[]).map((e) => ({
          ...e,
          attendee_count: (e.attendees as EventAttendee[])
            ?.filter((a) => a.status === 'confirmed').length ?? 0,
        })) as Event[];
        set({ events, loading: false });
      } else {
        set({ events: [], loading: false });
      }
    } catch (err: any) {
      set({
        events: [],
        error: err?.message || 'Etkinlikler yuklenirken hata olustu',
        loading: false,
      });
    }
  },

  createEvent: async (data) => {
    set({ loading: true, error: null });

    try {
      // 1. Once meetup tipinde bir post olustur
      const { data: post, error: postError } = await supabase
        .from('posts')
        .insert({
          user_id: data.creator_id,
          venue_id: data.venue_id || null,
          post_type: 'meetup',
          caption: data.title,
        })
        .select()
        .single();

      if (postError || !post) {
        set({ loading: false });
        return { error: postError?.message || 'Post olusturulamadi' };
      }

      // 2. Etkinligi olustur ve post_id ile bagla
      const { data: event, error: eventError } = await supabase
        .from('events')
        .insert({
          creator_id: data.creator_id,
          venue_id: data.venue_id || null,
          post_id: post.id,
          title: data.title,
          description: data.description || null,
          location_name: data.location_name || null,
          latitude: data.latitude || null,
          longitude: data.longitude || null,
          event_date: data.event_date,
          max_attendees: data.max_attendees ?? 10,
          is_public: data.is_public ?? true,
          status: 'upcoming',
        })
        .select()
        .single();

      if (eventError || !event) {
        // Clean up orphaned post
        await supabase.from('posts').delete().eq('id', post.id);
        set({ loading: false });
        return { error: eventError?.message || 'Etkinlik olusturulamadi' };
      }

      // 3. Organizatoru otomatik olarak katilimci yap
      await supabase.from('event_attendees').insert({
        event_id: event.id,
        user_id: data.creator_id,
        status: 'confirmed',
      });

      // Listeyi yenile
      await get().fetchUpcomingEvents();

      // Badge check and XP (fire-and-forget)
      checkAndAwardBadges(data.creator_id);
      addXP(data.creator_id, 30);

      set({ loading: false });
      return { error: null, eventId: event.id };
    } catch (err: any) {
      set({
        loading: false,
        error: err?.message || 'Etkinlik olusturulurken hata olustu',
      });
      return { error: err?.message || 'Etkinlik olusturulurken hata olustu' };
    }
  },

  joinEvent: async (eventId, userId) => {
    try {
      // Mevcut katilimci sayisini ve max_attendees kontrol et
      const { selectedEvent } = get();
      let maxAttendees = selectedEvent?.max_attendees ?? 10;
      let confirmedCount = 0;

      // Supabase'den guncel bilgiyi al
      const { data: eventData } = await supabase
        .from('events')
        .select('max_attendees')
        .eq('id', eventId)
        .single();

      if (eventData) {
        maxAttendees = eventData.max_attendees;
      }

      const { count } = await supabase
        .from('event_attendees')
        .select('*', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .eq('status', 'confirmed');

      confirmedCount = count ?? 0;

      // Doluysa bekleme listesine, degilse onaylı olarak ekle
      const status = confirmedCount >= maxAttendees ? 'waitlisted' : 'confirmed';

      const { error } = await supabase.from('event_attendees').insert({
        event_id: eventId,
        user_id: userId,
        status,
      });

      if (error) {
        return { error: error.message };
      }

      // Basarili Supabase insert - state guncelle
      await get().fetchAttendees(eventId);
      if (selectedEvent && selectedEvent.id === eventId) {
        await get().fetchEventByPostId(selectedEvent.post_id);
      }

      // Insert system message into Supabase
      const { data: userData } = await supabase
        .from('users')
        .select('full_name, username')
        .eq('id', userId)
        .single();
      const displayName = userData?.full_name || userData?.username || 'Birisi';
      await supabase.from('event_messages').insert({
        event_id: eventId,
        user_id: userId,
        message: `${displayName} bulusmaya katildi`,
        message_type: 'system',
      });
      await get().fetchMessages(eventId);

      // Badge check and XP (fire-and-forget)
      checkAndAwardBadges(userId);
      addXP(userId, 25);

      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Etkinlige katilirken hata olustu' };
    }
  },

  leaveEvent: async (eventId, userId) => {
    try {
      const { error } = await supabase
        .from('event_attendees')
        .delete()
        .eq('event_id', eventId)
        .eq('user_id', userId);

      if (error) {
        // Supabase failed — optimistically update local state
        const currentAttendees = get().attendees.filter(
          (a) => !(a.event_id === eventId && a.user_id === userId)
        );
        set({ attendees: currentAttendees });
      } else {
        await get().fetchAttendees(eventId);
      }

      // selectedEvent varsa guncelle
      const { selectedEvent } = get();
      if (selectedEvent && selectedEvent.id === eventId) {
        const updatedAttendees = (selectedEvent.attendees || []).filter(
          (a) => a.user_id !== userId
        );
        set({
          selectedEvent: {
            ...selectedEvent,
            attendees: updatedAttendees,
            attendee_count: updatedAttendees.filter((a) => a.status === 'confirmed').length,
          },
        });
      }
    } catch {
      // Optimistic local update on network failure
      const currentAttendees = get().attendees.filter(
        (a) => !(a.event_id === eventId && a.user_id === userId)
      );
      set({ attendees: currentAttendees });
    }
  },

  fetchAttendees: async (eventId) => {
    try {
      const { data, error } = await supabase
        .from('event_attendees')
        .select('*, user:users(*)')
        .eq('event_id', eventId)
        .order('joined_at', { ascending: true });

      if (!error && data && data.length > 0) {
        set({ attendees: data as EventAttendee[] });
      } else {
        set({ attendees: [] });
      }
    } catch {
      set({ attendees: [] });
    }
  },

  fetchMessages: async (eventId) => {
    try {
      const { data, error } = await supabase
        .from('event_messages')
        .select('*, user:users(*)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) {
        set({ messages: data as EventMessage[] });
      } else {
        set({ messages: [] });
      }
    } catch {
      set({ messages: [] });
    }
  },

  sendMessage: async (eventId, userId, text) => {
    // Optimistic: add message to local state immediately
    const optimisticMessage: EventMessage = {
      id: `em-local-${Date.now()}`,
      event_id: eventId,
      user_id: userId,
      message: text,
      created_at: new Date().toISOString(),
      user: undefined,
    };
    set({ messages: [...get().messages, optimisticMessage] });

    try {
      const { data: persisted, error } = await supabase.from('event_messages').insert({
        event_id: eventId,
        user_id: userId,
        message: text,
      }).select('*, user:users(*)').single();

      if (!error && persisted) {
        // Replace optimistic message with server response
        set({
          messages: get().messages.map((m) =>
            m.id === optimisticMessage.id ? (persisted as EventMessage) : m
          ),
        });
      }
      // If insert fails, optimistic message stays in place
    } catch {
      // Optimistic message stays in place on network failure
    }
  },

  subscribeToMessages: (eventId: string) => {
    try {
      const channel = supabase
        .channel(`event-messages-${eventId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'event_messages',
          filter: `event_id=eq.${eventId}`,
        }, async (payload) => {
          const newMsg = payload.new as any;

          // Use sender profile cache to avoid re-fetching the same user repeatedly
          let userData = eventSenderProfileCache.get(newMsg.user_id);
          if (!userData) {
            const { data } = await supabase
              .from('users')
              .select('*')
              .eq('id', newMsg.user_id)
              .single();
            userData = data || undefined;
            if (userData) {
              eventSenderProfileCache.set(newMsg.user_id, userData);
            }
          }

          const message = {
            ...newMsg,
            user: userData,
          };

          const { messages } = get();
          if (!messages.find((m: any) => m.id === message.id)) {
            set({ messages: [...messages, message] });
          }
        })
        .subscribe();

      return channel;
    } catch {
      return null;
    }
  },

  unsubscribeFromMessages: (channel: any) => {
    if (channel) {
      try {
        supabase.removeChannel(channel);
      } catch {
        // Ignore cleanup errors
      }
    }
  },

  clearError: () => set({ error: null }),
}));
