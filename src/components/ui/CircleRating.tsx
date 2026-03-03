import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, BorderRadius, getRatingColor } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';

type CircleSize = 'sm' | 'md' | 'lg';

const SIZES: Record<CircleSize, { outer: number; border: number; font: number }> = {
  sm: { outer: 30, border: 3, font: 11 },
  md: { outer: 44, border: 3.5, font: 15 },
  lg: { outer: 56, border: 4, font: 19 },
};

interface CircleRatingProps {
  score: number;
  maxScore?: number;
  size?: CircleSize;
  color?: string;
  /** Auto-determine color based on score value (ignored if color is set) */
  autoColor?: boolean;
}

export default function CircleRating({
  score,
  maxScore = 10,
  size = 'md',
  color,
  autoColor = false,
}: CircleRatingProps) {
  const resolvedColor = color ?? (autoColor ? getRatingColor(score, maxScore) : Colors.accent);
  const colors = useThemeColors();
  const dims = SIZES[size];

  // Color intensity based on score
  const progress = Math.min(score / maxScore, 1);
  const bgOpacity = 0.08 + progress * 0.12; // 8-20%

  return (
    <View
      style={[
        styles.circle,
        {
          width: dims.outer,
          height: dims.outer,
          borderRadius: dims.outer / 2,
          borderWidth: dims.border,
          borderColor: resolvedColor,
          backgroundColor: `${resolvedColor}${Math.round(bgOpacity * 255).toString(16).padStart(2, '0')}`,
        },
      ]}
    >
      <Text style={[styles.score, { fontSize: dims.font, color: resolvedColor }]}>
        {score}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: {
    fontWeight: '900',
    letterSpacing: -0.5,
  },
});
