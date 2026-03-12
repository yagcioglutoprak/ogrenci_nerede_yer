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
  Alert,
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
import { supabase } from '../../lib/supabase';
import { haptic } from '../../lib/haptics';

export default function LoginScreen() {
  const router = useRouter();
  const { signInWithEmail, loading } = useAuthStore();
  const colors = useThemeColors();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');

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

    const result = await signInWithEmail(email.trim(), password);
    if (result.error) {
      setError(result.error);
      haptic.error();
    } else {
      haptic.success();
      router.replace('/(tabs)/map');
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
            {/* Red circle with restaurant icon */}
            <View style={styles.logoCircle}>
              <Image source={require('../../../assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
            </View>

            <Text style={styles.brandName}>Öğrenci Nerede Yer?</Text>
            <Text style={[styles.brandSubtitle, { color: colors.textSecondary }]}>Lezzetli keşiflere başla!</Text>
          </Animated.View>

          {/* Form Section */}
          <View style={styles.formSection}>
            <Animated.View entering={FadeInDown.delay(100).springify().damping(22).stiffness(340)}>
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

            <Animated.View entering={FadeInDown.delay(200).springify().damping(22).stiffness(340)}>
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
                autoComplete="password"
              />
            </Animated.View>

            {/* Forgot Password Link */}
            <Animated.View entering={FadeInDown.delay(200).springify().damping(22).stiffness(340)}>
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

            {/* Login Button */}
            <Animated.View entering={FadeInUp.delay(300).springify().damping(22).stiffness(340)}>
              <Button
                title="Giriş Yap"
                onPress={handleLogin}
                loading={loading}
                disabled={loading}
                style={styles.loginButton}
              />
            </Animated.View>
          </View>

          {/* Divider */}
          <Animated.View entering={FadeInUp.delay(300).springify().damping(22).stiffness(340)} style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textTertiary }]}>veya</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </Animated.View>

          {/* Register Link */}
          <Animated.View entering={FadeInUp.delay(300).springify().damping(22).stiffness(340)} style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>Hesabın yok mu? </Text>
            <TouchableOpacity onPress={() => router.replace('/auth/register')}>
              <Text style={styles.footerLink}>Kayıt Ol</Text>
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
    marginTop: Spacing.xxl,
    marginBottom: 44,
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
  forgotPassword: {
    alignSelf: 'flex-end',
    paddingVertical: Spacing.xs,
  },
  forgotPasswordText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodySemiBold,
    color: Colors.primary,
  },
  loginButton: {
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
    marginTop: Spacing.xxxl,
    marginBottom: Spacing.xxl,
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
