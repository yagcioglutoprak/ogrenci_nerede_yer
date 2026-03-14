import React, { useCallback, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { Badge } from '../../types';

interface BadgeCardProps {
  badge: Badge;
  earned?: boolean;
  earnedAt?: string;
  onPress?: () => void;
  index?: number;
}

const SPRING_CONFIG = { damping: 6, stiffness: 400 };

function BadgeCard({ badge, earned = false, earnedAt, onPress, index = 0 }: BadgeCardProps) {
  const colors = useThemeColors();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    if (onPress) {
      scale.value = withSpring(0.97, SPRING_CONFIG);
    }
  }, [onPress, scale]);

  const handlePressOut = useCallback(() => {
    if (onPress) {
      scale.value = withSpring(1, SPRING_CONFIG);
    }
  }, [onPress, scale]);

  const content = (
    <>
      <View style={[styles.iconCircle, { backgroundColor: earned ? badge.color : colors.border }]}>
        <Ionicons
          name={(badge.icon_name as any) || 'trophy'}
          size={20}
          color={earned ? '#FFFFFF' : colors.textTertiary}
        />
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { color: earned ? colors.text : colors.textTertiary }]} numberOfLines={1}>
          {badge.name}
        </Text>
        <Text style={[styles.description, { color: earned ? colors.textSecondary : colors.textTertiary }]} numberOfLines={1}>
          {badge.description}
        </Text>
      </View>
      {earned && (
        <Ionicons name="checkmark-circle" size={20} color={badge.color} />
      )}
      {!earned && (
        <Ionicons name="lock-closed" size={16} color={colors.textTertiary} />
      )}
    </>
  );

  const containerBgColor = useMemo(
    () => earned ? badge.color + '15' : colors.backgroundSecondary,
    [earned, badge.color, colors.backgroundSecondary],
  );
  const containerBorderColor = useMemo(
    () => earned ? badge.color + '40' : colors.border,
    [earned, badge.color, colors.border],
  );

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).springify().damping(20).stiffness(300)}
      style={animatedStyle}
    >
      {onPress ? (
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={[
            styles.container,
            { backgroundColor: containerBgColor, borderColor: containerBorderColor },
          ]}
        >
          {content}
        </Pressable>
      ) : (
        <View
          style={[
            styles.container,
            { backgroundColor: containerBgColor, borderColor: containerBorderColor },
          ]}
        >
          {content}
        </View>
      )}
    </Animated.View>
  );
}

export default React.memo(BadgeCard);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.headingBold,
  },
  description: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
  },
});
