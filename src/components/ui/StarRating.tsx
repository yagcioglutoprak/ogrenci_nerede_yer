import React, { useCallback, useMemo } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';
import { haptic } from '../../lib/haptics';

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

const AnimatedStar = React.memo(function AnimatedStar({
  index,
  rating,
  starSize,
  resolvedColor,
  resolvedEmptyColor,
  gap,
  touchPadding,
  onPress,
}: {
  index: number;
  rating: number;
  starSize: number;
  resolvedColor: string;
  resolvedEmptyColor: string;
  gap: number;
  touchPadding: number;
  onPress: (index: number) => void;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    haptic.selection();
    scale.value = withSpring(1.3, { damping: 6, stiffness: 400 }, () => {
      scale.value = withSpring(1, { damping: 6, stiffness: 400 });
    });
    onPress(index);
  }, [index, onPress, scale]);

  const filled = rating >= index + 1;
  const halfFilled = !filled && rating >= index + 0.5;

  const iconName: keyof typeof Ionicons.glyphMap = filled
    ? 'star'
    : halfFilled
      ? 'star-half'
      : 'star-outline';

  const starColor = filled || halfFilled ? resolvedColor : resolvedEmptyColor;

  const hitSlopRect = useMemo(() => ({
    top: touchPadding,
    bottom: touchPadding,
    left: touchPadding / 2,
    right: touchPadding / 2,
  }), [touchPadding]);

  const padStyle = useMemo(() => ({ paddingHorizontal: gap }), [gap]);

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={hitSlopRect}
      style={padStyle}
    >
      <Animated.View style={animatedStyle}>
        <Ionicons name={iconName} size={starSize} color={starColor} />
      </Animated.View>
    </Pressable>
  );
});

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
  const starPadStyle = useMemo(() => ({ paddingHorizontal: gap / 2 }), [gap]);

  const handlePress = useCallback(
    (starIndex: number) => {
      if (interactive && onRatingChange) {
        onRatingChange(starIndex + 1);
      }
    },
    [interactive, onRatingChange],
  );

  const renderStar = (index: number) => {
    if (interactive) {
      return (
        <AnimatedStar
          key={index}
          index={index}
          rating={rating}
          starSize={starSize}
          resolvedColor={resolvedColor}
          resolvedEmptyColor={resolvedEmptyColor}
          gap={gap}
          touchPadding={touchPadding}
          onPress={handlePress}
        />
      );
    }

    const filled = rating >= index + 1;
    const halfFilled = !filled && rating >= index + 0.5;

    const iconName: keyof typeof Ionicons.glyphMap = filled
      ? 'star'
      : halfFilled
        ? 'star-half'
        : 'star-outline';

    const starColor = filled || halfFilled ? resolvedColor : resolvedEmptyColor;

    return (
      <View key={index} style={starPadStyle}>
        <Ionicons name={iconName} size={starSize} color={starColor} />
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
