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

interface GlassBarProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  blurIntensity?: number;
}

/**
 * Glass surface for navigation bars and toolbars.
 * Sets GlassContext=true so children (action buttons, search fields)
 * automatically render solid instead of glass.
 *
 * - iOS 26+: native LiquidGlassView (Regular variant)
 * - iOS < 26: BlurView with systemChromeMaterial
 * - Android: semi-transparent background
 */
function GlassBar({ children, style, blurIntensity = 80 }: GlassBarProps) {
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

export default React.memo(GlassBar);
