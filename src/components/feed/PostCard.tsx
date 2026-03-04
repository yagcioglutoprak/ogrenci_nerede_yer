import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  FlatList,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Pressable,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Colors, Spacing, FontSize, FontFamily, BorderRadius } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { Post, PostImage } from '../../types';
import Avatar from '../ui/Avatar';
import GlassView from '../ui/GlassView';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_MARGIN = Spacing.lg;
const IMAGE_WIDTH = SCREEN_WIDTH - CARD_MARGIN * 2;
const IMAGE_HEIGHT = IMAGE_WIDTH * 0.75; // 4:3 ratio instead of 1:1

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PostCardProps {
  post: Post;
  onLike?: (postId: string) => void;
  onComment?: (postId: string) => void;
  onShare?: (postId: string) => void;
  onBookmark?: (postId: string) => void;
  onVenuePress?: (venueId: string) => void;
  onUserPress?: (userId: string) => void;
}

export default function PostCard({
  post,
  onLike,
  onComment,
  onShare,
  onBookmark,
  onVenuePress,
  onUserPress,
}: PostCardProps) {
  const colors = useThemeColors();
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const flatListRef = useRef<FlatList<PostImage>>(null);

  // Like button bounce animation
  const likeScale = useSharedValue(1);
  const likeAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: likeScale.value }],
  }));

  // Bookmark animation
  const bookmarkScale = useSharedValue(1);
  const bookmarkAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bookmarkScale.value }],
  }));

  const images = post.images ?? [];
  const hasMultipleImages = images.length > 1;
  const timeSince = getRelativeTime(post.created_at);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / IMAGE_WIDTH);
    setActiveImageIndex(index);
  };

  const handleLike = useCallback(() => {
    likeScale.value = withSequence(
      withSpring(1.35, { damping: 4, stiffness: 400 }),
      withSpring(0.85, { damping: 4, stiffness: 400 }),
      withSpring(1, { damping: 8, stiffness: 300 }),
    );
    onLike?.(post.id);
  }, [post.id, onLike]);

  const handleBookmark = useCallback(() => {
    bookmarkScale.value = withSequence(
      withSpring(1.3, { damping: 4, stiffness: 400 }),
      withSpring(1, { damping: 8, stiffness: 300 }),
    );
    onBookmark?.(post.id);
  }, [post.id, onBookmark]);

  const handleShare = useCallback(async () => {
    const venueName = post.venue?.name ? ` @ ${post.venue.name}` : '';
    const message = `${post.caption || ''}${venueName}\n\nOgrenci Nerede Yer? uygulamasinda kesfet!`;
    try {
      await Share.share({ message: message.trim() });
    } catch {}
  }, [post]);

  return (
    <View style={[styles.card, { backgroundColor: colors.background }]}>
      {/* Header: Avatar + Username + Time */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => post.user && onUserPress?.(post.user_id)}
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
            onPress={() => post.user && onUserPress?.(post.user_id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.username, { color: colors.text }]} numberOfLines={1}>
              {post.user?.username ?? 'Kullanici'}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.time, { color: colors.textTertiary }]}>{timeSince}</Text>
        </View>

        <TouchableOpacity
          style={[styles.moreButton, { backgroundColor: colors.backgroundSecondary }]}
          activeOpacity={0.6}
        >
          <Ionicons name="ellipsis-horizontal" size={16} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* Image Carousel — rounded, with margins */}
      {images.length > 0 && (
        <View style={styles.imageWrapper}>
          <View style={[styles.imageSection, { backgroundColor: colors.backgroundSecondary }]}>
            <FlatList
              ref={flatListRef}
              data={images}
              keyExtractor={(item) => item.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              snapToInterval={IMAGE_WIDTH}
              decelerationRate="fast"
              renderItem={({ item }) => (
                <Image
                  source={{ uri: item.image_url }}
                  style={styles.postImage}
                  resizeMode="cover"
                />
              )}
            />

            {/* Venue tag — glass pill overlaid on image bottom */}
            {post.venue && (
              <TouchableOpacity
                onPress={() => post.venue && onVenuePress?.(post.venue.id)}
                activeOpacity={0.8}
                style={styles.venuePillWrapper}
              >
                {Platform.OS === 'ios' ? (
                  <GlassView style={styles.venuePillGlass} fallbackColor="rgba(0,0,0,0.55)">
                    <Ionicons name="location" size={12} color="#FFFFFF" />
                    <Text style={styles.venuePillText} numberOfLines={1}>
                      {post.venue.name}
                    </Text>
                  </GlassView>
                ) : (
                  <View style={styles.venuePillAndroid}>
                    <Ionicons name="location" size={12} color="#FFFFFF" />
                    <Text style={styles.venuePillText} numberOfLines={1}>
                      {post.venue.name}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}

            {/* Pagination dots */}
            {hasMultipleImages && (
              <View style={styles.pagination}>
                {images.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.dot,
                      index === activeImageIndex && styles.dotActive,
                    ]}
                  />
                ))}
              </View>
            )}

            {/* Image counter */}
            {hasMultipleImages && (
              <GlassView style={styles.imageCounter} fallbackColor="rgba(0, 0, 0, 0.55)">
                <Text style={styles.imageCounterText}>
                  {activeImageIndex + 1}/{images.length}
                </Text>
              </GlassView>
            )}
          </View>
        </View>
      )}

      {/* Compact Action Bar + Likes */}
      <View style={styles.bottomSection}>
        <View style={styles.actions}>
          <View style={styles.actionsLeft}>
            {/* Animated Like Button */}
            <AnimatedPressable
              onPress={handleLike}
              style={[styles.actionButton, likeAnimStyle]}
              hitSlop={8}
            >
              <Ionicons
                name={post.is_liked ? 'heart' : 'heart-outline'}
                size={24}
                color={post.is_liked ? Colors.primary : colors.text}
              />
            </AnimatedPressable>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => onComment?.(post.id)}
              activeOpacity={0.5}
              hitSlop={8}
            >
              <Ionicons name="chatbubble-outline" size={22} color={colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleShare}
              activeOpacity={0.5}
              hitSlop={8}
            >
              <Ionicons name="share-outline" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Animated Bookmark */}
          <AnimatedPressable
            onPress={handleBookmark}
            style={[styles.actionButton, bookmarkAnimStyle]}
            hitSlop={8}
          >
            <Ionicons name="bookmark-outline" size={22} color={colors.text} />
          </AnimatedPressable>
        </View>

        {/* Likes Count */}
        {(post.likes_count ?? 0) > 0 && (
          <Text style={[styles.likesCount, { color: colors.text }]}>
            {post.likes_count} begeni
          </Text>
        )}

        {/* Caption */}
        {post.caption ? (
          <Text style={[styles.caption, { color: colors.text }]} numberOfLines={3}>
            <Text style={styles.captionUsername}>
              {post.user?.username ?? 'Kullanici'}
            </Text>
            {'  '}{post.caption}
          </Text>
        ) : null}

        {/* Comments */}
        {(post.comments_count ?? 0) > 0 && (
          <TouchableOpacity
            onPress={() => onComment?.(post.id)}
            activeOpacity={0.6}
          >
            <Text style={[styles.commentsLink, { color: colors.textTertiary }]}>
              Tum yorumlari gor ({post.comments_count})
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
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

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.sm,
    paddingBottom: Spacing.xs,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: CARD_MARGIN,
    paddingVertical: Spacing.md,
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
  moreButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Image — rounded corners, not edge-to-edge
  imageWrapper: {
    paddingHorizontal: CARD_MARGIN,
  },
  imageSection: {
    position: 'relative',
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  postImage: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
  },

  // Venue glass pill overlay
  venuePillWrapper: {
    position: 'absolute',
    bottom: Spacing.md,
    left: Spacing.md,
    maxWidth: IMAGE_WIDTH * 0.6,
  },
  venuePillGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 1,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  venuePillAndroid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 1,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  venuePillText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemiBold,
    color: '#FFFFFF',
  },

  // Pagination
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    bottom: Spacing.md,
    left: 0,
    right: 0,
    gap: Spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
    width: 18,
    height: 6,
    borderRadius: 3,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
  },
  imageCounter: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    borderRadius: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    overflow: 'hidden',
  },
  imageCounterText: {
    color: Colors.textOnDark,
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemiBold,
  },

  // Bottom section
  bottomSection: {
    paddingHorizontal: CARD_MARGIN,
    paddingTop: Spacing.md,
    gap: Spacing.xs + 2,
  },

  // Actions
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  actionButton: {
    padding: 2,
  },

  // Likes
  likesCount: {
    fontSize: 14,
    fontFamily: FontFamily.headingBold,
    letterSpacing: -0.1,
  },

  // Caption
  caption: {
    fontSize: 14,
    fontFamily: FontFamily.body,
    lineHeight: 20,
  },
  captionUsername: {
    fontFamily: FontFamily.headingBold,
    letterSpacing: -0.1,
  },

  // Comments
  commentsLink: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    paddingBottom: Spacing.xs,
  },
});
