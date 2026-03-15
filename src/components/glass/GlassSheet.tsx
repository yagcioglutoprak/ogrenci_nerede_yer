import React, { useMemo } from 'react';
import { View, Platform, StyleProp, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import {
  LiquidGlassView,
  isLiquidGlassSupported,
} from '@callstack/liquid-glass';
import { Colors, DarkColors } from '../../lib/constants';
import { useIsDarkMode } from '../../hooks/useThemeColors';
import { GlassProvider } from './GlassContext';

interface GlassSheetProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  blurIntensity?: number;
}

/**
 * Glass surface for bottom sheets and floating panels.
 * Sets GlassContext=true so children (cards, action pills, review blocks)
 * automatically render solid instead of glass.
 *
 * - iOS 26+: native LiquidGlassView (Regular variant)
 * - iOS < 26: BlurView with higher intensity for sheet readability
 * - Android: semi-transparent background
 */
function GlassSheet({ children, style, blurIntensity = 90 }: GlassSheetProps) {
  const isDark = useIsDarkMode();
  const fallback = useMemo(
    () => (isDark ? DarkColors.glass.background : Colors.glass.background),
    [isDark],
  );

  const inner = <GlassProvider value={true}>{children}</GlassProvider>;

  if (Platform.OS !== 'ios') {
    return (
      <View style={[{ backgroundColor: fallback }, style]}>{inner}</View>
    );
  }

  if (isLiquidGlassSupported) {
    return (
      <LiquidGlassView
        style={[{ overflow: 'hidden' as const }, style]}
        effect="regular"
        colorScheme={isDark ? 'dark' : 'light'}
      >
        {inner}
      </LiquidGlassView>
    );
  }

  return (
    <BlurView
      intensity={blurIntensity}
      tint={isDark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
      style={[{ overflow: 'hidden' as const }, style]}
    >
      {inner}
    </BlurView>
  );
}

export default React.memo(GlassSheet);
