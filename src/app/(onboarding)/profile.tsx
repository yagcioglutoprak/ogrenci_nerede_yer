import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import {
  Spacing,
  BorderRadius,
  FontSize,
  FontFamily,
  Colors,
} from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useAuthStore } from '../../stores/authStore';
import { haptic } from '../../lib/haptics';
import Button from '../../components/ui/Button';

function calculateAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function formatDate(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

export default function ProfileSetupScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const user = useAuthStore((s) => s.user);

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [bio, setBio] = useState('');

  // Default date for picker: 20 years ago
  const defaultPickerDate = new Date();
  defaultPickerDate.setFullYear(defaultPickerDate.getFullYear() - 20);

  const maxDate = new Date(); // Can't be born in the future
  const minDate = new Date();
  minDate.setFullYear(minDate.getFullYear() - 60);

  const handleDateChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setBirthDate(selectedDate);
    }
  };

  const handleContinue = async () => {
    const updates: Record<string, any> = {};
    if (fullName.trim()) updates.full_name = fullName.trim();
    if (birthDate) {
      updates.age = calculateAge(birthDate);
      updates.birth_date = birthDate.toISOString().split('T')[0];
    }
    if (bio.trim()) updates.bio = bio.trim();

    if (Object.keys(updates).length > 0) {
      await useAuthStore.getState().updateProfile(updates);
    }
    haptic.success();
    router.replace('/(onboarding)/school');
  };

  const handleSkip = () => {
    haptic.light();
    router.replace('/(onboarding)/school');
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>
              Seni Tanıyalım
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Profilini oluştur
            </Text>
          </View>

          {/* Full Name */}
          <Animated.View
            entering={FadeInDown.delay(100).springify().damping(22).stiffness(340)}
            style={styles.fieldGroup}
          >
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Ad Soyad
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.backgroundSecondary,
                },
              ]}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Adın Soyadın"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="words"
            />
          </Animated.View>

          {/* Birth Date */}
          <Animated.View
            entering={FadeInDown.delay(200).springify().damping(22).stiffness(340)}
            style={styles.fieldGroup}
          >
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Doğum Tarihi
            </Text>
            <TouchableOpacity
              style={[
                styles.input,
                styles.dateButton,
                {
                  borderColor: showDatePicker ? Colors.primary : colors.border,
                  backgroundColor: colors.backgroundSecondary,
                },
              ]}
              onPress={() => {
                haptic.light();
                setShowDatePicker(!showDatePicker);
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name="calendar-outline"
                size={18}
                color={birthDate ? Colors.primary : colors.textTertiary}
              />
              <Text
                style={[
                  styles.dateText,
                  {
                    color: birthDate ? colors.text : colors.textTertiary,
                  },
                ]}
              >
                {birthDate ? formatDate(birthDate) : 'Gün / Ay / Yıl'}
              </Text>
              {birthDate && (
                <View style={[styles.ageBadge, { backgroundColor: colors.primarySoft }]}>
                  <Text style={styles.ageBadgeText}>
                    {calculateAge(birthDate)} yaş
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            {showDatePicker && (
              <View style={[styles.pickerContainer, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                <DateTimePicker
                  value={birthDate || defaultPickerDate}
                  mode="date"
                  display="spinner"
                  onChange={handleDateChange}
                  maximumDate={maxDate}
                  minimumDate={minDate}
                  locale="tr-TR"
                  themeVariant="dark"
                />
                <TouchableOpacity
                  style={styles.pickerDoneBtn}
                  onPress={() => {
                    if (!birthDate) setBirthDate(defaultPickerDate);
                    setShowDatePicker(false);
                  }}
                >
                  <Text style={styles.pickerDoneText}>Tamam</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>

          {/* Bio */}
          <Animated.View
            entering={FadeInDown.delay(300).springify().damping(22).stiffness(340)}
            style={styles.fieldGroup}
          >
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              Biyografi
            </Text>
            <TextInput
              style={[
                styles.input,
                styles.textArea,
                {
                  color: colors.text,
                  borderColor: colors.border,
                  backgroundColor: colors.backgroundSecondary,
                },
              ]}
              value={bio}
              onChangeText={setBio}
              placeholder="Kendinden biraz bahset..."
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={3}
            />
          </Animated.View>
        </ScrollView>

        {/* Bottom actions */}
        <View style={styles.bottomContainer}>
          <Button
            title="Devam"
            onPress={handleContinue}
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
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.lg,
  },
  header: {
    alignItems: 'center',
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xxxl,
  },
  title: {
    fontFamily: FontFamily.heading,
    fontSize: FontSize.xxl,
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.md,
    marginTop: Spacing.sm,
  },
  fieldGroup: {
    gap: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  label: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodySemiBold,
  },
  input: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dateText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    flex: 1,
  },
  ageBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  ageBadgeText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemiBold,
    color: Colors.primary,
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginTop: Spacing.xs,
  },
  pickerDoneBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  pickerDoneText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
    color: Colors.primary,
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  bottomContainer: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    alignItems: 'center',
  },
  skipButton: {
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  skipText: {
    fontFamily: FontFamily.bodySemiBold,
    fontSize: FontSize.md,
  },
});
