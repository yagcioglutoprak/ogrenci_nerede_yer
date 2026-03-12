import React, { useCallback } from 'react';
import {
  Pressable,
  Platform,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../hooks/useThemeColors';
import GlassView from './GlassView';
import { haptic } from '../../lib/haptics';

interface IconButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  size?: number;
  iconSize?: number;
  color?: string;
  backgroundColor?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  hitSlop?: number;
}

const SPRING_CONFIG = { damping: 6, stiffness: 400 };

const IconButton = React.memo(function IconButton({
  icon,
  size = 38,
  iconSize = 20,
  color,
  backgroundColor,
  onPress,
  style,
  accessibilityLabel,
  hitSlop = 8,
}: IconButtonProps) {
  const colors = useThemeColors();
  const scale = useSharedValue(1);

  const resolvedColor = color ?? colors.text;
  const resolvedBg = backgroundColor ?? colors.backgroundSecondary;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.9, SPRING_CONFIG);
    haptic.light();
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SPRING_CONFIG);
  }, [scale]);

  const containerSize = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  const iconContent = (
    <Ionicons name={icon} size={iconSize} color={resolvedColor} />
  );

  const isIOS = Platform.OS === 'ios';

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={{ top: hitSlop, right: hitSlop, bottom: hitSlop, left: hitSlop }}
    >
      <Animated.View style={[animatedStyle, style]}>
        {isIOS ? (
          <GlassView
            style={[styles.base, containerSize]}
            fallbackColor={resolvedBg}
          >
            {iconContent}
          </GlassView>
        ) : (
          <Animated.View
            style={[
              styles.base,
              containerSize,
              { backgroundColor: resolvedBg },
            ]}
          >
            {iconContent}
          </Animated.View>
        )}
      </Animated.View>
    </Pressable>
  );
});

export default IconButton;

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
