import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFeedStore } from '../../stores/feedStore';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily, ISTANBUL_SEMTLER } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { User } from '../../types';

const QUESTION_COLOR = '#8B5CF6';

interface QuestionFormProps {
  user: User;
}

export default function QuestionForm({ user }: QuestionFormProps) {
  const router = useRouter();
  const colors = useThemeColors();
  const { createPost } = useFeedStore();

  const [question, setQuestion] = useState('');
  const [selectedSemt, setSelectedSemt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setQuestion('');
    setSelectedSemt(null);
  };

  const handleSubmit = async () => {
    if (!question.trim()) {
      Alert.alert('Hata', 'Bir soru yazmaniz gerekiyor.');
      return;
    }

    const caption = selectedSemt
      ? `${question.trim()} #${selectedSemt}`
      : question.trim();

    setSubmitting(true);
    const { error } = await createPost({
      user_id: user.id,
      caption,
      image_urls: [],
      post_type: 'question',
    });
    setSubmitting(false);

    if (error) {
      Alert.alert('Hata', error);
    } else {
      Alert.alert('Basarili', 'Sorunuz basariyla paylasild!');
      resetForm();
      router.back();
    }
  };

  return (
    <View style={styles.formContainer}>
      {/* Question Text */}
      <View style={[styles.sectionCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Sorunuz</Text>
        <View style={[styles.questionInputWrapper, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
          <TextInput
            style={[styles.questionInput, { color: colors.text }]}
            placeholder="Topluluga bir soru sor..."
            placeholderTextColor={colors.textTertiary}
            value={question}
            onChangeText={setQuestion}
            multiline
            textAlignVertical="top"
            selectionColor={QUESTION_COLOR}
          />
        </View>
      </View>

      {/* Semt Selector */}
      <View style={[styles.sectionCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Semt</Text>
        <Text style={[styles.sectionHint, { color: colors.textTertiary }]}>Opsiyonel - sorunuzu bir semtle iliskilendirin</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.semtChipContainer}
        >
          {ISTANBUL_SEMTLER.map((semt) => {
            const isSelected = selectedSemt === semt;
            return (
              <TouchableOpacity
                key={semt}
                style={[
                  styles.semtChip,
                  { borderColor: isSelected ? QUESTION_COLOR : colors.border },
                  isSelected && { backgroundColor: QUESTION_COLOR + '15' },
                ]}
                onPress={() => setSelectedSemt(isSelected ? null : semt)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.semtChipText,
                    { color: isSelected ? QUESTION_COLOR : colors.textSecondary },
                  ]}
                >
                  {semt}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
        onPress={handleSubmit}
        disabled={submitting}
        activeOpacity={0.8}
      >
        {submitting ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="help-circle" size={18} color="#FFFFFF" />
            <Text style={styles.submitBtnText}>Soru Sor</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  formContainer: {
    gap: Spacing.lg,
  },
  sectionCard: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  sectionHint: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.md,
  },
  questionInputWrapper: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    minHeight: 120,
  },
  questionInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
    minHeight: 96,
    paddingTop: 2,
    textAlignVertical: 'top',
  },
  semtChipContainer: {
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  semtChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  semtChipText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: QUESTION_COLOR,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    shadowColor: QUESTION_COLOR,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.headingBold,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
