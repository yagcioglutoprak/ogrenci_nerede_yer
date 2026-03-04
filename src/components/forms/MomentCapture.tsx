import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFeedStore } from '../../stores/feedStore';
import { useImagePicker } from '../../hooks/useImagePicker';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { User } from '../../types';

const MOMENT_COLOR = '#F97316';
const MAX_CAPTION_LENGTH = 100;

interface MomentCaptureProps {
  user: User;
}

export default function MomentCapture({ user }: MomentCaptureProps) {
  const router = useRouter();
  const colors = useThemeColors();
  const { createPost } = useFeedStore();
  const { images, pickFromGallery, takePhoto, clearImages } = useImagePicker({ maxImages: 1 });

  const [caption, setCaption] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedImage = images.length > 0 ? images[0] : null;

  const resetForm = () => {
    setCaption('');
    clearImages();
  };

  const handleCaptionChange = (text: string) => {
    if (text.length <= MAX_CAPTION_LENGTH) {
      setCaption(text);
    }
  };

  const handleSubmit = async () => {
    if (!selectedImage) {
      Alert.alert('Hata', 'Bir fotograf secmeniz gerekiyor.');
      return;
    }

    setSubmitting(true);
    const { error } = await createPost({
      user_id: user.id,
      caption: caption.trim(),
      image_urls: [selectedImage],
      post_type: 'moment',
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    setSubmitting(false);

    if (error) {
      Alert.alert('Hata', error);
    } else {
      Alert.alert('Basarili', 'Anlik gonderi paylasild! 24 saat sonra kaybolacak.');
      resetForm();
      router.back();
    }
  };

  return (
    <View style={styles.formContainer}>
      {/* Image Picker */}
      <View style={[styles.sectionCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Fotograf</Text>

        {selectedImage ? (
          <View style={styles.imagePreviewContainer}>
            <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
            <TouchableOpacity
              style={styles.imageRemoveBtn}
              onPress={clearImages}
              activeOpacity={0.8}
            >
              <Ionicons name="close-circle" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.imagePickerRow}>
            <TouchableOpacity
              style={[styles.imageCaptureArea, { backgroundColor: colors.backgroundSecondary, borderColor: MOMENT_COLOR + '40' }]}
              onPress={takePhoto}
              activeOpacity={0.7}
            >
              <View style={[styles.cameraIconCircle, { backgroundColor: MOMENT_COLOR + '15' }]}>
                <Ionicons name="camera" size={32} color={MOMENT_COLOR} />
              </View>
              <Text style={[styles.imageCaptureText, { color: colors.textSecondary }]}>Fotograf Cek</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.imageCaptureArea, { backgroundColor: colors.backgroundSecondary, borderColor: MOMENT_COLOR + '40' }]}
              onPress={pickFromGallery}
              activeOpacity={0.7}
            >
              <View style={[styles.cameraIconCircle, { backgroundColor: MOMENT_COLOR + '15' }]}>
                <Ionicons name="images" size={32} color={MOMENT_COLOR} />
              </View>
              <Text style={[styles.imageCaptureText, { color: colors.textSecondary }]}>Galeriden Sec</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Caption */}
      <View style={[styles.sectionCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <View style={styles.captionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>Aciklama</Text>
          <Text style={[styles.charCounter, { color: caption.length >= MAX_CAPTION_LENGTH ? Colors.error : colors.textTertiary }]}>
            {caption.length}/{MAX_CAPTION_LENGTH}
          </Text>
        </View>
        <View style={[styles.inputWrapper, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
          <TextInput
            style={[styles.textInput, { color: colors.text }]}
            placeholder="Su an ne yapiyorsun?"
            placeholderTextColor={colors.textTertiary}
            value={caption}
            onChangeText={handleCaptionChange}
            maxLength={MAX_CAPTION_LENGTH}
            selectionColor={MOMENT_COLOR}
          />
        </View>
        <View style={styles.expiryNote}>
          <Ionicons name="time-outline" size={14} color={MOMENT_COLOR} />
          <Text style={[styles.expiryNoteText, { color: colors.textTertiary }]}>
            Bu gonderi 24 saat sonra kaybolacak
          </Text>
        </View>
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
            <Ionicons name="flash" size={18} color="#FFFFFF" />
            <Text style={styles.submitBtnText}>Anlik Paylas</Text>
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
  imagePickerRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  imageCaptureArea: {
    flex: 1,
    height: 200,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  cameraIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageCaptureText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  imagePreviewContainer: {
    position: 'relative',
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.md,
  },
  imageRemoveBtn: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: BorderRadius.full,
  },
  captionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  charCounter: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    minHeight: 48,
  },
  textInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
    paddingVertical: 0,
  },
  expiryNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    marginTop: Spacing.md,
  },
  expiryNoteText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: MOMENT_COLOR,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    shadowColor: MOMENT_COLOR,
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
