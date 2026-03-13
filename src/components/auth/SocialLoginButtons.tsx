import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Spacing, BorderRadius, FontSize, FontFamily } from '../../lib/constants';
import { useThemeColors, useIsDarkMode } from '../../hooks/useThemeColors';
import { haptic } from '../../lib/haptics';

type SocialProvider = 'apple' | 'google' | null;

interface SocialLoginButtonsProps {
  onApplePress: () => void;
  onGooglePress: () => void;
  loadingProvider: SocialProvider;
  disabled?: boolean;
  animationDelay?: number;
}

export default function SocialLoginButtons({
  onApplePress,
  onGooglePress,
  loadingProvider,
  disabled = false,
  animationDelay = 100,
}: SocialLoginButtonsProps) {
  const colors = useThemeColors();
  const isDark = useIsDarkMode();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const isDisabled = disabled || loadingProvider !== null;

  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
    }
  }, []);

  const handleApple = () => {
    haptic.light();
    onApplePress();
  };

  const handleGoogle = () => {
    haptic.light();
    onGooglePress();
  };

  return (
    <View style={styles.container}>
      {/* Apple Sign In — iOS only, when available */}
      {appleAvailable && (
        <Animated.View entering={FadeInDown.delay(animationDelay).springify().damping(22).stiffness(340)}>
          <TouchableOpacity
            style={[
              styles.socialButton,
              isDark ? styles.appleButtonDark : styles.appleButtonLight,
            ]}
            onPress={handleApple}
            disabled={isDisabled}
            activeOpacity={0.8}
          >
            {loadingProvider === 'apple' ? (
              <ActivityIndicator size="small" color={isDark ? '#000' : '#FFF'} />
            ) : (
              <>
                <Ionicons
                  name="logo-apple"
                  size={20}
                  color={isDark ? '#000' : '#FFF'}
                  style={styles.socialIcon}
                />
                <Text style={[styles.socialButtonText, isDark ? styles.appleTextDark : styles.appleTextLight]}>
                  Apple ile Devam Et
                </Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Google Sign In — both platforms */}
      <Animated.View entering={FadeInDown.delay(animationDelay + (appleAvailable ? 80 : 0)).springify().damping(22).stiffness(340)}>
        <TouchableOpacity
          style={[
            styles.socialButton,
            styles.googleButton,
            { borderColor: colors.border },
            isDark && { backgroundColor: colors.surface },
          ]}
          onPress={handleGoogle}
          disabled={isDisabled}
          activeOpacity={0.8}
        >
          {loadingProvider === 'google' ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <>
              <GoogleIcon />
              <Text style={[styles.socialButtonText, { color: colors.text }]}>
                Google ile Devam Et
              </Text>
            </>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

function GoogleIcon() {
  return (
    <View style={styles.googleIconContainer}>
      <Text style={styles.googleG}>G</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },

  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: BorderRadius.input,
    paddingHorizontal: Spacing.xxl,
  },
  socialIcon: {
    marginRight: Spacing.sm,
  },
  socialButtonText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
    letterSpacing: 0.2,
  },

  appleButtonLight: {
    backgroundColor: '#000',
  },
  appleTextLight: {
    color: '#FFF',
  },
  appleButtonDark: {
    backgroundColor: '#FFF',
  },
  appleTextDark: {
    color: '#000',
  },

  googleButton: {
    backgroundColor: '#FFF',
    borderWidth: 1.5,
  },

  googleIconContainer: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  googleG: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4285F4',
  },
});
