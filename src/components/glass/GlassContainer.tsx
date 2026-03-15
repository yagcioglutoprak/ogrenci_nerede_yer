import React from 'react';
import { View, Platform, StyleProp, ViewStyle } from 'react-native';
import {
  LiquidGlassContainerView,
  isLiquidGlassSupported,
} from '@callstack/liquid-glass';

interface GlassContainerProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Distance at which sibling glass children begin merging effects */
  spacing?: number;
}

/**
 * Groups sibling glass surfaces so their effects merge and interact,
 * per Apple's Liquid Glass design language.
 *
 * - iOS 26+: LiquidGlassContainerView (native merging)
 * - Otherwise: plain View (no-op wrapper)
 */
function GlassContainer({ children, style, spacing = 0 }: GlassContainerProps) {
  if (Platform.OS === 'ios' && isLiquidGlassSupported) {
    return (
      <LiquidGlassContainerView style={style} spacing={spacing}>
        {children}
      </LiquidGlassContainerView>
    );
  }

  return <View style={style}>{children}</View>;
}

export default React.memo(GlassContainer);
