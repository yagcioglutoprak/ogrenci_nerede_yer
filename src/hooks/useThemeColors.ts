import { useColorScheme } from 'react-native';
import { useThemeStore } from '../stores/themeStore';
import { Colors, DarkColors } from '../lib/constants';
import type { ThemeColors } from '../lib/constants';

export function useThemeColors(): ThemeColors {
  const mode = useThemeStore((s) => s.mode);
  const systemScheme = useColorScheme();

  if (mode === 'dark') return DarkColors;
  if (mode === 'light') return Colors;
  // auto
  return systemScheme === 'dark' ? DarkColors : Colors;
}

export function useIsDarkMode(): boolean {
  const mode = useThemeStore((s) => s.mode);
  const systemScheme = useColorScheme();

  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  return systemScheme === 'dark';
}
