import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import Animated, { Layout } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFeedStore } from '../../stores/feedStore';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily, ISTANBUL_SEMTLER, FeatureColors } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';
import { haptic } from '../../lib/haptics';
import GlassView from '../ui/GlassView';
import Button from '../ui/Button';
import type { User } from '../../types';

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

  const handleSemtSelect = (semt: string) => {
    haptic.light();
    setSelectedSemt(selectedSemt === semt ? null : semt);
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
      haptic.success();
      Alert.alert('Basarili', 'Sorunuz basariyla paylasildi!');
      resetForm();
      router.back();
    }
  };

  const renderSectionCard = (children: React.ReactNode) => {
    if (Platform.OS === 'ios') {
      return (
        <GlassView style={styles.sectionCardGlass}>
          {children}
        </GlassView>
      );
    }
    return (
      <View style={[styles.sectionCard, { backgroundColor: colors.background }]}>
        {children}
      </View>
    );
  };

  return (
    <View style={styles.formContainer}>
      {/* Question Text */}
      {renderSectionCard(
        <>
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
              selectionColor={FeatureColors.question}
            />
          </View>
        </>
      )}

      {/* Semt Selector */}
      {renderSectionCard(
        <>
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
                <Animated.View key={semt} layout={Layout.springify()}>
                  <TouchableOpacity
                    style={[
                      styles.semtChip,
                      { borderColor: isSelected ? FeatureColors.question : colors.border },
                      isSelected && { backgroundColor: FeatureColors.question + '15' },
                    ]}
                    onPress={() => handleSemtSelect(semt)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.semtChipText,
                        { color: isSelected ? FeatureColors.question : colors.textSecondary },
                      ]}
                    >
                      {semt}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </ScrollView>
        </>
      )}

      {/* Submit */}
      <Button
        title="Soru Sor"
        variant="primary"
        onPress={handleSubmit}
        loading={submitting}
        icon="help-circle"
        style={{ backgroundColor: FeatureColors.question }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  formContainer: {
    gap: Spacing.lg,
  },
  sectionCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionCardGlass: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
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
});
