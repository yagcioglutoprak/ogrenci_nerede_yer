import React from 'react';
import { View, Platform, StyleProp, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import {
  LiquidGlassView,
  isLiquidGlassSupported,
} from '@callstack/liquid-glass';
import { Colors, DarkColors } from '../../lib/constants';
import { useIsDarkMode } from '../../hooks/useThemeColors';

type GlassEffect = 'clear' | 'regular';

interface GlassViewProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  fallbackColor?: string;
  blurIntensity?: number;
  interactive?: boolean;
  effect?: GlassEffect;
}

/**
 * Platform-aware glass wrapper with three tiers:
 * 1. iOS 26+ with Liquid Glass support → native LiquidGlassView
 * 2. iOS < 26 → BlurView from expo-blur
 * 3. Android → plain View with semi-transparent background
 */
export default function GlassView({
  children,
  style,
  fallbackColor,
  blurIntensity = 80,
  interactive = false,
  effect = 'regular',
}: GlassViewProps) {
  const isDark = useIsDarkMode();
  const resolvedFallback =
    fallbackColor ?? (isDark ? DarkColors.glass.background : Colors.glass.background);

  // Android — plain View with semi-transparent background
  if (Platform.OS !== 'ios') {
    return (
      <View style={[{ backgroundColor: resolvedFallback }, style]}>
        {children}
      </View>
    );
  }

  // iOS 26+ — native Liquid Glass
  if (isLiquidGlassSupported) {
    return (
      <LiquidGlassView
        style={[{ overflow: 'hidden' as const }, style]}
        interactive={interactive}
        effect={effect}
        colorScheme={isDark ? 'dark' : 'light'}
      >
        {children}
      </LiquidGlassView>
    );
  }

  // iOS < 26 — BlurView fallback
  return (
    <BlurView
      intensity={blurIntensity}
      tint={isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
      style={[{ overflow: 'hidden' as const }, style]}
    >
      {children}
    </BlurView>
  );
}
