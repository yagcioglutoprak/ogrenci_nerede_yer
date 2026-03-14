import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '../../hooks/useThemeColors';
import { BorderRadius, Spacing } from '../../lib/constants';

const shimmerOverlayStyle = {
  position: 'absolute' as const,
  top: 0,
  bottom: 0,
  width: 200,
  left: '50%' as const,
};
const GRADIENT_START = { x: 0, y: 0.5 };
const GRADIENT_END = { x: 1, y: 0.5 };
const flexOne = { flex: 1 };

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonProps) {
  const colors = useThemeColors();
  const translateX = useSharedValue(-1);

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(translateX.value, [-1, 1], [-200, 200]) }],
  }));

  const containerStyle = useMemo(() => ({
    width: width as any,
    height,
    borderRadius,
    backgroundColor: colors.shimmer,
    overflow: 'hidden' as const,
  }), [width, height, borderRadius, colors.shimmer]);

  const gradientColors = useMemo<[string, string, string]>(() => [
    'transparent',
    colors.shimmerHighlight ?? 'rgba(255,255,255,0.3)',
    'transparent',
  ], [colors.shimmerHighlight]);

  return (
    <View
      style={[
        containerStyle,
        style,
      ]}
    >
      <Animated.View
        style={[
          shimmerOverlayStyle,
          shimmerStyle,
        ]}
      >
        <LinearGradient
          colors={gradientColors}
          start={GRADIENT_START}
          end={GRADIENT_END}
          style={flexOne}
        />
      </Animated.View>
    </View>
  );
}

// Pre-built skeleton layouts for common patterns

export function PostCardSkeleton() {
  const colors = useThemeColors();
  return (
    <View style={[skeletonStyles.postCard, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={skeletonStyles.postHeader}>
        <Skeleton width={40} height={40} borderRadius={20} />
        <View style={skeletonStyles.postHeaderText}>
          <Skeleton width={120} height={14} />
          <Skeleton width={80} height={11} style={{ marginTop: 6 }} />
        </View>
        <Skeleton width={32} height={11} />
      </View>
      {/* Image */}
      <Skeleton width="100%" height={260} borderRadius={16} style={{ marginTop: 8 }} />
      {/* Actions */}
      <View style={skeletonStyles.postActions}>
        <Skeleton width={28} height={28} borderRadius={14} />
        <Skeleton width={28} height={28} borderRadius={14} />
        <View style={{ flex: 1 }} />
        <Skeleton width={28} height={28} borderRadius={14} />
      </View>
      {/* Text */}
      <Skeleton width={60} height={14} style={{ marginTop: 4 }} />
      <Skeleton width="90%" height={13} style={{ marginTop: 8 }} />
      <Skeleton width="60%" height={13} style={{ marginTop: 4 }} />
    </View>
  );
}

export function ProfileSkeleton() {
  const colors = useThemeColors();
  return (
    <View style={{ padding: Spacing.lg }}>
      {/* Cover area */}
      <Skeleton width="100%" height={140} borderRadius={BorderRadius.xl} />
      {/* Avatar */}
      <View style={{ alignItems: 'center', marginTop: -36 }}>
        <Skeleton width={72} height={72} borderRadius={36} />
      </View>
      {/* Name */}
      <View style={{ alignItems: 'center', marginTop: 12 }}>
        <Skeleton width={160} height={20} />
        <Skeleton width={100} height={14} style={{ marginTop: 8 }} />
      </View>
      {/* Stats */}
      <View style={[skeletonStyles.statsRow, { marginTop: 20 }]}>
        <Skeleton width={60} height={48} borderRadius={12} />
        <Skeleton width={60} height={48} borderRadius={12} />
        <Skeleton width={60} height={48} borderRadius={12} />
      </View>
    </View>
  );
}

export function VenueDetailSkeleton() {
  return (
    <View>
      {/* Hero */}
      <Skeleton width="100%" height={280} borderRadius={0} />
      {/* Rating card */}
      <View style={{ padding: Spacing.lg, marginTop: -24 }}>
        <Skeleton width="100%" height={180} borderRadius={BorderRadius.lg} />
      </View>
      {/* Info rows */}
      <View style={{ paddingHorizontal: Spacing.lg, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Skeleton width={32} height={32} borderRadius={16} />
          <Skeleton width="70%" height={16} />
        </View>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Skeleton width={32} height={32} borderRadius={16} />
          <Skeleton width="50%" height={16} />
        </View>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Skeleton width={32} height={32} borderRadius={16} />
          <Skeleton width="40%" height={16} />
        </View>
      </View>
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  postCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  postHeaderText: {
    flex: 1,
  },
  postActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    marginTop: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
  },
});
