import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';

interface ActionButton {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  color?: string;
}

interface ScreenHeaderProps {
  title: string;
  leftAction?: ActionButton;
  rightAction?: ActionButton;
}

export default function ScreenHeader({ title, leftAction, rightAction }: ScreenHeaderProps) {
  const colors = useThemeColors();

  return (
    <Animated.View entering={FadeInDown.duration(400).springify().damping(18)} style={styles.container}>
      {/* Left action — positioned absolutely so it doesn't shift the center */}
      <View style={styles.sideSlot}>
        {leftAction && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.backgroundSecondary }]}
            onPress={leftAction.onPress}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={leftAction.icon}
              size={20}
              color={leftAction.color ?? colors.textTertiary}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Center — logo + title stacked */}
      <View style={styles.center}>
        <Animated.View entering={FadeIn.delay(120).duration(500)}>
          <Image
            source={require('../../../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </Animated.View>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      </View>

      {/* Right action */}
      <View style={styles.sideSlot}>
        {rightAction && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.backgroundSecondary }]}
            onPress={rightAction.onPress}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={rightAction.icon}
              size={20}
              color={rightAction.color ?? colors.textTertiary}
            />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  sideSlot: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 72,
    height: 72,
    marginBottom: 2,
  },
  title: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.headingBold,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  actionButton: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
