import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';

type StarSize = 'sm' | 'md' | 'lg';

const STAR_SIZES: Record<StarSize, number> = {
  sm: 16,
  md: 22,
  lg: 28,
};

interface StarRatingProps {
  rating: number;
  maxStars?: number;
  size?: StarSize | number;
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
  color?: string;
  emptyColor?: string;
  gap?: number;
}

export default function StarRating({
  rating,
  maxStars = 5,
  size = 'md',
  interactive = false,
  onRatingChange,
  color,
  emptyColor,
  gap = 2,
}: StarRatingProps) {
  const colors = useThemeColors();
  const resolvedColor = color ?? colors.star;
  const resolvedEmptyColor = emptyColor ?? colors.starEmpty;
  const starSize = typeof size === 'number' ? size : STAR_SIZES[size];
  const touchPadding = Math.max(4, Math.round(starSize * 0.3));

  const handlePress = (starIndex: number) => {
    if (interactive && onRatingChange) {
      onRatingChange(starIndex + 1);
    }
  };

  const renderStar = (index: number) => {
    const filled = rating >= index + 1;
    const halfFilled = !filled && rating >= index + 0.5;

    const iconName: keyof typeof Ionicons.glyphMap = filled
      ? 'star'
      : halfFilled
        ? 'star-half'
        : 'star';

    const starColor = filled || halfFilled ? resolvedColor : resolvedEmptyColor;

    const starIcon = (
      <Ionicons name={iconName} size={starSize} color={starColor} />
    );

    if (interactive) {
      return (
        <TouchableOpacity
          key={index}
          onPress={() => handlePress(index)}
          activeOpacity={0.5}
          hitSlop={{
            top: touchPadding,
            bottom: touchPadding,
            left: touchPadding / 2,
            right: touchPadding / 2,
          }}
          style={{ paddingHorizontal: gap }}
        >
          {starIcon}
        </TouchableOpacity>
      );
    }

    return (
      <View key={index} style={{ paddingHorizontal: gap / 2 }}>
        {starIcon}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {Array.from({ length: maxStars }, (_, i) => renderStar(i))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
