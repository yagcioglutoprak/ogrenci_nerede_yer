import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { Post, Event, EventAttendee } from '../../types';
import Avatar from '../ui/Avatar';

interface EventCardProps {
  post: Post;
  event: Event;
  currentUserId?: string;
  onJoin: (eventId: string) => void;
  onLeave?: (eventId: string) => void;
  onUserPress: (userId: string) => void;
  onVenuePress?: (venueId: string) => void;
  onPress?: () => void;
}

function formatEventDate(dateStr: string): string {
  const date = new Date(dateStr);
  const months = [
    'Ocak', 'Subat', 'Mart', 'Nisan', 'Mayis', 'Haziran',
    'Temmuz', 'Agustos', 'Eylul', 'Ekim', 'Kasim', 'Aralik',
  ];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${day} ${month}, ${hours}:${minutes}`;
}

function getRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffMinutes < 1) return 'simdi';
  if (diffMinutes < 60) return `${diffMinutes}dk`;
  if (diffHours < 24) return `${diffHours}sa`;
  if (diffDays < 7) return `${diffDays}g`;
  if (diffWeeks < 4) return `${diffWeeks}hf`;
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

function EventCard({
  post,
  event,
  currentUserId,
  onJoin,
  onLeave,
  onUserPress,
  onVenuePress,
  onPress,
}: EventCardProps) {
  const colors = useThemeColors();
  const timeSince = getRelativeTime(post.created_at);

  const attendees = event.attendees ?? [];
  const attendeeCount = event.attendee_count ?? attendees.length;
  const isFull = attendeeCount >= event.max_attendees;
  const hasJoined = currentUserId
    ? attendees.some(
        (a) => a.user_id === currentUserId && a.status === 'confirmed',
      )
    : false;

  const displayedAttendees = attendees
    .filter((a) => a.status === 'confirmed')
    .slice(0, 4);

  const handleJoinPress = useCallback(() => {
    if (hasJoined) {
      onLeave?.(event.id);
    } else {
      onJoin(event.id);
    }
  }, [event.id, hasJoined, onJoin, onLeave]);

  const venueName = event.venue?.name ?? event.location_name;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: colors.background,
          borderColor: colors.borderLight,
        },
      ]}
      activeOpacity={0.85}
      onPress={onPress}
    >
      {/* Header: Avatar + Username + Time */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => post.user && onUserPress(post.user_id)}
          activeOpacity={0.7}
        >
          <Avatar
            uri={post.user?.avatar_url}
            name={post.user?.full_name ?? post.user?.username ?? '?'}
            size={38}
          />
        </TouchableOpacity>

        <View style={styles.headerText}>
          <TouchableOpacity
            onPress={() => post.user && onUserPress(post.user_id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.username, { color: colors.text }]} numberOfLines={1}>
              {post.user?.username ?? 'Kullanici'}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.time, { color: colors.textTertiary }]}>{timeSince}</Text>
        </View>

        <View style={styles.meetupBadge}>
          <Ionicons name="people" size={12} color="#FFFFFF" />
          <Text style={styles.meetupBadgeText}>Bulusma</Text>
        </View>
      </View>

      {/* Event Body */}
      <View style={styles.body}>
        <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={2}>
          {event.title}
        </Text>

        {event.description ? (
          <Text
            style={[styles.eventDescription, { color: colors.textSecondary }]}
            numberOfLines={2}
          >
            {event.description}
          </Text>
        ) : null}

        {/* Date/time badge */}
        <View style={styles.dateBadge}>
          <Ionicons name="calendar-outline" size={14} color="#FFFFFF" />
          <Text style={styles.dateBadgeText}>
            {formatEventDate(event.event_date)}
          </Text>
        </View>

        {/* Venue location */}
        {venueName ? (
          <TouchableOpacity
            style={styles.venueRow}
            activeOpacity={0.7}
            onPress={() => {
              const venueId = event.venue_id ?? post.venue_id;
              if (venueId && onVenuePress) onVenuePress(venueId);
            }}
            disabled={!onVenuePress || (!event.venue_id && !post.venue_id)}
          >
            <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
            <Text
              style={[styles.venueName, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {venueName}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Attendees Section */}
      <View style={styles.attendeesSection}>
        <View style={styles.attendeesLeft}>
          {/* Overlapping avatar stack */}
          <View style={styles.avatarStack}>
            {displayedAttendees.map((attendee, index) => (
              <View
                key={attendee.user_id}
                style={[
                  styles.stackedAvatar,
                  { marginLeft: index === 0 ? 0 : -8 },
                ]}
              >
                <Avatar
                  uri={attendee.user?.avatar_url}
                  name={attendee.user?.full_name ?? attendee.user?.username ?? '?'}
                  size={28}
                />
              </View>
            ))}
          </View>

          <Text style={[styles.attendeeCountText, { color: colors.textSecondary }]}>
            {attendeeCount}/{event.max_attendees} kisi
          </Text>
        </View>
      </View>

      {/* Join Button */}
      <TouchableOpacity
        style={[
          styles.joinButton,
          hasJoined && styles.joinButtonJoined,
          isFull && !hasJoined && styles.joinButtonFull,
          hasJoined && { borderColor: Colors.primary },
        ]}
        activeOpacity={0.7}
        onPress={handleJoinPress}
        disabled={isFull && !hasJoined}
      >
        <Ionicons
          name={
            hasJoined
              ? 'checkmark-circle'
              : isFull
                ? 'close-circle-outline'
                : 'people'
          }
          size={18}
          color={
            hasJoined
              ? Colors.primary
              : isFull
                ? colors.textTertiary
                : '#FFFFFF'
          }
        />
        <Text
          style={[
            styles.joinButtonText,
            hasJoined && { color: Colors.primary },
            isFull && !hasJoined && { color: colors.textTertiary },
          ]}
        >
          {hasJoined ? 'Katildin' : isFull ? 'Dolu' : 'Katil'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Spacing.md,
  },
  headerText: {
    flex: 1,
    gap: 1,
  },
  username: {
    fontSize: 14,
    fontFamily: FontFamily.headingBold,
    letterSpacing: -0.1,
  },
  time: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
  },
  meetupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#06B6D4',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  meetupBadgeText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemiBold,
    color: '#FFFFFF',
  },

  // Body
  body: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
  eventTitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.headingBold,
    lineHeight: 22,
  },
  eventDescription: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    lineHeight: 18,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
  },
  dateBadgeText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodySemiBold,
    color: '#FFFFFF',
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  venueName: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodyMedium,
  },

  // Attendees
  attendeesSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  attendeesLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackedAvatar: {
    zIndex: 1,
  },
  attendeeCountText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodyMedium,
  },

  // Join Button
  joinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
  },
  joinButtonJoined: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
  },
  joinButtonFull: {
    backgroundColor: '#E8E8EC',
  },
  joinButtonText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
    color: '#FFFFFF',
  },
});

export default React.memo(EventCard);
