import React from 'react';
import { View, Platform, StyleProp, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors, DarkColors } from '../../lib/constants';
import { useIsDarkMode } from '../../hooks/useThemeColors';

let ExpoGlassView: React.ComponentType<any> | null = null;
let isGlassAvailable = false;

try {
  const glassModule = require('expo-glass-effect');
  ExpoGlassView = glassModule.GlassView ?? null;
  isGlassAvailable =
    typeof glassModule.isGlassEffectAPIAvailable === 'function'
      ? glassModule.isGlassEffectAPIAvailable()
      : false;
} catch {
  // expo-glass-effect not available
}

type GlassEffect = 'clear' | 'regular';

interface GlassViewProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  effect?: GlassEffect;
  interactive?: boolean;
  tintColor?: string;
  fallbackColor?: string;
  blurIntensity?: number;
}

/**
 * Platform-aware glass wrapper:
 * - iOS 26+ with native Liquid Glass: renders expo-glass-effect GlassView
 * - Older iOS: renders BlurView from expo-blur
 * - Android: renders a plain View with fallbackColor background
 */
export default function GlassView({
  children,
  style,
  effect = 'regular',
  interactive = false,
  tintColor,
  fallbackColor,
  blurIntensity = 80,
}: GlassViewProps) {
  const isDark = useIsDarkMode();
  const resolvedFallback = fallbackColor ?? (isDark ? DarkColors.glass.background : Colors.glass.background);

  // Android — plain View with semi-transparent background
  if (Platform.OS !== 'ios') {
    return (
      <View style={[{ backgroundColor: resolvedFallback }, style]}>
        {children}
      </View>
    );
  }

  // iOS 26+ with native Liquid Glass API
  if (isGlassAvailable && ExpoGlassView) {
    return (
      <ExpoGlassView
        style={style}
        effect={effect}
        interactive={interactive}
        tintColor={tintColor}
      >
        {children}
      </ExpoGlassView>
    );
  }

  // Older iOS — BlurView fallback
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

export { isGlassAvailable };
