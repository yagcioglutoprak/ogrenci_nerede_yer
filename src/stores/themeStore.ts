import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'auto' | 'light' | 'dark';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  initialize: () => Promise<void>;
}

const THEME_STORAGE_KEY = '@ony_theme_mode';

export const useThemeStore = create<ThemeState>((set) => ({
  mode: 'auto',

  setMode: async (mode: ThemeMode) => {
    set({ mode });
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Storage write failed silently
    }
  },

  initialize: async () => {
    try {
      const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'auto' || stored === 'light' || stored === 'dark') {
        set({ mode: stored });
      }
    } catch {
      // Storage read failed silently
    }
  },
}));
