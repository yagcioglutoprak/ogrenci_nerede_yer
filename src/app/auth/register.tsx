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
import { Colors } from '../../lib/constants';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';

export default function RegisterScreen() {
  const router = useRouter();
  const { signUpWithEmail, loading } = useAuthStore();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');

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
          <TouchableOpacity style={styles.closeButton} onPress={() => router.back()}>
            <Ionicons name="close" size={28} color={Colors.text} />
          </TouchableOpacity>

          {/* Logo / Brand */}
          <View style={styles.brandSection}>
            <View style={styles.logoContainer}>
              <Ionicons name="restaurant" size={40} color="#FFFFFF" />
            </View>
            <Text style={styles.brandName}>Ogrenci Nerede Yer?</Text>
            <Text style={styles.brandSubtitle}>Yeni hesap olustur</Text>
          </View>

          {/* Form */}
          <View style={styles.formSection}>
            <Input
              label="Kullanici Adi"
              placeholder="ornek: yemeksever42"
              value={username}
              onChangeText={(text) => {
                setUsername(text);
                setError('');
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
                setError('');
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
                setError('');
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
                setError('');
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
              <View style={styles.errorContainer}>
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
              icon="person-add-outline"
              style={styles.registerButton}
            />
          </View>

          {/* Login Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Zaten hesabin var mi?</Text>
            <TouchableOpacity onPress={() => router.replace('/auth/login')}>
              <Text style={styles.footerLink}> Giris Yap</Text>
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
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  // Close
  closeButton: {
    alignSelf: 'flex-end',
    padding: 8,
    marginTop: 8,
  },
  // Brand
  brandSection: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 32,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  brandName: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  brandSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  // Form
  formSection: {
    gap: 4,
  },
  registerButton: {
    marginTop: 12,
  },
  // Error
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    fontSize: 14,
    color: Colors.error,
    flex: 1,
  },
  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  footerLink: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
  },
});
