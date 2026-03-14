import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontSize,
  FontFamily,
} from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';

const ICON_GRADIENT_COLORS: [string, string] = [Colors.primary, Colors.accent];
const BUTTON_GRADIENT_COLORS: [string, string] = [Colors.primary, Colors.primaryDark];
const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 1 };

interface AuthGateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title?: string;
  subtitle?: string;
  onLogin: () => void;
}

const AuthGate = React.memo(function AuthGate({
  icon = 'lock-closed',
  title = 'Giris Yap',
  subtitle = 'Bu ozelligi kullanmak icin giris yapman gerekiyor',
  onLogin,
}: AuthGateProps) {
  const colors = useThemeColors();

  return (
    <View style={styles.container}>
      {/* Gradient icon circle */}
      <Animated.View entering={FadeInDown.delay(100).springify().damping(20).stiffness(300)}>
        <LinearGradient
          colors={ICON_GRADIENT_COLORS}
          start={GRADIENT_START}
          end={GRADIENT_END}
          style={styles.iconCircle}
        >
          <Ionicons name={icon} size={36} color="#FFFFFF" />
        </LinearGradient>
      </Animated.View>

      {/* Title */}
      <Animated.Text
        entering={FadeInDown.delay(200).springify().damping(20).stiffness(300)}
        style={[styles.title, { color: colors.text }]}
      >
        {title}
      </Animated.Text>

      {/* Subtitle */}
      <Animated.Text
        entering={FadeInDown.delay(300).springify().damping(20).stiffness(300)}
        style={[styles.subtitle, { color: colors.textSecondary }]}
      >
        {subtitle}
      </Animated.Text>

      {/* Login button with gradient */}
      <Animated.View entering={FadeInUp.delay(400).springify().damping(20).stiffness(300)} style={styles.buttonWrapper}>
        <TouchableOpacity
          onPress={onLogin}
          activeOpacity={0.8}
          style={styles.buttonOuter}
        >
          <LinearGradient
            colors={BUTTON_GRADIENT_COLORS}
            start={GRADIENT_START}
            end={GRADIENT_END}
            style={styles.buttonGradient}
          >
            <Ionicons name="log-in-outline" size={20} color="#FFFFFF" />
            <Text style={styles.buttonText}>Giris Yap</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
});

export default AuthGate;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxxl + 8,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xxl,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: FontSize.xxl,
    fontFamily: FontFamily.heading,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xxl,
  },
  buttonWrapper: {
    width: '100%',
  },
  buttonOuter: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    width: '100%',
  },
  buttonText: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.headingBold,
    color: '#FFFFFF',
  },
});
