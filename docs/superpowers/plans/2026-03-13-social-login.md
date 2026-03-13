# Social Login (Apple + Google) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add native Apple and Google social login as the primary auth method, with email/password demoted to secondary.

**Architecture:** Native SDKs (`expo-apple-authentication`, `@react-native-google-signin/google-signin`) collect ID tokens and pass them to Supabase `signInWithIdToken`. A shared `SocialLoginButtons` component handles platform-conditional rendering. The auth store gains two new methods + auto-profile creation for first-time social users in `onAuthStateChange`.

**Tech Stack:** React Native 0.83.2, Expo SDK 55, Supabase Auth, expo-apple-authentication, @react-native-google-signin/google-signin, expo-crypto

---

## Chunk 1: Dependencies, Config, Auth Store

### Task 1: Install packages and configure app.json

**Files:**
- Modify: `package.json`
- Modify: `app.json`
- Modify: `.env`

- [ ] **Step 1: Install packages**

```bash
cd /Users/toprakyagcioglu/Documents/Projects/Memet-Kebab/ogrenci_nerede_yer
npx expo install expo-apple-authentication expo-crypto @react-native-google-signin/google-signin
```

- [ ] **Step 2: Add Google Web Client ID to .env**

Add these lines to `.env`:

```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your-google-web-client-id-here
EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME=com.googleusercontent.apps.your-ios-client-id
```

The user will replace these with real values from Google Cloud Console.

- [ ] **Step 3: Update app.json — add plugins and Apple Sign In**

In `app.json`, add to `ios` section:

```json
"usesAppleSignIn": true
```

Add to `plugins` array:

```json
"expo-apple-authentication",
[
  "@react-native-google-signin/google-signin",
  {
    "iosUrlScheme": "com.googleusercontent.apps.your-ios-client-id"
  }
]
```

- [ ] **Step 4: Add GOOGLE_WEB_CLIENT_ID constant to constants.ts**

In `src/lib/constants.ts`, add after the Supabase config lines (after line 315):

```typescript
// Google Sign In
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';
```

- [ ] **Step 5: Commit**

```bash
git add package.json app.json .env src/lib/constants.ts
git commit -m "chore: add social login dependencies and config"
```

---

### Task 2: Add social auth methods to authStore

**Files:**
- Modify: `src/stores/authStore.ts`

- [ ] **Step 1: Add imports and module-level state**

At the top of `src/stores/authStore.ts`, add these imports:

```typescript
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { GOOGLE_WEB_CLIENT_ID } from '../lib/constants';
import { Platform } from 'react-native';
```

After the `let authSubscription` line (line 7), add:

```typescript
// Stores the Apple full name from first sign-in (Apple only sends it once)
let pendingAppleName: string | null = null;

// Configure Google Sign In
GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });

// Wait for onAuthStateChange to populate user profile before navigating
function waitForUser(timeoutMs = 5000): Promise<void> {
  return new Promise((resolve) => {
    const unsub = useAuthStore.subscribe((state) => {
      if (state.user) {
        unsub();
        resolve();
      }
    });
    // Already has user
    if (useAuthStore.getState().user) {
      unsub();
      resolve();
      return;
    }
    // Timeout fallback
    setTimeout(() => { unsub(); resolve(); }, timeoutMs);
  });
}
```

- [ ] **Step 2: Update the AuthState interface**

Add to the `AuthState` interface (after the `signOut` line):

```typescript
signInWithApple: () => Promise<{ error: string | null }>;
signInWithGoogle: () => Promise<{ error: string | null }>;
```

- [ ] **Step 3: Implement signInWithApple**

Add after the `signUpWithEmail` method (after line 121):

```typescript
signInWithApple: async () => {
  set({ loading: true, error: null });
  try {
    const rawNonce = Array.from(
      await Crypto.getRandomBytesAsync(16),
    ).map(b => b.toString(16).padStart(2, '0')).join('');
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce,
    );

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    // Capture name (Apple only sends it on first auth)
    if (credential.fullName) {
      const parts = [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean);
      if (parts.length > 0) {
        pendingAppleName = parts.join(' ');
      }
    }

    if (!credential.identityToken) {
      return { error: 'Apple kimlik doğrulama başarısız oldu' };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });

    if (error) {
      set({ error: error.message });
      return { error: error.message };
    }

    // Wait for onAuthStateChange to populate the user profile
    await waitForUser();
    return { error: null };
  } catch (err: any) {
    if (err?.code === 'ERR_REQUEST_CANCELED') {
      return { error: null };
    }
    const errorMessage = err?.message || 'Apple ile giriş yapılırken hata oluştu';
    set({ error: errorMessage });
    return { error: errorMessage };
  } finally {
    set({ loading: false });
  }
},
```

- [ ] **Step 4: Implement signInWithGoogle**

Add after `signInWithApple`:

```typescript
signInWithGoogle: async () => {
  set({ loading: true, error: null });
  try {
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices();
    }

    const response = await GoogleSignin.signIn();
    const idToken = response.data?.idToken;

    if (!idToken) {
      return { error: 'Google kimlik doğrulama başarısız oldu' };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) {
      set({ error: error.message });
      return { error: error.message };
    }

    // Wait for onAuthStateChange to populate the user profile
    await waitForUser();
    return { error: null };
  } catch (err: any) {
    if (err?.code === 'SIGN_IN_CANCELLED' || err?.code === 'ERR_REQUEST_CANCELED') {
      return { error: null };
    }
    const errorMessage = err?.message || 'Google ile giriş yapılırken hata oluştu';
    set({ error: errorMessage });
    return { error: errorMessage };
  } finally {
    set({ loading: false });
  }
},
```

- [ ] **Step 5: Update onAuthStateChange for auto-profile creation**

Replace the `onAuthStateChange` callback in the `initialize` method (lines 53-64) with:

```typescript
const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
  if (session?.user) {
    let { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single();

    // Auto-create profile for social login users
    if (!profile) {
      const metadata = session.user.user_metadata || {};
      const email = session.user.email || '';
      const fullName = pendingAppleName || metadata.full_name || metadata.name || email.split('@')[0];
      pendingAppleName = null; // Clear after use

      const baseUsername = (fullName || email.split('@')[0])
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 20) || 'user';

      let username = baseUsername;
      let created = false;

      for (let attempt = 0; attempt < 4; attempt++) {
        if (attempt > 0) {
          username = `${baseUsername}${Math.floor(1000 + Math.random() * 9000)}`;
        }
        const { data, error } = await supabase.from('users').upsert(
          {
            id: session.user.id,
            email,
            username,
            full_name: fullName,
            avatar_url: metadata.avatar_url || null,
            xp_points: 0,
          },
          { onConflict: 'id', ignoreDuplicates: true },
        ).select('*').single();

        if (!error && data) {
          profile = data;
          created = true;
          break;
        }
        // If error is username collision, retry
        if (error?.code === '23505' && error?.message?.includes('username')) {
          continue;
        }
        // Other error — use what we have
        break;
      }

      // If upsert didn't return profile, try fetching
      if (!profile) {
        const { data } = await supabase.from('users').select('*').eq('id', session.user.id).single();
        profile = data;
      }
    }

    set({ session, user: profile });
  } else {
    set({ session: null, user: null });
  }
});
```

- [ ] **Step 6: Commit**

```bash
git add src/stores/authStore.ts
git commit -m "feat(auth): add Apple and Google sign-in methods with auto-profile creation"
```

---

## Chunk 2: SocialLoginButtons Component

### Task 3: Create SocialLoginButtons component

**Files:**
- Create: `src/components/auth/SocialLoginButtons.tsx`

- [ ] **Step 1: Create the component directory**

```bash
mkdir -p /Users/toprakyagcioglu/Documents/Projects/Memet-Kebab/ogrenci_nerede_yer/src/components/auth
```

- [ ] **Step 2: Write SocialLoginButtons.tsx**

Create `src/components/auth/SocialLoginButtons.tsx`:

```typescript
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
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../../lib/constants';
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

/** Google "G" icon — inline SVG-like rendering with Text for simplicity */
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

  // Apple — light mode: black bg, white text
  appleButtonLight: {
    backgroundColor: '#000',
  },
  appleTextLight: {
    color: '#FFF',
  },
  // Apple — dark mode: white bg, black text
  appleButtonDark: {
    backgroundColor: '#FFF',
  },
  appleTextDark: {
    color: '#000',
  },

  // Google — white bg with border
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
```

- [ ] **Step 3: Commit**

```bash
git add src/components/auth/SocialLoginButtons.tsx
git commit -m "feat(auth): add SocialLoginButtons component with Apple/Google support"
```

---

## Chunk 3: Restructure Login and Register Screens

### Task 4: Restructure login.tsx — social buttons primary, email secondary

**Files:**
- Modify: `src/app/auth/login.tsx`

- [ ] **Step 1: Add imports**

Add to imports in `login.tsx`:

```typescript
import SocialLoginButtons from '../../components/auth/SocialLoginButtons';
```

And add `useAuthStore` destructuring for the new methods — update line 28:

```typescript
const { signInWithEmail, signInWithApple, signInWithGoogle, loading } = useAuthStore();
```

Add local state for tracking which social provider is loading (after the `error` state):

```typescript
const [loadingProvider, setLoadingProvider] = useState<'apple' | 'google' | null>(null);
```

- [ ] **Step 2: Add social login handlers**

After the `handleLogin` function (after line 58), add:

```typescript
const handleSocialSuccess = async () => {
  haptic.success();
  const onboardingDone = await hasCompletedOnboarding();
  router.replace(onboardingDone ? '/(tabs)/map' : '/(onboarding)/school');
};

const handleAppleLogin = async () => {
  setError('');
  setLoadingProvider('apple');
  const result = await signInWithApple();
  setLoadingProvider(null);
  if (result.error) {
    setError(result.error);
    haptic.error();
  } else {
    await handleSocialSuccess();
  }
};

const handleGoogleLogin = async () => {
  setError('');
  setLoadingProvider('google');
  const result = await signInWithGoogle();
  setLoadingProvider(null);
  if (result.error) {
    setError(result.error);
    haptic.error();
  } else {
    await handleSocialSuccess();
  }
};
```

- [ ] **Step 3: Restructure the JSX — social on top, email below divider**

Replace the JSX content inside `<ScrollView>` (from the close button through the footer) with:

```tsx
{/* Close button */}
<TouchableOpacity
  style={styles.closeButton}
  onPress={() => router.back()}
  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
>
  <Ionicons name="close" size={28} color={colors.text} />
</TouchableOpacity>

{/* Brand Section */}
<Animated.View
  entering={FadeInDown.delay(0).springify().damping(22).stiffness(340)}
  style={styles.brandSection}
>
  <View style={styles.logoCircle}>
    <Image source={require('../../../assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
  </View>

  <Text style={styles.brandName}>Öğrenci Nerede Yer?</Text>
  <Text style={[styles.brandSubtitle, { color: colors.textSecondary }]}>Lezzetli keşiflere başla!</Text>
</Animated.View>

{/* Social Login Buttons — PRIMARY */}
<SocialLoginButtons
  onApplePress={handleAppleLogin}
  onGooglePress={handleGoogleLogin}
  loadingProvider={loadingProvider}
  disabled={loading}
  animationDelay={100}
/>

{/* Error Message (for social login errors) */}
{error ? (
  <Animated.View
    entering={FadeInDown.springify().damping(20).stiffness(300)}
    style={[styles.errorContainer, { backgroundColor: colors.primarySoft }]}
  >
    <Ionicons name="alert-circle" size={18} color={Colors.error} />
    <Text style={styles.errorText}>{error}</Text>
  </Animated.View>
) : null}

{/* Divider */}
<Animated.View entering={FadeInUp.delay(200).springify().damping(22).stiffness(340)} style={styles.divider}>
  <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
  <Text style={[styles.dividerText, { color: colors.textTertiary }]}>veya</Text>
  <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
</Animated.View>

{/* Email Form — SECONDARY */}
<View style={styles.formSection}>
  <Animated.View entering={FadeInDown.delay(250).springify().damping(22).stiffness(340)}>
    <Input
      label="E-posta"
      placeholder="ornek@universite.edu.tr"
      value={email}
      onChangeText={(text) => {
        setEmail(text);
        if (error) setError('');
      }}
      icon="mail-outline"
      keyboardType="email-address"
      autoCapitalize="none"
      autoComplete="email"
    />
  </Animated.View>

  <Animated.View entering={FadeInDown.delay(300).springify().damping(22).stiffness(340)}>
    <Input
      label="Şifre"
      placeholder="Şifrenizi girin"
      value={password}
      onChangeText={(text) => {
        setPassword(text);
        if (error) setError('');
      }}
      icon="lock-closed-outline"
      secureTextEntry
      autoComplete="off"
      textContentType="oneTimeCode"
    />
  </Animated.View>

  {/* Forgot Password Link */}
  <Animated.View entering={FadeInDown.delay(300).springify().damping(22).stiffness(340)}>
    <TouchableOpacity
      style={styles.forgotPassword}
      onPress={() => {
        if (!email.trim()) {
          Alert.alert('Uyarı', 'Lütfen e-posta adresini gir');
          return;
        }
        supabase.auth.resetPasswordForEmail(email.trim()).then(() => {
          Alert.alert('Başarılı', 'Şifre sıfırlama bağlantısı e-posta adresine gönderildi');
        }).catch(() => {
          Alert.alert('Hata', 'Şifre sıfırlama bağlantısı gönderilemedi');
        });
      }}
    >
      <Text style={styles.forgotPasswordText}>Şifremi Unuttum?</Text>
    </TouchableOpacity>
  </Animated.View>

  {/* Login Button */}
  <Animated.View entering={FadeInUp.delay(350).springify().damping(22).stiffness(340)}>
    <Button
      title="Giriş Yap"
      onPress={handleLogin}
      loading={loading}
      disabled={loading}
      style={styles.loginButton}
    />
  </Animated.View>
</View>

{/* Register Link */}
<Animated.View entering={FadeInUp.delay(400).springify().damping(22).stiffness(340)} style={styles.footer}>
  <Text style={[styles.footerText, { color: colors.textSecondary }]}>Hesabın yok mu? </Text>
  <TouchableOpacity onPress={() => router.replace('/auth/register')}>
    <Text style={styles.footerLink}>Kayıt Ol</Text>
  </TouchableOpacity>
</Animated.View>
```

- [ ] **Step 4: Update styles**

Update `divider` style to adjust spacing for the new layout:

```typescript
divider: {
  flexDirection: 'row',
  alignItems: 'center',
  marginTop: Spacing.xxl,
  marginBottom: Spacing.xl,
},
```

- [ ] **Step 5: Commit**

```bash
git add src/app/auth/login.tsx
git commit -m "feat(auth): restructure login screen with social buttons as primary"
```

---

### Task 5: Restructure register.tsx — social buttons primary, email secondary

**Files:**
- Modify: `src/app/auth/register.tsx`

- [ ] **Step 1: Add imports**

Add to imports in `register.tsx`:

```typescript
import SocialLoginButtons from '../../components/auth/SocialLoginButtons';
```

Update the auth store destructuring (line 26):

```typescript
const { signUpWithEmail, signInWithApple, signInWithGoogle, loading } = useAuthStore();
```

Add local state for tracking which social provider is loading (after the `error` state):

```typescript
const [loadingProvider, setLoadingProvider] = useState<'apple' | 'google' | null>(null);
```

- [ ] **Step 2: Add social login handlers**

After the `handleRegister` function (after line 82), add:

```typescript
const handleSocialSuccess = async () => {
  haptic.success();
  const onboardingDone = await hasCompletedOnboarding();
  router.replace(onboardingDone ? '/(tabs)/map' : '/(onboarding)/school');
};

const handleAppleLogin = async () => {
  setError('');
  setLoadingProvider('apple');
  const result = await signInWithApple();
  setLoadingProvider(null);
  if (result.error) {
    setError(result.error);
    haptic.error();
  } else {
    await handleSocialSuccess();
  }
};

const handleGoogleLogin = async () => {
  setError('');
  setLoadingProvider('google');
  const result = await signInWithGoogle();
  setLoadingProvider(null);
  if (result.error) {
    setError(result.error);
    haptic.error();
  } else {
    await handleSocialSuccess();
  }
};
```

- [ ] **Step 3: Restructure the JSX**

Replace the JSX content inside `<ScrollView>` with:

```tsx
{/* Close button */}
<TouchableOpacity
  style={styles.closeButton}
  onPress={() => router.back()}
  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
>
  <Ionicons name="close" size={28} color={colors.text} />
</TouchableOpacity>

{/* Brand Section */}
<Animated.View
  entering={FadeInDown.delay(0).springify().damping(22).stiffness(340)}
  style={styles.brandSection}
>
  <View style={styles.logoCircle}>
    <Image source={require('../../../assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
  </View>

  <Text style={styles.brandName}>Öğrenci Nerede Yer?</Text>
  <Text style={[styles.brandSubtitle, { color: colors.textSecondary }]}>Yeni hesap oluştur</Text>
</Animated.View>

{/* Social Login Buttons — PRIMARY */}
<SocialLoginButtons
  onApplePress={handleAppleLogin}
  onGooglePress={handleGoogleLogin}
  loadingProvider={loadingProvider}
  disabled={loading}
  animationDelay={100}
/>

{/* Error Message (for social login errors) */}
{error ? (
  <Animated.View
    entering={FadeInDown.springify().damping(20).stiffness(300)}
    style={[styles.errorContainer, { backgroundColor: colors.primarySoft }]}
  >
    <Ionicons name="alert-circle" size={18} color={Colors.error} />
    <Text style={styles.errorText}>{error}</Text>
  </Animated.View>
) : null}

{/* Divider */}
<Animated.View entering={FadeInUp.delay(200).springify().damping(22).stiffness(340)} style={styles.divider}>
  <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
  <Text style={[styles.dividerText, { color: colors.textTertiary }]}>veya</Text>
  <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
</Animated.View>

{/* Email Form — SECONDARY */}
<View style={styles.formSection}>
  <Animated.View entering={FadeInDown.delay(250).springify().damping(22).stiffness(340)}>
    <Input
      label="Kullanıcı Adı"
      placeholder="ornek: yemeksever42"
      value={username}
      onChangeText={(text) => {
        setUsername(text);
        clearError();
      }}
      icon="person-outline"
      autoCapitalize="none"
      autoComplete="username"
    />
  </Animated.View>

  <Animated.View entering={FadeInDown.delay(300).springify().damping(22).stiffness(340)}>
    <Input
      label="E-posta"
      placeholder="ornek@universite.edu.tr"
      value={email}
      onChangeText={(text) => {
        setEmail(text);
        clearError();
      }}
      icon="mail-outline"
      keyboardType="email-address"
      autoCapitalize="none"
      autoComplete="email"
    />
  </Animated.View>

  <Animated.View entering={FadeInDown.delay(350).springify().damping(22).stiffness(340)}>
    <Input
      label="Şifre"
      placeholder="En az 6 karakter"
      value={password}
      onChangeText={(text) => {
        setPassword(text);
        clearError();
      }}
      icon="lock-closed-outline"
      secureTextEntry
      autoComplete="off"
      textContentType="oneTimeCode"
    />
  </Animated.View>

  <Animated.View entering={FadeInDown.delay(400).springify().damping(22).stiffness(340)}>
    <Input
      label="Şifre Tekrar"
      placeholder="Şifrenizi tekrar girin"
      value={passwordConfirm}
      onChangeText={(text) => {
        setPasswordConfirm(text);
        clearError();
      }}
      icon="lock-closed-outline"
      secureTextEntry
      autoComplete="off"
      textContentType="oneTimeCode"
      error={
        passwordConfirm.length > 0 && password !== passwordConfirm
          ? 'Şifreler eşleşmiyor'
          : undefined
      }
    />
  </Animated.View>

  {/* Register Button */}
  <Animated.View entering={FadeInUp.delay(450).springify().damping(22).stiffness(340)}>
    <Button
      title="Kayıt Ol"
      onPress={handleRegister}
      loading={loading}
      disabled={loading}
      style={styles.registerButton}
    />
  </Animated.View>
</View>

{/* Login Link */}
<Animated.View entering={FadeInUp.delay(500).springify().damping(22).stiffness(340)} style={styles.footer}>
  <Text style={[styles.footerText, { color: colors.textSecondary }]}>Zaten hesabın var mı? </Text>
  <TouchableOpacity onPress={() => router.replace('/auth/login')}>
    <Text style={styles.footerLink}>Giriş Yap</Text>
  </TouchableOpacity>
</Animated.View>
```

- [ ] **Step 4: Update styles**

Update `divider` style:

```typescript
divider: {
  flexDirection: 'row',
  alignItems: 'center',
  marginTop: Spacing.xxl,
  marginBottom: Spacing.xl,
},
```

- [ ] **Step 5: Commit**

```bash
git add src/app/auth/register.tsx
git commit -m "feat(auth): restructure register screen with social buttons as primary"
```

---

## Chunk 4: Rebuild native project and verify

### Task 6: Rebuild and manual verification

- [ ] **Step 1: Rebuild the dev client**

```bash
cd /Users/toprakyagcioglu/Documents/Projects/Memet-Kebab/ogrenci_nerede_yer
npx expo prebuild --clean
npx expo run:ios
```

- [ ] **Step 2: Manual verification checklist**

Verify on iOS:
- [ ] Login screen shows Apple + Google buttons above the "veya" divider
- [ ] Email form appears below the divider
- [ ] Apple button is black in light mode, white in dark mode
- [ ] Google button has white bg with "G" and border
- [ ] Tapping Apple button triggers native Apple Sign In sheet
- [ ] Tapping Google button triggers native Google account picker
- [ ] Cancelling either login returns to the screen with no error
- [ ] Footer "Kayit Ol" link still works

Verify on Android (if available):
- [ ] Login screen shows only Google button (no Apple)
- [ ] Google button triggers native account picker

- [ ] **Step 3: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix(auth): polish social login after manual testing"
```

---

## Supabase Dashboard Setup (Manual — User Action Required)

Before social login will actually work end-to-end, the user must configure these in the Supabase Dashboard:

1. **Google Provider:**
   - Go to Authentication > Providers > Google
   - Enable it
   - Add the Web Client ID and Client Secret from Google Cloud Console
   - The Web Client ID must match `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `.env`

2. **Apple Provider:**
   - Go to Authentication > Providers > Apple
   - Enable it
   - Add Service ID, Team ID, Key ID, and the private key (.p8 file)
   - These come from Apple Developer Console > Certificates, Identifiers & Profiles

3. **Update `.env` with real values:**
   - Replace `your-google-web-client-id-here` with the actual Web Client ID
   - Replace `com.googleusercontent.apps.your-ios-client-id` with the actual reversed client ID
   - Update `app.json` plugin config with the same reversed client ID
