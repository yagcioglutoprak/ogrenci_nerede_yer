import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { checkAndAwardBadges, addXP } from '../lib/badgeChecker';
import type { Event, EventAttendee, EventMessage } from '../types';
import { MOCK_EVENTS, MOCK_EVENT_ATTENDEES, MOCK_EVENT_MESSAGES, MOCK_USERS, MOCK_VENUES } from '../lib/mockData';

/**
 * Build fully-joined mock events (with creator, venue, attendees data attached).
 */
function buildMockEventsWithJoins(): Event[] {
  return MOCK_EVENTS.map((event) => {
    const creator = MOCK_USERS.find((u) => u.id === event.creator_id);
    const venue = event.venue_id
      ? MOCK_VENUES.find((v) => v.id === event.venue_id)
      : undefined;
    const attendees = MOCK_EVENT_ATTENDEES
      .filter((a) => a.event_id === event.id)
      .map((a) => ({
        ...a,
        user: MOCK_USERS.find((u) => u.id === a.user_id),
      }));

    return {
      ...event,
      creator,
      venue: venue as Event['venue'],
      attendees,
      attendee_count: attendees.filter((a) => a.status === 'confirmed').length,
    };
  });
}

/**
 * Find a single mock event by post_id with full joins.
 */
function findMockEventByPostId(postId: string): Event | null {
  const allMock = buildMockEventsWithJoins();
  return allMock.find((e) => e.post_id === postId) || null;
}

/**
 * Build mock attendees for an event with user data joined.
 */
function buildMockAttendeesWithUser(eventId: string): EventAttendee[] {
  return MOCK_EVENT_ATTENDEES
    .filter((a) => a.event_id === eventId)
    .map((a) => ({
      ...a,
      user: MOCK_USERS.find((u) => u.id === a.user_id),
    }));
}

interface EventState {
  events: Event[];
  selectedEvent: Event | null;
  attendees: EventAttendee[];
  messages: EventMessage[];
  loading: boolean;
  error: string | null;

  fetchEventByPostId: (postId: string) => Promise<void>;
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
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          creator:users!creator_id(*),
          venue:venues(*),
          attendees:event_attendees(*, user:users(*))
        `)
        .eq('post_id', postId)
        .single();

      if (!error && data) {
        const event = {
          ...data,
          attendee_count: (data.attendees as EventAttendee[])
            ?.filter((a) => a.status === 'confirmed').length ?? 0,
        } as Event;
        set({ selectedEvent: event });
      } else {
        set({ selectedEvent: null });
      }
    } catch (err: any) {
      if (__DEV__) {
        const mockEvent = findMockEventByPostId(postId);
        set({
          selectedEvent: mockEvent,
          error: err?.message || 'Etkinlik yuklenirken hata olustu',
        });
      } else {
        set({
          selectedEvent: null,
          error: err?.message || 'Etkinlik yuklenirken hata olustu',
        });
      }
    }

    set({ loading: false });
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
        set({ events });
      } else {
        set({ events: [] });
      }
    } catch (err: any) {
      if (__DEV__) {
        const allMock = buildMockEventsWithJoins();
        const upcoming = allMock
          .filter((e) => e.status === 'upcoming' && new Date(e.event_date) > new Date())
          .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
          .slice(0, 20);
        set({
          events: upcoming,
          error: err?.message || 'Etkinlikler yuklenirken hata olustu',
        });
      } else {
        set({
          events: [],
          error: err?.message || 'Etkinlikler yuklenirken hata olustu',
        });
      }
    }

    set({ loading: false });
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
        // Mock data fallback: lokal state guncelle
        const mockAttendee: EventAttendee = {
          event_id: eventId,
          user_id: userId,
          status: 'confirmed',
          joined_at: new Date().toISOString(),
          user: MOCK_USERS.find((u) => u.id === userId),
        };
        const currentAttendees = get().attendees;
        set({ attendees: [...currentAttendees, mockAttendee] });

        // selectedEvent varsa attendee_count guncelle
        if (selectedEvent && selectedEvent.id === eventId) {
          set({
            selectedEvent: {
              ...selectedEvent,
              attendees: [...(selectedEvent.attendees || []), mockAttendee],
              attendee_count: (selectedEvent.attendee_count ?? 0) + 1,
            },
          });
        }

        return { error: null };
      }

      // Basarili Supabase insert - state guncelle
      await get().fetchAttendees(eventId);
      if (selectedEvent && selectedEvent.id === eventId) {
        await get().fetchEventByPostId(selectedEvent.post_id);
      }

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
        // Mock data fallback: lokal state guncelle
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
      // Fallback: lokal state guncelle
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
      if (__DEV__) {
        const mockAttendees = buildMockAttendeesWithUser(eventId);
        set({ attendees: mockAttendees });
      } else {
        set({ attendees: [] });
      }
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
      if (__DEV__) {
        const mockMessages = MOCK_EVENT_MESSAGES
          .filter((m) => m.event_id === eventId)
          .map((m) => ({
            ...m,
            user: MOCK_USERS.find((u) => u.id === m.user_id),
          }));
        set({ messages: mockMessages });
      } else {
        set({ messages: [] });
      }
    }
  },

  sendMessage: async (eventId, userId, text) => {
    try {
      const { error } = await supabase.from('event_messages').insert({
        event_id: eventId,
        user_id: userId,
        message: text,
      });

      if (!error) {
        await get().fetchMessages(eventId);
      } else {
        // Fallback: mesaji lokal state'e ekle
        const newMessage: EventMessage = {
          id: `em-local-${Date.now()}`,
          event_id: eventId,
          user_id: userId,
          message: text,
          created_at: new Date().toISOString(),
          user: MOCK_USERS.find((u) => u.id === userId),
        };
        const currentMessages = get().messages;
        set({ messages: [...currentMessages, newMessage] });
      }
    } catch {
      // Fallback: mesaji lokal state'e ekle
      const newMessage: EventMessage = {
        id: `em-local-${Date.now()}`,
        event_id: eventId,
        user_id: userId,
        message: text,
        created_at: new Date().toISOString(),
        user: MOCK_USERS.find((u) => u.id === userId),
      };
      const currentMessages = get().messages;
      set({ messages: [...currentMessages, newMessage] });
    }
  },

  subscribeToMessages: (eventId: string) => {
    const channel = supabase
      .channel(`event-messages-${eventId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'event_messages',
        filter: `event_id=eq.${eventId}`,
      }, async (payload) => {
        const newMsg = payload.new as any;
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', newMsg.user_id)
          .single();

        const message = {
          ...newMsg,
          user: userData || undefined,
        };

        const { messages } = get();
        if (!messages.find((m: any) => m.id === message.id)) {
          set({ messages: [...messages, message] });
        }
      })
      .subscribe();

    return channel;
  },

  unsubscribeFromMessages: (channel: any) => {
    if (channel) {
      supabase.removeChannel(channel);
    }
  },

  clearError: () => set({ error: null }),
}));
