import React, { useRef, useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, FontFamily } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { Post, PostImage } from '../../types';
import Avatar from '../ui/Avatar';
import GlassView from '../ui/GlassView';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_HEIGHT = SCREEN_WIDTH;

interface PostCardProps {
  post: Post;
  onLike?: (postId: string) => void;
  onComment?: (postId: string) => void;
  onBookmark?: (postId: string) => void;
  onVenuePress?: (venueId: string) => void;
  onUserPress?: (userId: string) => void;
}

export default function PostCard({
  post,
  onLike,
  onComment,
  onBookmark,
  onVenuePress,
  onUserPress,
}: PostCardProps) {
  const colors = useThemeColors();
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const flatListRef = useRef<FlatList<PostImage>>(null);

  const images = post.images ?? [];
  const hasMultipleImages = images.length > 1;
  const timeSince = getRelativeTime(post.created_at);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    setActiveImageIndex(index);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.background, borderBottomColor: colors.borderLight }]}>
      {/* Header: Avatar + Username + Venue + Time */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => post.user && onUserPress?.(post.user_id)}
          activeOpacity={0.7}
        >
          <Avatar
            uri={post.user?.avatar_url}
            name={post.user?.full_name ?? post.user?.username ?? '?'}
            size={36}
          />
        </TouchableOpacity>

        <View style={styles.headerText}>
          <View style={styles.headerNameRow}>
            <TouchableOpacity
              onPress={() => post.user && onUserPress?.(post.user_id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.username, { color: colors.text }]} numberOfLines={1}>
                {post.user?.username ?? 'Kullanici'}
              </Text>
            </TouchableOpacity>
            {post.venue && (
              <TouchableOpacity
                onPress={() => post.venue && onVenuePress?.(post.venue.id)}
                activeOpacity={0.6}
                style={styles.venueRow}
              >
                <Ionicons name="location" size={11} color={Colors.primary} />
                <Text style={styles.venueLink} numberOfLines={1}>
                  {post.venue.name}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <Text style={[styles.time, { color: colors.textTertiary }]}>{timeSince}</Text>
      </View>

      {/* Image Carousel */}
      {images.length > 0 && (
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
            renderItem={({ item }) => (
              <Image
                source={{ uri: item.image_url }}
                style={styles.postImage}
                resizeMode="cover"
              />
            )}
          />

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
      )}

      {/* Action Buttons */}
      <View style={styles.actions}>
        <View style={styles.actionsLeft}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onLike?.(post.id)}
            activeOpacity={0.5}
          >
            <Ionicons
              name={post.is_liked ? 'heart' : 'heart-outline'}
              size={26}
              color={post.is_liked ? Colors.primary : colors.text}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onComment?.(post.id)}
            activeOpacity={0.5}
          >
            <Ionicons name="chatbubble-outline" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onBookmark?.(post.id)}
          activeOpacity={0.5}
        >
          <Ionicons name="bookmark-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Likes Count */}
      {(post.likes_count ?? 0) > 0 && (
        <Text style={[styles.likesCount, { color: colors.text }]}>
          {post.likes_count} begeni
        </Text>
      )}

      {/* Caption */}
      {post.caption ? (
        <View style={styles.captionRow}>
          <Text style={[styles.caption, { color: colors.text }]} numberOfLines={3}>
            <Text style={styles.captionUsername}>
              {post.user?.username ?? 'Kullanici'}
            </Text>
            {'  '}{post.caption}
          </Text>
        </View>
      ) : null}

      {/* Comments Count */}
      {(post.comments_count ?? 0) > 0 && (
        <TouchableOpacity
          onPress={() => onComment?.(post.id)}
          activeOpacity={0.6}
          style={styles.commentsRow}
        >
          <Text style={[styles.commentsLink, { color: colors.textSecondary }]}>
            Tum yorumlari gor ({post.comments_count})
          </Text>
        </TouchableOpacity>
      )}
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
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  headerText: {
    flex: 1,
  },
  headerNameRow: {
    gap: 2,
  },
  username: {
    fontSize: 14,
    fontFamily: FontFamily.headingBold,
    color: Colors.text,
    letterSpacing: -0.1,
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  venueLink: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '600',
  },
  time: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: '400',
  },

  // Image Carousel
  imageSection: {
    position: 'relative',
    backgroundColor: Colors.backgroundSecondary,
  },
  postImage: {
    width: SCREEN_WIDTH,
    height: IMAGE_HEIGHT,
  },
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
    fontWeight: '600',
  },

  // Actions
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
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
    color: Colors.text,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
    letterSpacing: -0.1,
  },

  // Caption
  captionRow: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
  },
  caption: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  captionUsername: {
    fontFamily: FontFamily.headingBold,
    letterSpacing: -0.1,
  },

  // Comments
  commentsRow: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
    paddingBottom: Spacing.lg,
  },
  commentsLink: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '400',
  },
});
