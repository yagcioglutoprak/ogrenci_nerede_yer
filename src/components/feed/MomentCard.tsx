import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily, FeatureColors, SpringConfig } from '../../lib/constants';
import { haptic } from '../../lib/haptics';
import { getRelativeTime } from '../../lib/utils';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { Post } from '../../types';
import Avatar from '../ui/Avatar';
import GlassView from '../ui/GlassView';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_MARGIN = Spacing.lg;
const IMAGE_WIDTH = SCREEN_WIDTH - IMAGE_MARGIN * 2;
const IMAGE_HEIGHT = IMAGE_WIDTH * 0.85;

interface MomentCardProps {
  post: Post;
  onLike: (postId: string) => void;
  onJoinMoment: (postId: string) => void;
  onUserPress: (userId: string) => void;
  onVenuePress?: (venueId: string) => void;
  onPress?: () => void;
}

function getTimeRemaining(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return null;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours > 0) return `${hours}sa kaldi`;
  const minutes = Math.floor(diff / (1000 * 60));
  return `${minutes}dk kaldi`;
}

function LiveDot() {
  const pulseScale = useSharedValue(1);

  React.useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.4, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  return (
    <Animated.View style={[styles.liveDot, animatedStyle]} />
  );
}

function MomentCard({
  post,
  onLike,
  onJoinMoment,
  onUserPress,
  onVenuePress,
  onPress,
}: MomentCardProps) {
  const colors = useThemeColors();
  const timeSince = getRelativeTime(post.created_at);
  const timeRemaining = getTimeRemaining(post.expires_at);

  const images = post.images ?? [];
  const coverImage = images.length > 0 ? images[0].image_url : null;

  // Like animation
  const likeScale = useSharedValue(1);
  const likeAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: likeScale.value }],
  }));

  const handleLike = React.useCallback(() => {
    haptic.light();
    likeScale.value = withSequence(
      withSpring(1.35, SpringConfig.microBounce),
      withSpring(0.85, SpringConfig.microBounce),
      withSpring(1, SpringConfig.default),
    );
    onLike(post.id);
  }, [post.id, onLike]);

  return (
    <View
      style={[styles.card, { backgroundColor: Platform.OS === 'ios' ? 'transparent' : colors.background }]}
      accessibilityLabel={`${post.user?.full_name || 'Kullanici'} tarafindan paylasilan anlik`}
      accessibilityRole="button"
    >
      {Platform.OS === 'ios' && (
        <GlassView style={[StyleSheet.absoluteFill, { borderRadius: BorderRadius.lg }]} fallbackColor={colors.card} />
      )}
      {/* Image Section */}
      <TouchableOpacity
        style={styles.imageWrapper}
        activeOpacity={0.9}
        onPress={onPress}
      >
        {coverImage ? (
          <Image
            source={{ uri: coverImage }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder, { backgroundColor: colors.backgroundSecondary }]}>
            <Ionicons name="flash" size={40} color={colors.textTertiary} />
          </View>
        )}

        {/* "Su an burada" live badge — top left */}
        <View style={styles.liveBadge}>
          <LiveDot />
          <Text style={styles.liveBadgeText}>Su an burada</Text>
        </View>

        {/* Time remaining — top right */}
        {timeRemaining && (
          <View style={styles.timeRemainingBadge}>
            <Ionicons name="time-outline" size={12} color="#FFFFFF" />
            <Text style={styles.timeRemainingText}>{timeRemaining}</Text>
          </View>
        )}

        {/* Venue overlay — bottom of image */}
        {post.venue && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => post.venue && onVenuePress?.(post.venue.id)}
            style={Platform.OS !== 'ios' ? styles.venueOverlay : styles.venueOverlayWrapper}
          >
            {Platform.OS === 'ios' ? (
              <GlassView style={styles.venueOverlay} fallbackColor="rgba(0,0,0,0.55)">
                <Ionicons name="location" size={13} color="#FFFFFF" />
                <Text style={styles.venueOverlayText} numberOfLines={1}>
                  {post.venue.name}
                </Text>
              </GlassView>
            ) : (
              <>
                <Ionicons name="location" size={13} color="#FFFFFF" />
                <Text style={styles.venueOverlayText} numberOfLines={1}>
                  {post.venue.name}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* Below Image Content */}
      <View style={styles.bottomSection}>
        {/* User info row */}
        <View style={styles.userRow}>
          <TouchableOpacity
            onPress={() => post.user && onUserPress(post.user_id)}
            activeOpacity={0.7}
          >
            <Avatar
              uri={post.user?.avatar_url}
              name={post.user?.full_name ?? post.user?.username ?? '?'}
              size={32}
            />
          </TouchableOpacity>

          <View style={styles.userInfo}>
            <TouchableOpacity
              onPress={() => post.user && onUserPress(post.user_id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.username, { color: colors.text }]} numberOfLines={1}>
                {post.user?.username ?? 'Kullanici'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.time, { color: colors.textTertiary }]}>{timeSince}</Text>
        </View>

        {/* Caption */}
        {post.caption ? (
          <Text
            style={[styles.caption, { color: colors.text }]}
            numberOfLines={2}
          >
            {post.caption}
          </Text>
        ) : null}

        {/* Action Row */}
        <View style={styles.actionRow}>
          <Animated.View style={likeAnimStyle}>
            <TouchableOpacity
              onPress={handleLike}
              activeOpacity={0.6}
              hitSlop={8}
              style={styles.likeButton}
            >
              <Ionicons
                name={post.is_liked ? 'heart' : 'heart-outline'}
                size={22}
                color={post.is_liked ? Colors.primary : colors.text}
              />
              {(post.likes_count ?? 0) > 0 && (
                <Text style={[styles.likeCount, { color: colors.textSecondary }]}>
                  {post.likes_count}
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>

          <TouchableOpacity
            style={styles.joinMomentButton}
            activeOpacity={0.7}
            onPress={() => onJoinMoment(post.id)}
          >
            <Ionicons name="flash-outline" size={16} color={FeatureColors.moment} />
            <Text style={styles.joinMomentText}>Ben de geliyorum!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },

  // Image
  imageWrapper: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: IMAGE_HEIGHT,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Live badge — top left
  liveBadge: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: FeatureColors.liveGreen,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 1,
    borderRadius: BorderRadius.full,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#FFFFFF',
  },
  liveBadgeText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemiBold,
    color: '#FFFFFF',
  },

  // Time remaining — top right
  timeRemainingBadge: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 1,
    borderRadius: BorderRadius.full,
  },
  timeRemainingText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemiBold,
    color: '#FFFFFF',
  },

  // Venue overlay — bottom of image
  venueOverlay: {
    position: 'absolute',
    bottom: Spacing.md,
    left: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 1,
    borderRadius: BorderRadius.full,
    maxWidth: IMAGE_WIDTH * 0.7,
    ...Platform.select({
      ios: {
        overflow: 'hidden',
      },
      android: {},
    }),
  },
  venueOverlayWrapper: {
    position: 'absolute',
    bottom: Spacing.md,
    left: Spacing.md,
    maxWidth: IMAGE_WIDTH * 0.7,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  venueOverlayText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemiBold,
    color: '#FFFFFF',
  },

  // Bottom section
  bottomSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
  },

  // User row
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  userInfo: {
    flex: 1,
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

  // Caption
  caption: {
    fontSize: 14,
    fontFamily: FontFamily.body,
    lineHeight: 20,
  },

  // Action row
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.xs,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    padding: 2,
  },
  likeCount: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodySemiBold,
  },
  joinMomentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: FeatureColors.moment,
  },
  joinMomentText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodySemiBold,
    color: FeatureColors.moment,
  },
});

export default React.memo(MomentCard);
