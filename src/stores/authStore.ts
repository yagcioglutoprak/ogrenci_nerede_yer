import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import type { User } from '../types';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { GOOGLE_WEB_CLIENT_ID, GOOGLE_IOS_CLIENT_ID } from '../lib/constants';
import { Platform } from 'react-native';

// Track auth listener subscription so we can clean up on re-initialization
let authSubscription: { unsubscribe: () => void } | null = null;

let pendingAppleName: string | null = null;

GoogleSignin.configure({
  webClientId: GOOGLE_WEB_CLIENT_ID,
  iosClientId: GOOGLE_IOS_CLIENT_ID,
});

function waitForUser(timeoutMs = 5000): Promise<void> {
  return new Promise((resolve) => {
    const unsub = useAuthStore.subscribe((state) => {
      if (state.user) {
        unsub();
        resolve();
      }
    });
    if (useAuthStore.getState().user) {
      unsub();
      resolve();
      return;
    }
    setTimeout(() => { unsub(); resolve(); }, timeoutMs);
  });
}

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
  error: string | null;

  initialize: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string, username: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  signInWithApple: () => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  updateProfile: (updates: Partial<User>) => Promise<{ error: string | null }>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: false,
  initialized: false,
  error: null,

  initialize: async () => {
    // Clean up previous listener on re-initialization (e.g. hot reload)
    if (authSubscription) {
      authSubscription.unsubscribe();
      authSubscription = null;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        set({ session, user: profile, initialized: true, error: null });
      } else {
        set({ session: null, user: null, initialized: true, error: null });
      }

      // Auth state değişikliklerini dinle
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          let { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (!profile) {
            const metadata = session.user.user_metadata || {};
            const email = session.user.email || '';
            const fullName = pendingAppleName || metadata.full_name || metadata.name || email.split('@')[0];
            pendingAppleName = null;

            // Use explicit username from email signup metadata, otherwise derive from name
            const baseUsername = metadata.username
              || (fullName || email.split('@')[0])
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '')
                .substring(0, 20)
              || 'user';

            let username = baseUsername;

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
                break;
              }
              if (error?.code === '23505' && error?.message?.includes('username')) {
                continue;
              }
              break;
            }

            if (!profile) {
              const { data } = await supabase.from('users').select('*').eq('id', session.user.id).single();
              profile = data;
            }
          }

          if (!profile) {
            // Profile creation failed — sign out so user can retry cleanly
            console.error('[auth] Profile creation failed for', session.user.id);
            await supabase.auth.signOut();
            set({ session: null, user: null });
            return;
          }

          set({ session, user: profile });
        } else {
          set({ session: null, user: null });
        }
      });
      authSubscription = subscription;
    } catch (err: any) {
      set({
        initialized: true,
        error: err?.message || 'Oturum baslatilirken hata olustu',
      });
    }
  },

  signInWithEmail: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      let errorMessage = error?.message || null;
      if (errorMessage) {
        if (errorMessage.toLowerCase().includes('invalid login credentials')) {
          errorMessage = 'E-posta veya şifre hatalı.';
        } else if (errorMessage.toLowerCase().includes('email') && errorMessage.toLowerCase().includes('invalid')) {
          errorMessage = 'Geçersiz e-posta adresi.';
        }
      }
      set({ loading: false, error: errorMessage });
      return { error: errorMessage };
    } catch (err: any) {
      const errorMessage = err?.message || 'Giriş yapılırken hata oluştu';
      set({ loading: false, error: errorMessage });
      return { error: errorMessage };
    }
  },

  signUpWithEmail: async (email, password, username) => {
    set({ loading: true, error: null });
    try {
      // Pass username in metadata so onAuthStateChange can create the profile
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username, full_name: username },
        },
      });

      if (error) {
        let message = error.message;
        if (error.message.toLowerCase().includes('email') && error.message.toLowerCase().includes('invalid')) {
          message = 'Geçersiz e-posta adresi. Lütfen geçerli bir e-posta girin.';
        } else if (error.message.toLowerCase().includes('already registered')) {
          message = 'Bu e-posta adresi zaten kayıtlı.';
        } else if (error.message.toLowerCase().includes('password')) {
          message = 'Şifre en az 6 karakter olmalıdır.';
        }
        set({ loading: false, error: message });
        return { error: message };
      }

      // If session is returned (no email confirmation required), wait for
      // onAuthStateChange to create the profile row automatically.
      if (data.session) {
        await waitForUser();
      }

      set({ loading: false, error: null });
      return { error: null };
    } catch (err: any) {
      const errorMessage = err?.message || 'Kayıt olurken hata oluştu';
      set({ loading: false, error: errorMessage });
      return { error: errorMessage };
    }
  },

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

  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore sign-out errors (e.g. network issues)
    }
    set({ user: null, session: null, error: null });
  },

  updateProfile: async (updates) => {
    const user = get().user;
    if (!user) return { error: 'Kullanıcı bulunamadı' };

    try {
      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id);

      if (!error) {
        set({ user: { ...user, ...updates } as User });
      }

      return { error: error?.message || null };
    } catch (err: any) {
      return { error: err?.message || 'Profil guncellenirken hata olustu' };
    }
  },
}));
