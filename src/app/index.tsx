import { useState, useEffect } from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { hasCompletedOnboarding, setOnboardingCompleted } from '../lib/onboarding';

export default function Index() {
  const [checking, setChecking] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);

  useEffect(() => {
    if (!initialized) return;

    hasCompletedOnboarding().then((completed) => {
      if (!completed && user?.university) {
        // Re-install case: user has profile data, skip onboarding
        setOnboardingCompleted();
        setNeedsOnboarding(false);
      } else {
        setNeedsOnboarding(!completed);
      }
      setChecking(false);
    });
  }, [initialized]);

  if (checking) return null;

  if (needsOnboarding) return <Redirect href="/(onboarding)/welcome" />;
  return <Redirect href="/(tabs)/map" />;
}
