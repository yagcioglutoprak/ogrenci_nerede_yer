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
import { useAuthStore } from '../../stores/authStore';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../../lib/constants';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { useThemeColors } from '../../hooks/useThemeColors';

export default function RegisterScreen() {
  const router = useRouter();
  const { signUpWithEmail, loading } = useAuthStore();
  const colors = useThemeColors();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');

  const clearError = () => {
    if (error) setError('');
  };

  const handleRegister = async () => {
    setError('');

    if (!username.trim()) {
      setError('Kullanici adi gereklidir.');
      return;
    }
    if (username.trim().length < 3) {
      setError('Kullanici adi en az 3 karakter olmalidir.');
      return;
    }
    if (!email.trim()) {
      setError('E-posta adresi gereklidir.');
      return;
    }
    if (!password) {
      setError('Sifre gereklidir.');
      return;
    }
    if (password.length < 6) {
      setError('Sifre en az 6 karakter olmalidir.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('Sifreler eslesmiyor.');
      return;
    }

    const result = await signUpWithEmail(email.trim(), password, username.trim());
    if (result.error) {
      setError(result.error);
    } else {
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
          <View style={styles.brandSection}>
            <View style={styles.logoCircle}>
              <Image source={require('../../../assets/logo.png')} style={styles.logoImage} resizeMode="contain" />
            </View>

            <Text style={styles.brandName}>Ogrenci Nerede Yer?</Text>
            <Text style={[styles.brandSubtitle, { color: colors.textSecondary }]}>Yeni hesap olustur</Text>
          </View>

          {/* Form Section */}
          <View style={styles.formSection}>
            <Input
              label="Kullanici Adi"
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

            <Input
              label="Sifre"
              placeholder="En az 6 karakter"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                clearError();
              }}
              icon="lock-closed-outline"
              secureTextEntry
              autoComplete="new-password"
            />

            <Input
              label="Sifre Tekrar"
              placeholder="Sifrenizi tekrar girin"
              value={passwordConfirm}
              onChangeText={(text) => {
                setPasswordConfirm(text);
                clearError();
              }}
              icon="lock-closed-outline"
              secureTextEntry
              autoComplete="new-password"
              error={
                passwordConfirm.length > 0 && password !== passwordConfirm
                  ? 'Sifreler eslesmiyor'
                  : undefined
              }
            />

            {/* Error */}
            {error ? (
              <View style={[styles.errorContainer, { backgroundColor: colors.primarySoft }]}>
                <Ionicons name="alert-circle" size={18} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Register Button */}
            <Button
              title="Kayit Ol"
              onPress={handleRegister}
              loading={loading}
              disabled={loading}
              style={styles.registerButton}
            />
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textTertiary }]}>veya</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          {/* Login Link */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>Zaten hesabin var mi? </Text>
            <TouchableOpacity onPress={() => router.replace('/auth/login')}>
              <Text style={styles.footerLink}>Giris Yap</Text>
            </TouchableOpacity>
          </View>
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
