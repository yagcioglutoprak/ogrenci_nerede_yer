import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';
import type { User } from '../types';

// Track auth listener subscription so we can clean up on re-initialization
let authSubscription: { unsubscribe: () => void } | null = null;

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
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
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
      const errorMessage = error?.message || null;
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
      const { data, error } = await supabase.auth.signUp({ email, password });

      if (error) {
        set({ loading: false, error: error.message });
        return { error: error.message };
      }

      if (data.user) {
        // Kullanıcı profili oluştur
        const { error: profileError } = await supabase.from('users').insert({
          id: data.user.id,
          email,
          username,
          full_name: username,
          xp_points: 0,
        });

        if (profileError) {
          set({ loading: false, error: profileError.message });
          return { error: profileError.message };
        }
      }

      set({ loading: false, error: null });
      return { error: null };
    } catch (err: any) {
      const errorMessage = err?.message || 'Kayıt olurken hata oluştu';
      set({ loading: false, error: errorMessage });
      return { error: errorMessage };
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
