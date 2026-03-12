import React from 'react';
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

function ChipInner({
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

  const containerStyle: StyleProp<ViewStyle>[] = [
    styles.container,
    isSmall ? styles.containerSm : styles.containerMd,
  ];

  let textColor: string;
  let iconColor: string;

  switch (variant) {
    case 'filled': {
      containerStyle.push({
        backgroundColor: isSelected ? activeColor : colors.backgroundSecondary,
      });
      textColor = isSelected ? Colors.textOnPrimary : colors.textSecondary;
      iconColor = isSelected ? Colors.textOnPrimary : colors.textSecondary;
      break;
    }
    case 'outlined': {
      containerStyle.push({
        backgroundColor: isSelected ? hexToRgba(activeColor, 0.08) : 'transparent',
        borderWidth: 1,
        borderColor: isSelected ? activeColor : colors.border,
      });
      textColor = isSelected ? activeColor : colors.textSecondary;
      iconColor = isSelected ? activeColor : colors.textTertiary;
      break;
    }
    case 'soft':
    default: {
      containerStyle.push({
        backgroundColor: isSelected
          ? hexToRgba(activeColor, 0.14)
          : colors.backgroundSecondary,
      });
      textColor = isSelected ? activeColor : colors.textSecondary;
      iconColor = isSelected ? activeColor : colors.textTertiary;
      break;
    }
  }

  containerStyle.push(style);

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
}

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
