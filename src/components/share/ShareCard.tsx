import React, { forwardRef, useMemo } from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../../lib/constants';
import type { Venue, Post, Event } from '../../types';

const CARD_WIDTH = Dimensions.get('window').width - 48;
const CARD_HEIGHT = CARD_WIDTH * 1.5; // Roughly IG-story-friendly ratio

interface ShareCardProps {
  venue?: Venue;
  post?: Post;
  event?: Event;
  type: 'venue' | 'post' | 'event';
}

const ShareCard = forwardRef<View, ShareCardProps>(({ venue, post, event, type }, ref) => {
  // The card renders differently based on type:
  // - venue: venue photo background with gradient, name, rating, price, branding
  // - post: post image with caption and venue link
  // - event: event details with date, attendees, venue

  const eventDateLabel = useMemo(() => {
    if (type !== 'event' || !event) return '';
    return new Date(event.event_date).toLocaleDateString('tr-TR', {
      day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
    });
  }, [type, event?.event_date]);

  return (
    <View ref={ref} style={styles.card} collapsable={false}>
      {/* Background image */}
      {type === 'venue' && venue?.cover_image_url && (
        <Image source={{ uri: venue.cover_image_url }} style={styles.bgImage} />
      )}
      {type === 'post' && post?.images?.[0] && (
        <Image source={{ uri: post.images[0].image_url }} style={styles.bgImage} />
      )}

      {/* Gradient overlay */}
      <View style={styles.gradientOverlay} />

      {/* Content */}
      <View style={styles.content}>
        {/* Top: type badge */}
        <View style={styles.typeBadge}>
          <Ionicons
            name={type === 'venue' ? 'restaurant' : type === 'event' ? 'people' : 'camera'}
            size={14}
            color="#FFFFFF"
          />
          <Text style={styles.typeBadgeText}>
            {type === 'venue' ? 'Mekan' : type === 'event' ? 'Bulusma' : 'Kesif'}
          </Text>
        </View>

        {/* Middle: main info */}
        <View style={styles.mainInfo}>
          {type === 'venue' && venue && (
            <>
              <Text style={styles.title} numberOfLines={2}>{venue.name}</Text>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={18} color={Colors.star} />
                <Text style={styles.ratingText}>{venue.overall_rating.toFixed(1)}</Text>
                <Text style={styles.reviewCount}>({venue.total_reviews} degerlendirme)</Text>
              </View>
              {venue.address && (
                <View style={styles.addressRow}>
                  <Ionicons name="location-outline" size={14} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.addressText} numberOfLines={1}>{venue.address}</Text>
                </View>
              )}
            </>
          )}

          {type === 'post' && post && (
            <>
              {post.venue?.name && (
                <Text style={styles.venueName}>{post.venue.name}</Text>
              )}
              <Text style={styles.caption} numberOfLines={3}>{post.caption}</Text>
            </>
          )}

          {type === 'event' && event && (
            <>
              <Text style={styles.title}>{event.title}</Text>
              <View style={styles.dateRow}>
                <Ionicons name="calendar-outline" size={16} color="#FFFFFF" />
                <Text style={styles.dateText}>
                  {eventDateLabel}
                </Text>
              </View>
              {event.description && (
                <Text style={styles.caption} numberOfLines={2}>{event.description}</Text>
              )}
            </>
          )}
        </View>

        {/* Bottom: branding */}
        <View style={styles.branding}>
          <View style={styles.brandingLine} />
          <Text style={styles.brandingText}>Ogrenci Nerede Yer?</Text>
          <Text style={styles.brandingSubtext}>Uygulamada kesfet</Text>
        </View>
      </View>
    </View>
  );
});

ShareCard.displayName = 'ShareCard';
export default React.memo(ShareCard);

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    padding: Spacing.xl,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
  },
  typeBadgeText: {
    color: '#FFFFFF',
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemiBold,
  },
  mainInfo: {
    gap: Spacing.sm,
  },
  title: {
    color: '#FFFFFF',
    fontSize: FontSize.xxl,
    fontFamily: FontFamily.headingBold,
    letterSpacing: -0.5,
  },
  venueName: {
    color: Colors.accent,
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
  },
  caption: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    lineHeight: 22,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  ratingText: {
    color: '#FFFFFF',
    fontSize: FontSize.lg,
    fontFamily: FontFamily.headingBold,
  },
  reviewCount: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  addressText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dateText: {
    color: '#FFFFFF',
    fontSize: FontSize.md,
    fontFamily: FontFamily.bodySemiBold,
  },
  branding: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  brandingLine: {
    width: 40,
    height: 3,
    backgroundColor: Colors.primary,
    borderRadius: 2,
    marginBottom: Spacing.xs,
  },
  brandingText: {
    color: '#FFFFFF',
    fontSize: FontSize.lg,
    fontFamily: FontFamily.headingBold,
    letterSpacing: -0.3,
  },
  brandingSubtext: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
  },
});
