import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEventStore } from '../../stores/eventStore';
import { useAuthStore } from '../../stores/authStore';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../../lib/constants';
import Avatar from '../../components/ui/Avatar';
import MessageBubble from '../../components/chat/MessageBubble';
import { useThemeColors } from '../../hooks/useThemeColors';
import { getRelativeTime } from '../../lib/utils';
import type { EventMessage, EventAttendee } from '../../types';

const MEETUP_CYAN = '#06B6D4';

function formatEventDate(dateString: string): string {
  const date = new Date(dateString);
  const months = ['Oca', 'Sub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Agu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${day} ${month}, ${hours}:${minutes}`;
}

export default function EventRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const {
    selectedEvent: event,
    attendees,
    messages,
    loading,
    fetchAttendees,
    fetchMessages,
    sendMessage,
    joinEvent,
    leaveEvent,
  } = useEventStore();

  const [messageText, setMessageText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const flatListRef = useRef<FlatList>(null);

  // Load event data by searching through events
  useEffect(() => {
    if (!id) return;

    // Try to find the event — we need to fetch by looking through events
    // The store has fetchEventByPostId but we have the event ID, not post ID.
    // Let's fetch upcoming events and also fetch attendees + messages directly.
    const loadData = async () => {
      // Fetch upcoming events to populate selectedEvent
      const { events } = useEventStore.getState();
      const found = events.find((e) => e.id === id);
      if (found) {
        useEventStore.setState({ selectedEvent: found });
      } else {
        // Fetch all events to find this one
        await useEventStore.getState().fetchUpcomingEvents();
        const refreshed = useEventStore.getState().events.find((e) => e.id === id);
        if (refreshed) {
          useEventStore.setState({ selectedEvent: refreshed });
        }
      }

      await Promise.all([
        fetchAttendees(id),
        fetchMessages(id),
      ]);
    };

    loadData();
  }, [id]);

  const isAttendee = attendees.some(
    (a) => a.user_id === user?.id && a.status === 'confirmed'
  );

  const confirmedAttendees = attendees.filter((a) => a.status === 'confirmed');

  const handleJoin = async () => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    if (id) await joinEvent(id, user.id);
  };

  const handleLeave = async () => {
    if (!user || !id) return;
    await leaveEvent(id, user.id);
  };

  const handleSend = async () => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    if (!messageText.trim() || !id) return;

    setSubmitting(true);
    await sendMessage(id, user.id, messageText.trim());
    setMessageText('');
    setSubmitting(false);

    // Scroll to bottom after sending
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const renderMessage = useCallback(
    ({ item }: { item: EventMessage }) => (
      <MessageBubble
        message={item}
        isCurrentUser={item.user_id === user?.id}
      />
    ),
    [user?.id],
  );

  const renderDateSeparator = (date: string) => (
    <View style={styles.dateSeparator}>
      <View style={[styles.dateLine, { backgroundColor: colors.borderLight }]} />
      <Text style={[styles.dateText, { color: colors.textTertiary }]}>{date}</Text>
      <View style={[styles.dateLine, { backgroundColor: colors.borderLight }]} />
    </View>
  );

  // Group messages by date for separators
  const messagesWithSeparators = useCallback(() => {
    const items: (EventMessage | { type: 'separator'; date: string; id: string })[] = [];
    let lastDate = '';

    messages.forEach((msg) => {
      const msgDate = new Date(msg.created_at).toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
      });
      if (msgDate !== lastDate) {
        items.push({ type: 'separator', date: msgDate, id: `sep-${msgDate}` });
        lastDate = msgDate;
      }
      items.push(msg);
    });

    return items;
  }, [messages]);

  const renderItem = useCallback(
    ({ item }: { item: EventMessage | { type: 'separator'; date: string; id: string } }) => {
      if ('type' in item && item.type === 'separator') {
        return renderDateSeparator(item.date);
      }
      return (
        <MessageBubble
          message={item as EventMessage}
          isCurrentUser={(item as EventMessage).user_id === user?.id}
        />
      );
    },
    [user?.id, colors],
  );

  if (loading && !event) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const renderHeader = () => (
    <View>
      {/* Event Info Card */}
      <View style={[styles.eventCard, { backgroundColor: colors.backgroundSecondary }]}>
        {/* Title + Date */}
        <View style={styles.eventTitleRow}>
          <View style={styles.meetupBadge}>
            <Ionicons name="people" size={12} color="#FFFFFF" />
            <Text style={styles.meetupBadgeText}>Bulusma</Text>
          </View>
          <View style={styles.dateBadge}>
            <Ionicons name="calendar-outline" size={12} color={Colors.accent} />
            <Text style={styles.dateBadgeText}>
              {event?.event_date ? formatEventDate(event.event_date) : ''}
            </Text>
          </View>
        </View>

        <Text style={[styles.eventTitle, { color: colors.text }]}>
          {event?.title ?? 'Bulusma'}
        </Text>

        {/* Venue */}
        {event?.venue?.name && (
          <TouchableOpacity
            style={styles.venueRow}
            onPress={() => event.venue_id && router.push(`/venue/${event.venue_id}`)}
            activeOpacity={0.7}
          >
            <Ionicons name="location-outline" size={16} color={Colors.primary} />
            <Text style={[styles.venueName, { color: Colors.primary }]}>
              {event.venue.name}
            </Text>
          </TouchableOpacity>
        )}

        {/* Description (collapsible) */}
        {event?.description && (
          <TouchableOpacity
            onPress={() => setShowDescription(!showDescription)}
            activeOpacity={0.7}
          >
            <Text
              style={[styles.description, { color: colors.textSecondary }]}
              numberOfLines={showDescription ? undefined : 2}
            >
              {event.description}
            </Text>
            {!showDescription && event.description.length > 80 && (
              <Text style={[styles.showMore, { color: colors.textTertiary }]}>devamini goster</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Attendees row */}
        <View style={styles.attendeesSection}>
          <View style={styles.attendeeAvatars}>
            {confirmedAttendees.slice(0, 5).map((a, i) => (
              <View key={a.user_id} style={[styles.attendeeAvatar, i > 0 && { marginLeft: -8 }]}>
                <Avatar
                  uri={a.user?.avatar_url}
                  name={a.user?.full_name ?? '?'}
                  size={28}
                />
              </View>
            ))}
            {confirmedAttendees.length > 5 && (
              <View style={[styles.attendeeMore, { backgroundColor: colors.border }]}>
                <Text style={[styles.attendeeMoreText, { color: colors.textSecondary }]}>
                  +{confirmedAttendees.length - 5}
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.attendeeCount, { color: colors.textSecondary }]}>
            {confirmedAttendees.length}/{event?.max_attendees ?? '?'} katilimci
          </Text>
        </View>

        {/* Join/Leave button */}
        {user && (
          <TouchableOpacity
            style={[
              styles.joinButton,
              isAttendee
                ? { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.border }
                : { backgroundColor: Colors.primary },
            ]}
            onPress={isAttendee ? handleLeave : handleJoin}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isAttendee ? 'checkmark-circle' : 'add-circle-outline'}
              size={18}
              color={isAttendee ? Colors.primary : '#FFFFFF'}
            />
            <Text
              style={[
                styles.joinButtonText,
                isAttendee ? { color: Colors.primary } : { color: '#FFFFFF' },
              ]}
            >
              {isAttendee ? 'Katildin' : 'Katil'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Chat section header */}
      <View style={[styles.chatHeader, { borderBottomColor: colors.borderLight }]}>
        <Ionicons name="chatbubbles-outline" size={18} color={colors.textSecondary} />
        <Text style={[styles.chatHeaderText, { color: colors.text }]}>
          Sohbet ({messages.length})
        </Text>
      </View>
    </View>
  );

  const data = messagesWithSeparators();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Header bar */}
        <View style={[styles.headerBar, { borderBottomColor: colors.borderLight }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={[styles.headerDot, { backgroundColor: MEETUP_CYAN }]} />
            <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
              {event?.title ?? 'Bulusma Odasi'}
            </Text>
          </View>
          <View style={{ width: 24 }} />
        </View>

        {/* Messages list */}
        <FlatList
          ref={flatListRef}
          data={data}
          keyExtractor={(item) => ('type' in item ? item.id : item.id)}
          renderItem={renderItem}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            if (messages.length > 0) {
              flatListRef.current?.scrollToEnd({ animated: false });
            }
          }}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Ionicons name="chatbubbles-outline" size={40} color={colors.border} />
              <Text style={[styles.emptyChatText, { color: colors.text }]}>
                Henuz mesaj yok
              </Text>
              <Text style={[styles.emptyChatSubtext, { color: colors.textSecondary }]}>
                Ilk mesaji sen gonder!
              </Text>
            </View>
          }
        />

        {/* Message input bar */}
        <View style={[styles.inputBar, { borderTopColor: colors.borderLight, backgroundColor: colors.background }]}>
          {!user ? (
            <TouchableOpacity
              style={styles.loginPrompt}
              onPress={() => router.push('/auth/login')}
              activeOpacity={0.7}
            >
              <Text style={[styles.loginPromptText, { color: Colors.primary }]}>
                Mesaj gondermek icin giris yap
              </Text>
            </TouchableOpacity>
          ) : !isAttendee ? (
            <View style={styles.joinPrompt}>
              <Ionicons name="lock-closed-outline" size={16} color={colors.textTertiary} />
              <Text style={[styles.joinPromptText, { color: colors.textTertiary }]}>
                Mesaj gondermek icin etkinlige katil
              </Text>
            </View>
          ) : (
            <>
              <Avatar
                uri={user.avatar_url}
                name={user.full_name ?? user.username ?? '?'}
                size={32}
              />
              <TextInput
                ref={inputRef}
                style={[styles.messageInput, { color: colors.text }]}
                placeholder="Mesaj yaz..."
                placeholderTextColor={colors.textTertiary}
                value={messageText}
                onChangeText={setMessageText}
                selectionColor={Colors.primary}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                onPress={handleSend}
                disabled={!messageText.trim() || submitting}
                activeOpacity={0.7}
                style={[
                  styles.sendButton,
                  messageText.trim()
                    ? { backgroundColor: Colors.primary }
                    : { backgroundColor: colors.border },
                ]}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="send" size={16} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Header bar
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
    justifyContent: 'center',
  },
  headerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  headerTitle: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
  },

  // Event info card
  eventCard: {
    margin: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  eventTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  meetupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: MEETUP_CYAN,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  meetupBadgeText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemiBold,
    color: '#FFFFFF',
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 166, 35, 0.12)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  dateBadgeText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemiBold,
    color: Colors.accent,
  },
  eventTitle: {
    fontSize: FontSize.xl,
    fontFamily: FontFamily.heading,
    marginTop: Spacing.xs,
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  venueName: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodySemiBold,
  },
  description: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    lineHeight: 20,
  },
  showMore: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemiBold,
    marginTop: 2,
  },

  // Attendees
  attendeesSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  attendeeAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  attendeeAvatar: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 14,
  },
  attendeeMore: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  attendeeMoreText: {
    fontSize: 10,
    fontFamily: FontFamily.bodySemiBold,
  },
  attendeeCount: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemiBold,
  },

  // Join button
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xs,
  },
  joinButtonText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.headingBold,
  },

  // Chat header
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  chatHeaderText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
  },

  // List
  listContent: {
    paddingBottom: Spacing.sm,
  },

  // Date separator
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  dateLine: {
    flex: 1,
    height: 1,
  },
  dateText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemiBold,
  },

  // Empty chat
  emptyChat: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl * 2,
    gap: Spacing.sm,
  },
  emptyChatText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.bodySemiBold,
  },
  emptyChatSubtext: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    gap: Spacing.md,
  },
  messageInput: {
    flex: 1,
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    paddingVertical: 0,
    maxHeight: 80,
  },
  sendButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginPrompt: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  loginPromptText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodySemiBold,
  },
  joinPrompt: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  joinPromptText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
  },
});
