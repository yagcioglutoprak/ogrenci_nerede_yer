import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  session: any | null;
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
      supabase.auth.onAuthStateChange(async (_event, session) => {
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
    } catch (err: any) {
      set({
        initialized: true,
        error: err?.message || 'Oturum baslatilirken hata olustu',
      });
    }
  },

  signInWithEmail: async (email, password) => {
    set({ loading: true, error: null });
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    const errorMessage = error?.message || null;
    set({ loading: false, error: errorMessage });
    return { error: errorMessage };
  },

  signUpWithEmail: async (email, password, username) => {
    set({ loading: true, error: null });
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
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null, error: null });
  },

  updateProfile: async (updates) => {
    const user = get().user;
    if (!user) return { error: 'Kullanıcı bulunamadı' };

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id);

    if (!error) {
      set({ user: { ...user, ...updates } as User });
    }

    return { error: error?.message || null };
  },
}));
