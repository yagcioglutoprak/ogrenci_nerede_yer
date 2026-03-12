import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, getRatingColor, FontFamily } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';

type RatingBarSize = 'sm' | 'md' | 'lg';

const BAR_HEIGHTS: Record<RatingBarSize, number> = {
  sm: 4,
  md: 6,
  lg: 8,
};

const ICON_SIZES: Record<RatingBarSize, number> = {
  sm: 12,
  md: 15,
  lg: 18,
};

const LABEL_SIZES: Record<RatingBarSize, number> = {
  sm: 11,
  md: 13,
  lg: 15,
};

interface RatingBarProps {
  rating: number;
  maxRating?: number;
  size?: RatingBarSize;
  color?: string;
  /** Auto-determine bar color based on rating value (ignored if color is set) */
  autoColor?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  label?: string;
  showValue?: boolean;
  barWidth?: number;
}

export default function RatingBar({
  rating,
  maxRating = 5,
  size = 'md',
  color,
  autoColor = false,
  icon,
  label,
  showValue = true,
  barWidth,
}: RatingBarProps) {
  const colors = useThemeColors();
  const resolvedColor = color ?? (autoColor ? getRatingColor(rating, maxRating) : Colors.primary);
  const barHeight = BAR_HEIGHTS[size];
  const iconSize = ICON_SIZES[size];
  const labelSize = LABEL_SIZES[size];
  const percentage = Math.min((rating / maxRating) * 100, 100);

  const fillProgress = useSharedValue(0);

  const hasMounted = useRef(false);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      fillProgress.value = 0;
    }
    fillProgress.value = withSpring(percentage, {
      damping: 22,
      stiffness: 120,
    });
  }, [percentage, fillProgress]);

  const animatedFillStyle = useAnimatedStyle(() => ({
    width: `${fillProgress.value}%` as any,
    backgroundColor: resolvedColor,
    height: barHeight,
  }));

  return (
    <View style={styles.container}>
      {icon && (
        <Ionicons name={icon} size={iconSize} color={resolvedColor} />
      )}
      {label && (
        <Text style={[styles.label, { fontSize: labelSize, color: colors.textSecondary }]}>
          {label}
        </Text>
      )}
      <View
        style={[
          styles.track,
          {
            height: barHeight,
            backgroundColor: colors.border,
            ...(barWidth ? { width: barWidth } : { flex: 1 }),
          },
        ]}
      >
        <Animated.View
          style={[
            styles.fill,
            animatedFillStyle,
          ]}
        />
      </View>
      {showValue && (
        <Text style={[styles.value, { fontSize: labelSize, color: colors.text }]}>
          {rating.toFixed(1)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  label: {
    fontWeight: '600',
    minWidth: 24,
  },
  track: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: BorderRadius.full,
  },
  value: {
    fontFamily: FontFamily.headingBold,
    minWidth: 26,
    textAlign: 'right',
  },
});
