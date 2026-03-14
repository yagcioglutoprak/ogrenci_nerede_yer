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

type IoniconName = keyof typeof Ionicons.glyphMap;

interface CirclePickerProps {
  value: number;
  icons: IoniconName[];
  onValueChange?: (value: number) => void;
  color?: string;
  size?: number;
}

const AnimatedCircle = React.memo(function AnimatedCircle({
  step,
  icon,
  filled,
  color,
  size,
  backgroundColor,
  borderColor,
  textColor,
  onPress,
}: {
  step: number;
  icon: IoniconName;
  filled: boolean;
  color: string;
  size: number;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  onPress: (step: number) => void;
}) {
  const scale = useSharedValue(1);
  const selectionScale = useSharedValue(filled ? 1 : 0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * (0.92 + 0.08 * selectionScale.value) }],
  }));

  // Animate selection indicator on fill change
  React.useEffect(() => {
    selectionScale.value = withSpring(filled ? 1 : 0, {
      damping: 12,
      stiffness: 300,
    });
  }, [filled, selectionScale]);

  const handlePress = useCallback(() => {
    haptic.selection();
    scale.value = withSpring(1.2, { damping: 6, stiffness: 400 }, () => {
      scale.value = withSpring(1, { damping: 6, stiffness: 400 });
    });
    onPress(step);
  }, [step, onPress]);

  return (
    <Pressable onPress={handlePress}>
      <Animated.View
        style={[
          styles.circle,
          animatedStyle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: filled ? color : backgroundColor,
            borderWidth: filled ? 0 : 1.5,
            borderColor: filled ? 'transparent' : borderColor,
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={size * 0.42}
          color={filled ? '#FFFFFF' : textColor}
        />
      </Animated.View>
    </Pressable>
  );
});

export default function CirclePicker({
  value,
  icons,
  onValueChange,
  color = Colors.primary,
  size = 42,
}: CirclePickerProps) {
  const colors = useThemeColors();

  const circleTheme = useMemo(() => ({
    backgroundColor: colors.backgroundSecondary,
    borderColor: colors.border,
    textColor: colors.textTertiary,
  }), [colors.backgroundSecondary, colors.border, colors.textTertiary]);

  const handlePress = useCallback(
    (step: number) => {
      onValueChange?.(step);
    },
    [onValueChange],
  );

  return (
    <View style={styles.container}>
      {icons.map((icon, i) => {
        const step = i + 1;
        const filled = step <= value;

        return (
          <AnimatedCircle
            key={step}
            step={step}
            icon={icon}
            filled={filled}
            color={color}
            size={size}
            backgroundColor={circleTheme.backgroundColor}
            borderColor={circleTheme.borderColor}
            textColor={circleTheme.textColor}
            onPress={handlePress}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
