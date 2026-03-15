import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Spacing, FontSize, FontFamily } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';
import { GlassBar } from '../glass';
import GlassView from './GlassView';

const ACTION_HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

interface ActionButton {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  color?: string;
}

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  leftAction?: ActionButton;
  rightAction?: ActionButton;
  /** Compact mode for sub-screens (centered title, smaller font) */
  compact?: boolean;
  /** Use glass background (default true on iOS for compact, false for full) */
  glass?: boolean;
}

/**
 * Action button — uses GlassView for a subtle glass circle on iOS.
 * When inside a GlassBar (compact mode), GlassView auto-renders solid
 * via GlassContext, preventing glass-on-glass.
 */
const ActionButtonView = React.memo(function ActionButtonView({ action, colors }: { action: ActionButton; colors: ReturnType<typeof useThemeColors> }) {
  if (Platform.OS === 'ios') {
    return (
      <TouchableOpacity
        onPress={action.onPress}
        activeOpacity={0.7}
        hitSlop={ACTION_HIT_SLOP}
      >
        <GlassView style={styles.actionButton} interactive>
          <Ionicons name={action.icon} size={20} color={action.color ?? colors.textTertiary} />
        </GlassView>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.actionButton, { backgroundColor: colors.backgroundSecondary }]}
      onPress={action.onPress}
      activeOpacity={0.7}
      hitSlop={ACTION_HIT_SLOP}
    >
      <Ionicons name={action.icon} size={20} color={action.color ?? colors.textTertiary} />
    </TouchableOpacity>
  );
});

export default function ScreenHeader({ title, subtitle, leftAction, rightAction, compact = false, glass }: ScreenHeaderProps) {
  const colors = useThemeColors();

  // Compact mode: glass by default on iOS (it's a navigation bar)
  // Full mode: NO glass — large title is part of the content layer, not navigation chrome
  if (compact) {
    const useGlass = glass ?? Platform.OS === 'ios';

    const content = (
      <>
        <View style={styles.compactSide}>
          {leftAction && <ActionButtonView action={leftAction} colors={colors} />}
        </View>
        <Text style={[styles.compactTitle, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.compactSide}>
          {rightAction && <ActionButtonView action={rightAction} colors={colors} />}
        </View>
      </>
    );

    if (useGlass) {
      return <GlassBar style={styles.compactContainer}>{content}</GlassBar>;
    }

    return (
      <View style={[styles.compactContainer, { backgroundColor: colors.background }]}>
        {content}
      </View>
    );
  }

  // Full/large title mode — transparent background, glass action buttons
  return (
    <Animated.View
      entering={FadeInDown.springify().damping(22).stiffness(340)}
      style={styles.container}
    >
      <View style={styles.titleRow}>
        <View style={styles.titleBlock}>
          <Text style={[styles.largeTitle, { color: colors.text }]}>{title}</Text>
          {subtitle && (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
          )}
        </View>
        <View style={styles.actions}>
          {leftAction && <ActionButtonView action={leftAction} colors={colors} />}
          {rightAction && <ActionButtonView action={rightAction} colors={colors} />}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  titleBlock: {
    flex: 1,
  },
  largeTitle: {
    fontSize: 34,
    fontFamily: FontFamily.headingBold,
    letterSpacing: 0.37,
    lineHeight: 41,
  },
  subtitle: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingTop: 6,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    minHeight: 44,
  },
  compactSide: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: FontSize.lg,
    fontFamily: FontFamily.headingBold,
    letterSpacing: 0.3,
  },
  actionButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
