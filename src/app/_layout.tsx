import React, { useEffect, useState } from 'react';
import { View, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Nunito_400Regular, Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold, Nunito_800ExtraBold } from '@expo-google-fonts/nunito';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { useThemeColors, useIsDarkMode } from '../hooks/useThemeColors';
import { useNotifications } from '../hooks/useNotifications';
import { Colors } from '../lib/constants';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const initialized = useAuthStore((s) => s.initialized);
  const colors = useThemeColors();
  const isDark = useIsDarkMode();
  const [ready, setReady] = useState(false);

  useNotifications();

  const [fontsLoaded] = useFonts({
    Nunito_400Regular,
    Nunito_500Medium,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
  });

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

  if ((!ready && !initialized) || !fontsLoaded) {
    return (
      <View style={[styles.splash, { backgroundColor: colors.background }]}>
        <Image source={require('../../assets/logo.png')} style={styles.splashLogo} resizeMode="contain" />
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
        name="event/[id]"
        options={{ animation: 'slide_from_bottom' }}
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
      <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="profile/edit" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="list/[id]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="list/create" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
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
  splashLogo: {
    width: 120,
    height: 120,
    marginBottom: 24,
  },
});
