import React, { useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
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
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';
import { haptic } from '../../lib/haptics';

type ChipVariant = 'filled' | 'outlined' | 'soft';
type ChipSize = 'sm' | 'md';

interface ChipProps {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
  variant?: ChipVariant;
  size?: ChipSize;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

function hexToRgba(hex: string, alpha: number): string {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const ChipInner = React.memo(function ChipInner({
  label,
  icon,
  color = Colors.primary,
  variant = 'soft',
  size = 'md',
  selected = false,
  style,
}: Omit<ChipProps, 'onPress'>) {
  const colors = useThemeColors();
  const isSmall = size === 'sm';

  const activeColor = selected ? color : color;
  const isSelected = selected;

  const { containerStyle, textColor, iconColor } = useMemo(() => {
    const cs: StyleProp<ViewStyle>[] = [
      styles.container,
      isSmall ? styles.containerSm : styles.containerMd,
    ];

    let tc: string;
    let ic: string;

    switch (variant) {
      case 'filled': {
        cs.push({
          backgroundColor: isSelected ? activeColor : colors.backgroundSecondary,
        });
        tc = isSelected ? Colors.textOnPrimary : colors.textSecondary;
        ic = isSelected ? Colors.textOnPrimary : colors.textSecondary;
        break;
      }
      case 'outlined': {
        cs.push({
          backgroundColor: isSelected ? hexToRgba(activeColor, 0.08) : 'transparent',
          borderWidth: 1,
          borderColor: isSelected ? activeColor : colors.border,
        });
        tc = isSelected ? activeColor : colors.textSecondary;
        ic = isSelected ? activeColor : colors.textTertiary;
        break;
      }
      case 'soft':
      default: {
        cs.push({
          backgroundColor: isSelected
            ? hexToRgba(activeColor, 0.14)
            : colors.backgroundSecondary,
        });
        tc = isSelected ? activeColor : colors.textSecondary;
        ic = isSelected ? activeColor : colors.textTertiary;
        break;
      }
    }

    cs.push(style);

    return { containerStyle: cs, textColor: tc, iconColor: ic };
  }, [isSmall, variant, isSelected, activeColor, colors, style]);

  return (
    <View style={containerStyle}>
      {icon && (
        <Ionicons
          name={icon}
          size={isSmall ? 13 : 15}
          color={iconColor}
          style={styles.icon}
        />
      )}
      <Text
        style={[
          styles.label,
          isSmall ? styles.labelSm : styles.labelMd,
          { color: textColor },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
});

const SPRING_CONFIG = { damping: 6, stiffness: 400 };

function AnimatedChip({ onPress, ...rest }: ChipProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.92, SPRING_CONFIG);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, SPRING_CONFIG);
  };

  const handlePress = () => {
    haptic.selection();
    onPress?.();
  };

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={animatedStyle}>
        <ChipInner {...rest} />
      </Animated.View>
    </Pressable>
  );
}

const Chip = React.memo(function Chip(props: ChipProps) {
  const { onPress, ...rest } = props;

  if (onPress) {
    return <AnimatedChip onPress={onPress} {...rest} />;
  }

  return <ChipInner {...rest} />;
});

export default Chip;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  containerSm: {
    height: 28,
    paddingHorizontal: Spacing.md,
  },
  containerMd: {
    height: 34,
    paddingHorizontal: Spacing.lg,
  },
  icon: {
    marginRight: Spacing.xs,
  },
  label: {
    fontFamily: FontFamily.bodySemiBold,
    letterSpacing: 0.1,
  },
  labelSm: {
    fontSize: FontSize.xs,
  },
  labelMd: {
    fontSize: FontSize.sm,
  },
});
