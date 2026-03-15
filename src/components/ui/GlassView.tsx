import React, { useMemo } from 'react';
import { View, Platform, StyleProp, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import {
  LiquidGlassView,
  isLiquidGlassSupported,
} from '@callstack/liquid-glass';
import { Colors, DarkColors } from '../../lib/constants';
import { useIsDarkMode } from '../../hooks/useThemeColors';
import { useInsideGlass } from '../glass/GlassContext';

type GlassEffect = 'clear' | 'regular';

interface GlassViewProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  fallbackColor?: string;
  blurIntensity?: number;
  interactive?: boolean;
  effect?: GlassEffect;
  /** Override glass-on-glass prevention (use sparingly) */
  forceGlass?: boolean;
}

/**
 * Platform-aware glass wrapper with three tiers:
 * 1. iOS 26+ with Liquid Glass support → native LiquidGlassView
 * 2. iOS < 26 → BlurView from expo-blur
 * 3. Android → plain View with semi-transparent background
 *
 * Glass-context-aware: if rendered inside a GlassBar/GlassSheet/etc.,
 * automatically renders solid instead of glass (prevents glass-on-glass).
 * Use forceGlass prop to override this behavior.
 */
function GlassView({
  children,
  style,
  fallbackColor,
  blurIntensity = 80,
  interactive = false,
  effect = 'regular',
  forceGlass = false,
}: GlassViewProps) {
  const isDark = useIsDarkMode();
  const insideGlass = useInsideGlass();

  const resolvedFallback = useMemo(
    () => fallbackColor ?? (isDark ? DarkColors.glass.background : Colors.glass.background),
    [fallbackColor, isDark],
  );

  // Glass-on-glass prevention: render solid when inside a glass surface
  if (insideGlass && !forceGlass) {
    return (
      <View style={[{ backgroundColor: resolvedFallback }, style]}>
        {children}
      </View>
    );
  }

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

export default React.memo(GlassView);
