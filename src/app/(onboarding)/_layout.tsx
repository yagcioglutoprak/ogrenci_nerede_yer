import { Stack } from 'expo-router';
import { useThemeColors } from '../../hooks/useThemeColors';

export default function OnboardingLayout() {
  const colors = useThemeColors();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    />
  );
}
