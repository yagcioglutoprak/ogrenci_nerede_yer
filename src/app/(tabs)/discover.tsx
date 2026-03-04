import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFeedStore } from '../../stores/feedStore';
import { useVenueStore } from '../../stores/venueStore';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { Venue, Post } from '../../types';

// ---------------------------------------------------------------------------
// Section Header
// ---------------------------------------------------------------------------

function SectionHeader({
  title,
  icon,
  iconColor,
  colors,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View style={sectionStyles.header}>
      <View style={[sectionStyles.iconBadge, { backgroundColor: iconColor + '18' }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <Text style={[sectionStyles.headerTitle, { color: colors.text }]}>{title}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Trending Venue Card
// ---------------------------------------------------------------------------

function TrendingVenueCard({
  venue,
  index,
  colors,
  onPress,
}: {
  venue: Venue;
  index: number;
  colors: ReturnType<typeof useThemeColors>;
  onPress: () => void;
}) {
  const priceLabel = Array(venue.price_range).fill('\u20BA').join('');

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify().damping(18)}>
      <TouchableOpacity
        style={[trendingStyles.card, { backgroundColor: colors.card }]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Image
          source={
            venue.cover_image_url
              ? { uri: venue.cover_image_url }
              : require('../../../assets/logo.png')
          }
          style={trendingStyles.image}
          resizeMode="cover"
        />
        {/* Gradient overlay at bottom of image */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.55)']}
          style={trendingStyles.imageOverlay}
        />
        {/* Rating badge */}
        <View style={trendingStyles.ratingBadge}>
          <Ionicons name="star" size={10} color="#FFB800" />
          <Text style={trendingStyles.ratingText}>
            {venue.overall_rating.toFixed(1)}
          </Text>
        </View>
        {/* Info section */}
        <View style={trendingStyles.info}>
          <Text style={[trendingStyles.name, { color: colors.text }]} numberOfLines={1}>
            {venue.name}
          </Text>
          <View style={trendingStyles.pills}>
            <View style={[trendingStyles.pill, { backgroundColor: colors.primarySoft }]}>
              <Text style={[trendingStyles.pillText, { color: colors.primary }]}>
                {priceLabel}
              </Text>
            </View>
            {venue.tags.length > 0 && (
              <View style={[trendingStyles.pill, { backgroundColor: colors.backgroundSecondary }]}>
                <Text style={[trendingStyles.pillText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {venue.tags[0].replace('-', ' ')}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Meetup Event Card
// ---------------------------------------------------------------------------

function MeetupCard({
  post,
  index,
  colors,
  onPress,
}: {
  post: Post;
  index: number;
  colors: ReturnType<typeof useThemeColors>;
  onPress: () => void;
}) {
  const eventDate = post.event?.event_date
    ? new Date(post.event.event_date)
    : null;

  const day = eventDate ? eventDate.getDate() : '--';
  const month = eventDate
    ? eventDate.toLocaleDateString('tr-TR', { month: 'short' }).toUpperCase()
    : '';

  const attendeeCount = post.event?.attendee_count ?? 0;
  const venueName = post.event?.venue?.name ?? post.venue?.name ?? '';

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify().damping(18)}>
      <TouchableOpacity
        style={[meetupStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        {/* Date badge */}
        <View style={[meetupStyles.dateBadge, { backgroundColor: colors.primarySoft }]}>
          <Text style={[meetupStyles.dateDay, { color: colors.primary }]}>{day}</Text>
          <Text style={[meetupStyles.dateMonth, { color: colors.primary }]}>{month}</Text>
        </View>

        {/* Content */}
        <View style={meetupStyles.content}>
          <Text style={[meetupStyles.title, { color: colors.text }]} numberOfLines={2}>
            {post.event?.title ?? post.caption}
          </Text>

          {venueName ? (
            <View style={meetupStyles.metaRow}>
              <Ionicons name="location-outline" size={12} color={colors.textTertiary} />
              <Text style={[meetupStyles.metaText, { color: colors.textSecondary }]} numberOfLines={1}>
                {venueName}
              </Text>
            </View>
          ) : null}

          <View style={meetupStyles.metaRow}>
            <Ionicons name="people-outline" size={12} color={colors.textTertiary} />
            <Text style={[meetupStyles.metaText, { color: colors.textSecondary }]}>
              {attendeeCount} katilimci
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Question Item
// ---------------------------------------------------------------------------

function QuestionItem({
  post,
  index,
  colors,
  onPress,
}: {
  post: Post;
  index: number;
  colors: ReturnType<typeof useThemeColors>;
  onPress: () => void;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(index * 60).springify().damping(18)}>
      <TouchableOpacity
        style={[questionStyles.item, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <Image
          source={
            post.user?.avatar_url
              ? { uri: post.user.avatar_url }
              : require('../../../assets/logo.png')
          }
          style={questionStyles.avatar}
        />
        <View style={questionStyles.content}>
          <Text style={[questionStyles.text, { color: colors.text }]} numberOfLines={2}>
            {post.caption}
          </Text>
          <View style={questionStyles.metaRow}>
            <Ionicons name="chatbubble-outline" size={12} color={colors.textTertiary} />
            <Text style={[questionStyles.metaText, { color: colors.textSecondary }]}>
              {post.comments_count ?? 0} yanit
            </Text>
            <Text style={[questionStyles.dot, { color: colors.textTertiary }]}>{'\u00B7'}</Text>
            <Text style={[questionStyles.metaText, { color: colors.textTertiary }]}>
              {post.user?.username ?? 'anonim'}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Discover Screen
// ---------------------------------------------------------------------------

export default function DiscoverScreen() {
  const colors = useThemeColors();
  const router = useRouter();

  const venues = useVenueStore((s) => s.venues);
  const fetchVenues = useVenueStore((s) => s.fetchVenues);
  const posts = useFeedStore((s) => s.posts);
  const fetchPosts = useFeedStore((s) => s.fetchPosts);

  // Fetch data on mount if empty
  useEffect(() => {
    if (venues.length === 0) fetchVenues();
    if (posts.length === 0) fetchPosts();
  }, []);

  // Trending venues: top 8 by rating
  const trendingVenues = useMemo(() => {
    return [...venues]
      .sort((a, b) => b.overall_rating - a.overall_rating)
      .slice(0, 8);
  }, [venues]);

  // Meetup posts
  const meetupPosts = useMemo(() => {
    return posts.filter((p) => p.post_type === 'meetup');
  }, [posts]);

  // Question posts (max 5)
  const questionPosts = useMemo(() => {
    return posts.filter((p) => p.post_type === 'question').slice(0, 5);
  }, [posts]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Background gradient */}
      <LinearGradient
        colors={[colors.background, colors.backgroundSecondary]}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <Animated.View entering={FadeInDown.delay(0).duration(500)} style={styles.header}>
        <View style={styles.headerBrand}>
          <Image
            source={require('../../../assets/logo.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Kesfet</Text>
        </View>
      </Animated.View>

      {/* Scrollable content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ---- Section 1: Trend Mekanlar ---- */}
        <SectionHeader
          title="Trend Mekanlar"
          icon="flame"
          iconColor={Colors.primary}
          colors={colors}
        />
        {trendingVenues.length > 0 ? (
          <FlatList
            data={trendingVenues}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            renderItem={({ item, index }) => (
              <TrendingVenueCard
                venue={item}
                index={index}
                colors={colors}
                onPress={() => router.push(`/venue/${item.id}`)}
              />
            )}
          />
        ) : (
          <View style={styles.emptySection}>
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
              Henuz trend mekan yok
            </Text>
          </View>
        )}

        {/* ---- Section 2: Yaklasan Bulusmalar ---- */}
        <SectionHeader
          title="Yaklasan Bulusmalar"
          icon="people"
          iconColor="#06B6D4"
          colors={colors}
        />
        {meetupPosts.length > 0 ? (
          <FlatList
            data={meetupPosts}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
            renderItem={({ item, index }) => (
              <MeetupCard
                post={item}
                index={index}
                colors={colors}
                onPress={() => router.push(`/post/${item.id}`)}
              />
            )}
          />
        ) : (
          <View style={styles.emptySection}>
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
              Yakinda bulusma yok
            </Text>
          </View>
        )}

        {/* ---- Section 3: Populer Sorular ---- */}
        <SectionHeader
          title="Populer Sorular"
          icon="help-circle"
          iconColor="#8B5CF6"
          colors={colors}
        />
        {questionPosts.length > 0 ? (
          <View style={styles.questionList}>
            {questionPosts.map((post, index) => (
              <QuestionItem
                key={post.id}
                post={post}
                index={index}
                colors={colors}
                onPress={() => router.push(`/post/${post.id}`)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptySection}>
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
              Henuz soru sorulmamis
            </Text>
          </View>
        )}

        {/* Bottom spacer for tab bar */}
        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Root styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerLogo: {
    width: 32,
    height: 32,
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontFamily: FontFamily.heading,
    letterSpacing: -0.5,
  },
  scrollContent: {
    paddingTop: Spacing.xs,
  },
  horizontalList: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  emptySection: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
  },
  questionList: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
});

// ---------------------------------------------------------------------------
// Section header styles
// ---------------------------------------------------------------------------

const sectionStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.headingBold,
    letterSpacing: -0.3,
  },
});

// ---------------------------------------------------------------------------
// Trending venue card styles
// ---------------------------------------------------------------------------

const trendingStyles = StyleSheet.create({
  card: {
    width: 140,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  image: {
    width: 140,
    height: 160,
  },
  imageOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 60,
  },
  ratingBadge: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  ratingText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemiBold,
    color: '#FFFFFF',
  },
  info: {
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  name: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodySemiBold,
    letterSpacing: -0.2,
  },
  pills: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  pill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  pillText: {
    fontSize: FontSize.xs - 1,
    fontFamily: FontFamily.bodySemiBold,
  },
});

// ---------------------------------------------------------------------------
// Meetup card styles
// ---------------------------------------------------------------------------

const meetupStyles = StyleSheet.create({
  card: {
    width: 200,
    flexDirection: 'row',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  dateBadge: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.heading,
    lineHeight: 22,
  },
  dateMonth: {
    fontSize: FontSize.xs - 1,
    fontFamily: FontFamily.bodySemiBold,
    textTransform: 'uppercase',
  },
  content: {
    flex: 1,
    gap: Spacing.xs,
  },
  title: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodySemiBold,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
  },
});

// ---------------------------------------------------------------------------
// Question item styles
// ---------------------------------------------------------------------------

const questionStyles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8E8EC',
  },
  content: {
    flex: 1,
    gap: Spacing.xs,
  },
  text: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodyMedium,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
  },
  dot: {
    fontSize: FontSize.xs,
  },
});
