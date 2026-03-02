import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../lib/constants';
import type { Post, PostImage } from '../../types';
import Avatar from '../ui/Avatar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_HEIGHT = SCREEN_WIDTH;

interface PostCardProps {
  post: Post;
  onLike?: (postId: string) => void;
  onComment?: (postId: string) => void;
  onVenuePress?: (venueId: string) => void;
  onUserPress?: (userId: string) => void;
}

export default function PostCard({
  post,
  onLike,
  onComment,
  onVenuePress,
  onUserPress,
}: PostCardProps) {
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
    <View style={styles.card}>
      {/* Header: Avatar + Username + Venue Tag */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => post.user && onUserPress?.(post.user_id)}
        activeOpacity={0.7}
      >
        <Avatar
          uri={post.user?.avatar_url}
          name={post.user?.full_name ?? post.user?.username ?? '?'}
          size={36}
        />
        <View style={styles.headerText}>
          <Text style={styles.username} numberOfLines={1}>
            {post.user?.username ?? 'Kullanici'}
          </Text>
          {post.venue && (
            <TouchableOpacity
              onPress={() => post.venue && onVenuePress?.(post.venue.id)}
              activeOpacity={0.6}
            >
              <Text style={styles.venueLink} numberOfLines={1}>
                <Ionicons name="location" size={12} color={Colors.primary} />
                {' '}{post.venue.name}
              </Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.time}>{timeSince}</Text>
      </TouchableOpacity>

      {/* Image Carousel */}
      {images.length > 0 && (
        <View style={styles.imageSection}>
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
            <View style={styles.imageCounter}>
              <Text style={styles.imageCounterText}>
                {activeImageIndex + 1}/{images.length}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actions}>
        <View style={styles.actionsLeft}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onLike?.(post.id)}
            activeOpacity={0.6}
          >
            <Ionicons
              name={post.is_liked ? 'heart' : 'heart-outline'}
              size={26}
              color={post.is_liked ? Colors.error : Colors.text}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onComment?.(post.id)}
            activeOpacity={0.6}
          >
            <Ionicons name="chatbubble-outline" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Likes Count */}
      {(post.likes_count ?? 0) > 0 && (
        <Text style={styles.likesCount}>
          {post.likes_count} begeni
        </Text>
      )}

      {/* Caption */}
      {post.caption ? (
        <View style={styles.captionRow}>
          <Text style={styles.caption}>
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
        >
          <Text style={styles.commentsLink}>
            {post.comments_count} yorumun tumunu gor
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
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  headerText: {
    flex: 1,
  },
  username: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  venueLink: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
    marginTop: 1,
  },
  time: {
    fontSize: 12,
    color: Colors.textLight,
  },
  imageSection: {
    position: 'relative',
    backgroundColor: Colors.surfaceElevated,
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
    bottom: 12,
    left: 0,
    right: 0,
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  imageCounter: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  imageCounterText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
  },
  actionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  actionButton: {
    padding: 2,
  },
  likesCount: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
    paddingHorizontal: 14,
    marginTop: 2,
  },
  captionRow: {
    paddingHorizontal: 14,
    marginTop: 4,
  },
  caption: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  captionUsername: {
    fontWeight: '700',
  },
  commentsLink: {
    fontSize: 13,
    color: Colors.textSecondary,
    paddingHorizontal: 14,
    marginTop: 4,
    paddingBottom: 12,
  },
});
