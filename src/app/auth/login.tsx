import React, { useState } from 'react';
import {
  View,
  Text,
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
import { Colors, Spacing, BorderRadius, FontSize } from '../../lib/constants';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export default function LoginScreen() {
  const router = useRouter();
  const { signInWithEmail, loading } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');

    if (!email.trim()) {
      setError('E-posta adresi gereklidir.');
      return;
    }
    if (!password) {
      setError('Sifre gereklidir.');
      return;
    }

    const result = await signInWithEmail(email.trim(), password);
    if (result.error) {
      setError(result.error);
    } else {
      router.replace('/(tabs)/map');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
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
            <Ionicons name="close" size={28} color={Colors.text} />
          </TouchableOpacity>

          {/* Brand Section */}
          <View style={styles.brandSection}>
            {/* Red circle with restaurant icon */}
            <View style={styles.logoCircle}>
              <Ionicons name="restaurant" size={48} color={Colors.textOnPrimary} />
            </View>

            <Text style={styles.brandName}>Ogrenci Nerede Yer?</Text>
            <Text style={styles.brandSubtitle}>Lezzetli kesiflere basla!</Text>
          </View>

          {/* Form Section */}
          <View style={styles.formSection}>
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

            <Input
              label="Sifre"
              placeholder="Sifrenizi girin"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (error) setError('');
              }}
              icon="lock-closed-outline"
              secureTextEntry
              autoComplete="password"
            />

            {/* Error Message */}
            {error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={18} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Login Button */}
            <Button
              title="Giris Yap"
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
              style={styles.loginButton}
            />
          </View>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>veya</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Register Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Hesabin yok mu? </Text>
            <TouchableOpacity onPress={() => router.replace('/auth/register')}>
              <Text style={styles.footerLink}>Kayit Ol</Text>
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
  },
  brandName: {
    fontSize: 28,
    fontWeight: '800',
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
    fontWeight: '700',
    color: Colors.primary,
  },
});
