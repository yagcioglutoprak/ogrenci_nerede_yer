import React from 'react';
import { View, Platform, StyleProp, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors, DarkColors } from '../../lib/constants';
import { useIsDarkMode } from '../../hooks/useThemeColors';

interface GlassViewProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  fallbackColor?: string;
  blurIntensity?: number;
}

/**
 * Platform-aware glass wrapper:
 * - iOS: renders BlurView from expo-blur
 * - Android: renders a plain View with fallbackColor background
 */
export default function GlassView({
  children,
  style,
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

  // iOS — BlurView
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
