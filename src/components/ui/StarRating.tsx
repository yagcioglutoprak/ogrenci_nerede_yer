import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../lib/constants';

interface StarRatingProps {
  rating: number;
  maxStars?: number;
  size?: number;
  interactive?: boolean;
  onRatingChange?: (rating: number) => void;
  color?: string;
}

export default function StarRating({
  rating,
  maxStars = 5,
  size = 24,
  interactive = false,
  onRatingChange,
  color = Colors.star,
}: StarRatingProps) {
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
        : 'star-outline';

    const starColor = filled || halfFilled ? color : Colors.borderLight;

    const star = (
      <Ionicons
        name={iconName}
        size={size}
        color={starColor}
      />
    );

    if (interactive) {
      return (
        <TouchableOpacity
          key={index}
          onPress={() => handlePress(index)}
          activeOpacity={0.6}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          style={styles.starButton}
        >
          {star}
        </TouchableOpacity>
      );
    }

    return (
      <View key={index} style={styles.starDisplay}>
        {star}
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
  starButton: {
    paddingHorizontal: 2,
  },
  starDisplay: {
    paddingHorizontal: 1,
  },
});
