import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import Animated, { Layout } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useVenueStore } from '../../stores/venueStore';
import { uploadImages } from '../../lib/imageUpload';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontSize,
  PriceRanges,
  FontFamily,
} from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';
import { haptic } from '../../lib/haptics';
import GlassView from '../ui/GlassView';
import Button from '../ui/Button';
import ImageGrid from './ImageGrid';
import TagSelector from './TagSelector';
import LocationPicker from './LocationPicker';
import type { User } from '../../types';

interface VenueFormProps {
  user: User;
}

export default function VenueForm({ user }: VenueFormProps) {
  const colors = useThemeColors();
  const { addVenue } = useVenueStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [priceRange, setPriceRange] = useState<1 | 2 | 3 | 4>(1);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const resetForm = () => {
    setName('');
    setDescription('');
    setAddress('');
    setPriceRange(1);
    setLocation(null);
    setTags([]);
    setImages([]);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert('Hata', 'Mekan adi gereklidir.');
      return;
    }
    if (!address.trim()) {
      Alert.alert('Hata', 'Adres gereklidir.');
      return;
    }
    if (!location) {
      Alert.alert('Hata', 'Lutfen haritadan konum secin.');
      return;
    }

    setSubmitting(true);

    // Upload images to Supabase Storage before creating venue
    let coverImageUrl: string | null = null;
    if (images.length > 0) {
      setUploading(true);
      try {
        const uploadedUrls = await uploadImages(images, 'venues');
        coverImageUrl = uploadedUrls[0] || null;
      } catch {
        // Fallback to local URI if upload fails entirely
        coverImageUrl = images[0];
      }
      setUploading(false);
    }

    const { error } = await addVenue({
      name: name.trim(),
      description: description.trim() || null,
      address: address.trim(),
      latitude: location.latitude,
      longitude: location.longitude,
      price_range: priceRange,
      tags,
      is_verified: false,
      youtube_video_url: null,
      phone: null,
      cover_image_url: coverImageUrl,
      created_by: user.id,
    });
    setSubmitting(false);

    if (error) {
      Alert.alert('Hata', error);
    } else {
      haptic.success();
      Alert.alert('Basarili', 'Mekan basariyla eklendi!');
      resetForm();
    }
  };

  const handlePriceSelect = (value: 1 | 2 | 3 | 4) => {
    haptic.light();
    setPriceRange(value);
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
      {/* Temel Bilgiler */}
      {renderSectionCard(
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Temel Bilgiler</Text>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Mekan Adi</Text>
            <View style={[styles.inputWrapper, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <Ionicons name="restaurant-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { color: colors.text }]}
                placeholder="Ornek: Ali Usta Doner"
                placeholderTextColor={colors.textTertiary}
                value={name}
                onChangeText={setName}
                selectionColor={colors.primary}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Aciklama</Text>
            <View style={[styles.inputWrapper, styles.inputWrapperMultiline, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <Ionicons name="document-text-outline" size={18} color={Colors.textTertiary} style={[styles.inputIcon, { marginTop: 2 }]} />
              <TextInput
                style={[styles.textInput, styles.textInputMultiline, { color: colors.text }]}
                placeholder="Mekan hakkinda kisa bilgi..."
                placeholderTextColor={colors.textTertiary}
                value={description}
                onChangeText={setDescription}
                multiline
                textAlignVertical="top"
                selectionColor={colors.primary}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Adres</Text>
            <View style={[styles.inputWrapper, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <Ionicons name="location-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
              <TextInput
                style={[styles.textInput, { color: colors.text }]}
                placeholder="Cadde, sokak, numara..."
                placeholderTextColor={colors.textTertiary}
                value={address}
                onChangeText={setAddress}
                selectionColor={colors.primary}
              />
            </View>
          </View>
        </>
      )}

      {/* Konum Sec */}
      {renderSectionCard(
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Konum Sec</Text>
          <Text style={styles.sectionHint}>Haritaya dokunarak konum isaretleyin</Text>
          <LocationPicker location={location} onLocationChange={setLocation} />
        </>
      )}

      {/* Fiyat Araligi */}
      {renderSectionCard(
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Fiyat Araligi</Text>
          <Animated.View style={styles.priceRow} layout={Layout.springify()}>
            {PriceRanges.map((price) => {
              const isActive = priceRange === price.value;
              return (
                <Animated.View key={price.value} layout={Layout.springify()} style={{ flex: 1 }}>
                  <TouchableOpacity
                    style={[styles.pricePill, !isActive && { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }, isActive && styles.pricePillActive]}
                    onPress={() => handlePriceSelect(price.value as 1 | 2 | 3 | 4)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.pricePillLabel, !isActive && { color: colors.text }, isActive && styles.pricePillLabelActive]}>
                      {price.label}
                    </Text>
                    <Text style={[styles.pricePillDesc, !isActive && { color: colors.textSecondary }, isActive && styles.pricePillDescActive]}>
                      {price.description}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </Animated.View>
        </>
      )}

      {/* Etiketler */}
      {renderSectionCard(
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Etiketler</Text>
          <TagSelector selectedTags={tags} onTagsChange={setTags} />
        </>
      )}

      {/* Fotograflar */}
      {renderSectionCard(
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Fotograflar</Text>
          <ImageGrid images={images} onImagesChange={setImages} layout="horizontal" />
        </>
      )}

      {/* Submit */}
      <Button
        title={uploading ? 'Yukluyor...' : 'Mekani Kaydet'}
        variant="primary"
        onPress={handleSubmit}
        loading={submitting}
        icon="checkmark-circle"
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
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
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
  inputWrapperMultiline: {
    alignItems: 'flex-start',
    minHeight: 100,
    paddingVertical: Spacing.md,
  },
  inputIcon: {
    marginRight: Spacing.md,
  },
  textInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
    paddingVertical: 0,
  },
  textInputMultiline: {
    minHeight: 76,
    paddingTop: 2,
    textAlignVertical: 'top',
  },
  priceRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  pricePill: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    backgroundColor: Colors.backgroundSecondary,
  },
  pricePillActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  pricePillLabel: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.headingBold,
    color: Colors.text,
  },
  pricePillLabelActive: {
    color: '#FFFFFF',
  },
  pricePillDesc: {
    fontSize: FontSize.xs - 1,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  pricePillDescActive: {
    color: 'rgba(255,255,255,0.8)',
  },
});
