import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import {
  Spacing,
  BorderRadius,
  FontSize,
  FontFamily,
  VENUE_TAGS,
} from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useAuthStore } from '../../stores/authStore';
import { setOnboardingCompleted } from '../../lib/onboarding';
import { haptic } from '../../lib/haptics';
import Button from '../../components/ui/Button';

// Emoji mapping for each venue tag
const TAG_EMOJIS: Record<string, string> = {
  'ev-yemegi': '🏠',
  'fast-food': '🍔',
  'kahvalti': '🍳',
  'cay': '☕',
  'doner': '🔥',
  'tost': '🍕',
  'vejetaryen': '🌿',
  'wifi': '📶',
  'ogrenci-menu': '🎓',
  'tatli': '🍰',
  'kofte': '🍖',
  'pide': '🫓',
};

export default function PreferencesScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const toggleTag = useCallback((key: string) => {
    haptic.light();
    setSelectedTags((prev) =>
      prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]
    );
  }, []);

  const handleContinue = async () => {
    setLoading(true);
    try {
      const { error } = await useAuthStore
        .getState()
        .updateProfile({ food_preferences: selectedTags });
      if (error) {
        Alert.alert('Hata', 'Tercihler kaydedilemedi');
      }
    } catch {
      Alert.alert('Hata', 'Tercihler kaydedilemedi');
    }
    // Continue regardless of error
    await setOnboardingCompleted();
    haptic.success();
    router.replace('/(tabs)/map');
  };

  const handleSkip = async () => {
    haptic.light();
    await setOnboardingCompleted();
    router.replace('/(tabs)/map');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          Ne Yemeyi Seversin?
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          En az 3 seç
        </Text>
      </View>

      {/* Tag Grid */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.tagGrid}>
          {VENUE_TAGS.filter((tag) => tag.key !== 'wifi').map((tag) => {
            const isSelected = selectedTags.includes(tag.key);
            return (
              <TouchableOpacity
                key={tag.key}
                activeOpacity={0.7}
                onPress={() => toggleTag(tag.key)}
                style={[
                  styles.tag,
                  {
                    backgroundColor: isSelected
                      ? colors.primarySoft
                      : colors.backgroundSecondary,
                    borderColor: isSelected ? colors.primary : 'transparent',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tagText,
                    {
                      color: isSelected ? colors.primary : colors.text,
                    },
                  ]}
                >
                  {TAG_EMOJIS[tag.key] || ''} {tag.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Counter */}
        <Animated.Text
          layout={LinearTransition}
          style={[styles.counter, { color: colors.textSecondary }]}
        >
          {selectedTags.length} seçildi
        </Animated.Text>
      </ScrollView>

      {/* Bottom section */}
      <Animated.View entering={FadeIn.delay(200)} style={styles.bottom}>
        <Button
          title="Keşfetmeye Başla"
          onPress={handleContinue}
          loading={loading}
          variant="primary"
        />
        <TouchableOpacity
          onPress={handleSkip}
          style={styles.skipButton}
          activeOpacity={0.7}
        >
          <Text style={[styles.skipText, { color: colors.textSecondary }]}>
            Atla
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: Spacing.xxxl,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  title: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize.xxl,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.md,
    textAlign: 'center',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  tagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  tag: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
  },
  tagText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSize.md,
  },
  counter: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.md,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
  bottom: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  skipText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSize.md,
  },
});
