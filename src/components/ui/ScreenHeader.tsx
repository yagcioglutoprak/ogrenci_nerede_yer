import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Spacing, FontSize, FontFamily } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';

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
}

export default function ScreenHeader({ title, subtitle, leftAction, rightAction, compact = false }: ScreenHeaderProps) {
  const colors = useThemeColors();

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactSide}>
          {leftAction && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.backgroundSecondary }]}
              onPress={leftAction.onPress}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name={leftAction.icon} size={20} color={leftAction.color ?? colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
        <Text style={[styles.compactTitle, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.compactSide}>
          {rightAction && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.backgroundSecondary }]}
              onPress={rightAction.onPress}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name={rightAction.icon} size={20} color={rightAction.color ?? colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <Animated.View entering={FadeInDown.springify().damping(22).stiffness(340)} style={styles.container}>
      <View style={styles.titleRow}>
        <View style={styles.titleBlock}>
          <Text style={[styles.largeTitle, { color: colors.text }]}>{title}</Text>
          {subtitle && (
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
          )}
        </View>
        <View style={styles.actions}>
          {leftAction && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.backgroundSecondary }]}
              onPress={leftAction.onPress}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name={leftAction.icon} size={20} color={leftAction.color ?? colors.textTertiary} />
            </TouchableOpacity>
          )}
          {rightAction && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.backgroundSecondary }]}
              onPress={rightAction.onPress}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name={rightAction.icon} size={20} color={rightAction.color ?? colors.textTertiary} />
            </TouchableOpacity>
          )}
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
  // Compact mode (sub-screens)
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
