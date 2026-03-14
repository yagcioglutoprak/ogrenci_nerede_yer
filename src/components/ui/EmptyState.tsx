import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';

// Custom illustrated empty states — built with layered Views
// instead of generic circle-icon patterns

type EmptyStateVariant = 'feed' | 'favorites' | 'posts' | 'reviews' | 'generic';

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}

function FeedIllustration() {
  const colors = useThemeColors();
  return (
    <View style={illustrationStyles.container}>
      {/* Stacked cards effect */}
      <Animated.View entering={FadeInDown.delay(50).springify().damping(20).stiffness(300)} style={[illustrationStyles.backCard, { backgroundColor: colors.accentSoft }]} />
      <Animated.View entering={FadeInDown.delay(100).springify().damping(20).stiffness(300)} style={[illustrationStyles.midCard, { backgroundColor: colors.primarySoft }]} />
      <Animated.View entering={FadeInDown.delay(100).springify().damping(20).stiffness(300)} style={[illustrationStyles.frontCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
        {/* Mini food plate icon cluster */}
        <View style={illustrationStyles.iconRow}>
          <View style={[illustrationStyles.miniIcon, { backgroundColor: Colors.primarySoft }]}>
            <Ionicons name="restaurant" size={18} color={Colors.primary} />
          </View>
          <View style={[illustrationStyles.miniIcon, { backgroundColor: Colors.accentSoft }]}>
            <Ionicons name="camera" size={18} color={Colors.accent} />
          </View>
          <View style={[illustrationStyles.miniIcon, { backgroundColor: '#E8F5E9' }]}>
            <Ionicons name="heart" size={18} color="#4CAF50" />
          </View>
        </View>
        {/* Mini lines representing content */}
        <View style={[illustrationStyles.miniLine, { width: 60, backgroundColor: colors.shimmer }]} />
        <View style={[illustrationStyles.miniLine, { width: 44, backgroundColor: colors.shimmer }]} />
      </Animated.View>
    </View>
  );
}

function FavoritesIllustration() {
  const colors = useThemeColors();
  return (
    <View style={illustrationStyles.container}>
      <Animated.View entering={FadeInUp.delay(50).springify().damping(20).stiffness(300)}>
        <View style={[illustrationStyles.heartContainer, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="heart" size={40} color={Colors.primary} style={{ opacity: 0.3 }} />
          <View style={illustrationStyles.heartOverlay}>
            <Ionicons name="heart-outline" size={32} color={Colors.primary} />
          </View>
          {/* Floating mini hearts */}
          <View style={[illustrationStyles.floatingHeart, { top: -6, right: -4 }]}>
            <Ionicons name="heart" size={14} color={Colors.accent} />
          </View>
          <View style={[illustrationStyles.floatingHeart, { bottom: 2, left: -8 }]}>
            <Ionicons name="heart" size={10} color={Colors.primaryLight} />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

function PostsIllustration() {
  const colors = useThemeColors();
  return (
    <View style={illustrationStyles.container}>
      <Animated.View entering={FadeInDown.delay(100).springify().damping(20).stiffness(300)}>
        <View style={[illustrationStyles.cameraFrame, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
          <View style={[illustrationStyles.cameraLens, { borderColor: Colors.primary }]}>
            <Ionicons name="aperture" size={28} color={Colors.primary} />
          </View>
          {/* Flash dot */}
          <View style={illustrationStyles.flashDot} />
          {/* Shutter effect lines */}
          <View style={[illustrationStyles.shutterLine, { backgroundColor: colors.shimmer, top: 10 }]} />
          <View style={[illustrationStyles.shutterLine, { backgroundColor: colors.shimmer, bottom: 10 }]} />
        </View>
      </Animated.View>
    </View>
  );
}

function ReviewsIllustration() {
  const colors = useThemeColors();
  return (
    <View style={illustrationStyles.container}>
      <Animated.View entering={FadeInDown.delay(50).springify().damping(20).stiffness(300)}>
        <View style={[illustrationStyles.speechBubble, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
          <View style={illustrationStyles.starsRow}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Ionicons key={i} name="star" size={16} color={i <= 3 ? Colors.star : colors.starEmpty} />
            ))}
          </View>
          <View style={[illustrationStyles.miniLine, { width: 52, backgroundColor: colors.shimmer }]} />
          <View style={[illustrationStyles.miniLine, { width: 36, backgroundColor: colors.shimmer }]} />
          {/* Tail */}
          <View style={[illustrationStyles.bubbleTail, { borderTopColor: colors.backgroundSecondary }]} />
        </View>
      </Animated.View>
    </View>
  );
}

const ILLUSTRATION_MAP: Record<EmptyStateVariant, React.FC> = {
  feed: FeedIllustration,
  favorites: FavoritesIllustration,
  posts: PostsIllustration,
  reviews: ReviewsIllustration,
  generic: FeedIllustration,
};

function EmptyState({ variant = 'generic', title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  const colors = useThemeColors();

  const Illustration = ILLUSTRATION_MAP[variant];

  return (
    <View style={styles.container}>
      <Illustration />
      <Animated.Text
        entering={FadeInDown.delay(200).springify().damping(20).stiffness(300)}
        style={[styles.title, { color: colors.text }]}
      >
        {title}
      </Animated.Text>
      <Animated.Text
        entering={FadeInDown.delay(280).springify().damping(20).stiffness(300)}
        style={[styles.subtitle, { color: colors.textSecondary }]}
      >
        {subtitle}
      </Animated.Text>
      {actionLabel && onAction && (
        <Animated.View entering={FadeInUp.delay(360).springify().damping(20).stiffness(300)}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onAction}
            activeOpacity={0.8}
          >
            <Text style={styles.actionText}>{actionLabel}</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

export default React.memo(EmptyState);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: Spacing.xxxl,
  },
  title: {
    fontSize: FontSize.xl,
    fontFamily: FontFamily.heading,
    textAlign: 'center',
    marginTop: Spacing.xxl,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: Spacing.sm,
  },
  actionButton: {
    marginTop: Spacing.xxl,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  actionText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
    color: '#FFFFFF',
  },
});

const illustrationStyles = StyleSheet.create({
  container: {
    width: 140,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Feed variant
  backCard: {
    position: 'absolute',
    width: 90,
    height: 70,
    borderRadius: 14,
    transform: [{ rotate: '-8deg' }, { translateX: -12 }],
  },
  midCard: {
    position: 'absolute',
    width: 90,
    height: 70,
    borderRadius: 14,
    transform: [{ rotate: '4deg' }, { translateX: 8 }],
  },
  frontCard: {
    width: 100,
    height: 80,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  iconRow: {
    flexDirection: 'row',
    gap: 6,
  },
  miniIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniLine: {
    height: 4,
    borderRadius: 2,
  },
  // Favorites variant
  heartContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartOverlay: {
    position: 'absolute',
  },
  floatingHeart: {
    position: 'absolute',
  },
  // Posts variant
  cameraFrame: {
    width: 96,
    height: 80,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraLens: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashDot: {
    position: 'absolute',
    top: 8,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  shutterLine: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: 2,
    borderRadius: 1,
  },
  // Reviews variant
  speechBubble: {
    width: 110,
    height: 76,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    gap: 6,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  bubbleTail: {
    position: 'absolute',
    bottom: -8,
    left: 20,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
