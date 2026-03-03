import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { useThemeColors, useIsDarkMode } from '../hooks/useThemeColors';
import { Colors } from '../lib/constants';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const initialized = useAuthStore((s) => s.initialized);
  const colors = useThemeColors();
  const isDark = useIsDarkMode();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        useThemeStore.getState().initialize();
        await initialize();
      } catch {
        // Auth başarısız olsa bile uygulamayı aç
      } finally {
        setReady(true);
        await SplashScreen.hideAsync();
      }
    };

    const timeout = setTimeout(() => {
      setReady(true);
      SplashScreen.hideAsync();
    }, 5000);

    init().then(() => clearTimeout(timeout));
  }, []);

  if (!ready && !initialized) {
    return (
      <View style={[styles.splash, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="venue/[id]"
        options={{ animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="post/[id]"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="user/[id]"
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="auth/login"
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="auth/register"
        options={{ presentation: 'modal' }}
      />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
});
