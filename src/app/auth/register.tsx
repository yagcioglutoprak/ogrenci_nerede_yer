import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useAuthStore } from '../../stores/authStore';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../../lib/constants';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { useThemeColors } from '../../hooks/useThemeColors';
import { haptic } from '../../lib/haptics';
import SocialLoginButtons from '../../components/auth/SocialLoginButtons';

export default function RegisterScreen() {
  const router = useRouter();
  const { signUpWithEmail, signInWithApple, signInWithGoogle, loading } = useAuthStore();
  const colors = useThemeColors();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [loadingProvider, setLoadingProvider] = useState<'apple' | 'google' | null>(null);

  const clearError = () => {
    if (error) setError('');
  };

  const handleRegister = async () => {
    setError('');

    if (!username.trim()) {
      setError('Kullanıcı adı gereklidir.');
      haptic.error();
      return;
    }
    if (username.trim().length < 3) {
      setError('Kullanıcı adı en az 3 karakter olmalıdır.');
      haptic.error();
      return;
    }
    if (!email.trim()) {
      setError('E-posta adresi gereklidir.');
      haptic.error();
      return;
    }
    if (!password) {
      setError('Şifre gereklidir.');
      haptic.error();
      return;
    }
    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır.');
      haptic.error();
      return;
    }
    if (password !== passwordConfirm) {
      setError('Şifreler eşleşmiyor.');
      haptic.error();
      return;
    }

    const result = await signUpWithEmail(email.trim(), password, username.trim());
    if (result.error) {
      setError(result.error);
      haptic.error();
    } else {
      haptic.success();
      // New signup always goes through onboarding
      router.replace('/(onboarding)/profile');
    }
  };

  const handleSocialSuccess = async () => {
    haptic.success();
    // New signup via social always goes through onboarding
    router.replace('/(onboarding)/profile');
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
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

          {/* Error Message */}
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
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xxl,
    paddingBottom: 40,
  },

  // Close
  closeButton: {
    alignSelf: 'flex-end',
    padding: Spacing.sm,
    marginTop: Spacing.sm,
  },

  // Brand
  brandSection: {
    alignItems: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.xxxl,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  logoImage: {
    width: 70,
    height: 70,
  },
  brandName: {
    fontSize: 28,
    fontFamily: FontFamily.heading,
    color: Colors.primary,
    letterSpacing: -0.5,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  brandSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    fontWeight: '400',
    textAlign: 'center',
  },

  // Form
  formSection: {
    gap: Spacing.xs,
  },
  registerButton: {
    marginTop: Spacing.md,
  },

  // Error
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primarySoft,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  errorText: {
    fontSize: 14,
    color: Colors.error,
    flex: 1,
    fontWeight: '500',
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xxl,
    marginBottom: Spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    marginHorizontal: Spacing.lg,
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    fontWeight: '500',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl,
  },
  footerText: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  footerLink: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
    color: Colors.primary,
  },
});
