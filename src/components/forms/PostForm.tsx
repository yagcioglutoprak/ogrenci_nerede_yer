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
import { Ionicons } from '@expo/vector-icons';
import { useFeedStore } from '../../stores/feedStore';
import { useVenueStore } from '../../stores/venueStore';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';
import { haptic } from '../../lib/haptics';
import GlassView from '../ui/GlassView';
import Button from '../ui/Button';
import ImageGrid from './ImageGrid';
import type { User } from '../../types';

interface PostFormProps {
  user: User;
}

export default function PostForm({ user }: PostFormProps) {
  const colors = useThemeColors();
  const { createPost } = useFeedStore();
  const { venues } = useVenueStore();

  const [caption, setCaption] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [venueId, setVenueId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const filteredVenues = venues.filter((v) =>
    v.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const selectedVenue = venues.find((v) => v.id === venueId);

  const resetForm = () => {
    setCaption('');
    setImages([]);
    setVenueId(null);
    setSearchQuery('');
  };

  const handleSubmit = async () => {
    if (!caption.trim() && images.length === 0) {
      Alert.alert('Hata', 'Bir aciklama yazin veya fotograf ekleyin.');
      return;
    }

    setSubmitting(true);
    const { error } = await createPost({
      user_id: user.id,
      venue_id: venueId || undefined,
      caption: caption.trim(),
      image_urls: images,
    });
    setSubmitting(false);

    if (error) {
      Alert.alert('Hata', error);
    } else {
      haptic.success();
      Alert.alert('Basarili', 'Gonderi basariyla paylasildi!');
      resetForm();
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
      {/* Photo Grid Picker */}
      {renderSectionCard(
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Fotograflar</Text>
          <Text style={styles.sectionHint}>En fazla 5 fotograf ekleyebilirsiniz</Text>
          <ImageGrid images={images} onImagesChange={setImages} layout="grid" />
        </>
      )}

      {/* Caption */}
      {renderSectionCard(
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Aciklama</Text>
          <View style={[styles.inputWrapper, styles.inputWrapperMultiline, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
            <TextInput
              style={[styles.textInput, styles.textInputMultiline, { paddingLeft: 0, color: colors.text }]}
              placeholder="Deneyimini paylas..."
              placeholderTextColor={colors.textTertiary}
              value={caption}
              onChangeText={setCaption}
              multiline
              textAlignVertical="top"
              selectionColor={colors.primary}
            />
          </View>
        </>
      )}

      {/* Venue Tag Selector */}
      {renderSectionCard(
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Mekan Etiketi</Text>
          <Text style={styles.sectionHint}>Opsiyonel - gonderinizi bir mekanla iliskilendirin</Text>

          {selectedVenue ? (
            <View style={[styles.selectedVenueCard, { backgroundColor: colors.primarySoft }]}>
              <View style={[styles.selectedVenueIcon, { backgroundColor: colors.background }]}>
                <Ionicons name="restaurant" size={16} color={Colors.primary} />
              </View>
              <Text style={[styles.selectedVenueName, { color: colors.text }]} numberOfLines={1}>
                {selectedVenue.name}
              </Text>
              <TouchableOpacity
                onPress={() => setVenueId(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={22} color={Colors.textTertiary} />
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={[styles.inputWrapper, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                <Ionicons name="search-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.textInput, { color: colors.text }]}
                  placeholder="Mekan ara..."
                  placeholderTextColor={colors.textTertiary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  selectionColor={colors.primary}
                />
              </View>
              {searchQuery.length > 0 && (
                <View style={[styles.venueSearchResults, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  {filteredVenues.slice(0, 5).map((v) => (
                    <TouchableOpacity
                      key={v.id}
                      style={[styles.venueSearchItem, { borderBottomColor: colors.borderLight }]}
                      onPress={() => {
                        setVenueId(v.id);
                        setSearchQuery('');
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.venueSearchItemIcon, { backgroundColor: colors.primarySoft }]}>
                        <Ionicons name="restaurant-outline" size={14} color={Colors.primary} />
                      </View>
                      <View style={styles.venueSearchItemInfo}>
                        <Text style={[styles.venueSearchItemName, { color: colors.text }]}>{v.name}</Text>
                        <Text style={[styles.venueSearchItemAddr, { color: colors.textSecondary }]} numberOfLines={1}>{v.address}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                  {filteredVenues.length === 0 && (
                    <View style={styles.venueSearchEmpty}>
                      <Ionicons name="search-outline" size={20} color={Colors.textTertiary} />
                      <Text style={styles.venueSearchEmptyText}>Mekan bulunamadi</Text>
                    </View>
                  )}
                </View>
              )}
            </>
          )}
        </>
      )}

      {/* Submit */}
      <Button
        title="Paylas"
        variant="primary"
        onPress={handleSubmit}
        loading={submitting}
        icon="paper-plane"
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
  selectedVenueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.primarySoft,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primaryLight + '30',
  },
  selectedVenueIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedVenueName: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  venueSearchResults: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  venueSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  venueSearchItemIcon: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  venueSearchItemInfo: {
    flex: 1,
  },
  venueSearchItemName: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  venueSearchItemAddr: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  venueSearchEmpty: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  venueSearchEmptyText: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
  },
});
