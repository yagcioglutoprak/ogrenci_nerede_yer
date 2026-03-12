import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Image, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../../lib/constants';
import { useListStore } from '../../stores/listStore';
import { useVenueStore } from '../../stores/venueStore';
import { useAuthStore } from '../../stores/authStore';
import { useThemeColors } from '../../hooks/useThemeColors';
import { haptic } from '../../lib/haptics';
import type { Venue } from '../../types';

export default function ListCreateScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { user } = useAuthStore();
  const { createList, addVenueToList } = useListStore();
  const { searchVenues, venues: searchResults } = useVenueStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [venueQuery, setVenueQuery] = useState('');
  const [selectedVenues, setSelectedVenues] = useState<Venue[]>([]);
  const [saving, setSaving] = useState(false);

  const handlePickCover = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setCoverImage(result.assets[0].uri);
    }
  };

  const handleVenueSearch = (query: string) => {
    setVenueQuery(query);
    if (query.length > 1) searchVenues(query);
  };

  const addVenue = (venue: Venue) => {
    if (!selectedVenues.find(v => v.id === venue.id)) {
      haptic.selection();
      setSelectedVenues(prev => [...prev, venue]);
    }
    setVenueQuery('');
  };

  const removeVenue = (venueId: string) => {
    haptic.selection();
    setSelectedVenues(prev => prev.filter(v => v.id !== venueId));
  };

  const handleSave = async () => {
    if (!title.trim()) { Alert.alert('Hata', 'Liste basligi zorunludur'); return; }
    if (!user) { router.push('/auth/login'); return; }
    setSaving(true);

    const list = await createList({
      title: title.trim(),
      description: description.trim() || undefined,
      cover_image_url: coverImage || undefined,
      user_id: user.id,
    });

    if (list) {
      for (let i = 0; i < selectedVenues.length; i++) {
        await addVenueToList(list.id, selectedVenues[i].id);
      }
      setSaving(false);
      haptic.success();
      router.back();
    } else {
      setSaving(false);
      Alert.alert('Hata', 'Liste olusturulamadi');
    }
  };

  const filteredResults = searchResults.filter(
    v => !selectedVenues.find(sv => sv.id === v.id)
  ).slice(0, 5);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Yeni Liste</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveBtn}>
          {saving ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text style={styles.saveBtnText}>Kaydet</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Cover Image */}
        <Animated.View entering={FadeInDown.delay(0).springify().damping(22).stiffness(340)}>
          <TouchableOpacity style={styles.coverContainer} onPress={handlePickCover}>
            {coverImage ? (
              <Image source={{ uri: coverImage }} style={styles.coverImage} />
            ) : (
              <View style={[styles.coverPlaceholder, { borderColor: colors.border }]}>
                <Ionicons name="image-outline" size={32} color={colors.textTertiary} />
                <Text style={[styles.coverText, { color: colors.textTertiary }]}>Kapak Fotografi</Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Title */}
        <Animated.View entering={FadeInDown.delay(100).springify().damping(22).stiffness(340)} style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Baslik</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
            value={title} onChangeText={setTitle}
            placeholder="ornek: En iyi 5 tost mekani" placeholderTextColor={colors.textTertiary}
          />
        </Animated.View>

        {/* Description */}
        <Animated.View entering={FadeInDown.delay(200).springify().damping(22).stiffness(340)} style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Aciklama</Text>
          <TextInput
            style={[styles.input, styles.textArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
            value={description} onChangeText={setDescription}
            placeholder="Listenizi tanitin..." placeholderTextColor={colors.textTertiary}
            multiline numberOfLines={3}
          />
        </Animated.View>

        {/* Venue Search */}
        <Animated.View entering={FadeInDown.delay(300).springify().damping(22).stiffness(340)} style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Mekan Ekle</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
            value={venueQuery} onChangeText={handleVenueSearch}
            placeholder="Mekan arayIn..." placeholderTextColor={colors.textTertiary}
          />
          {venueQuery.length > 1 && filteredResults.length > 0 && (
            <View style={[styles.searchResults, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              {filteredResults.map(venue => (
                <TouchableOpacity key={venue.id} style={styles.searchItem} onPress={() => addVenue(venue)}>
                  <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
                  <Text style={[styles.searchItemText, { color: colors.text }]} numberOfLines={1}>{venue.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Animated.View>

        {/* Selected Venues */}
        {selectedVenues.length > 0 && (
          <View style={styles.selectedVenues}>
            {selectedVenues.map((venue, index) => (
              <Animated.View key={venue.id} entering={FadeIn.springify().damping(18)}>
                <View style={[styles.selectedVenueCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                  <View style={styles.venuePosition}>
                    <Text style={styles.venuePositionText}>{index + 1}</Text>
                  </View>
                  <Text style={[styles.selectedVenueName, { color: colors.text }]} numberOfLines={1}>{venue.name}</Text>
                  <TouchableOpacity onPress={() => removeVenue(venue.id)}>
                    <Ionicons name="close-circle" size={20} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: FontSize.xl, fontFamily: FontFamily.heading },
  saveBtn: { width: 70, alignItems: 'flex-end' },
  saveBtnText: { fontSize: FontSize.md, fontFamily: FontFamily.headingBold, color: Colors.primary },
  content: { padding: Spacing.xl, gap: Spacing.xl },
  coverContainer: { borderRadius: BorderRadius.md, overflow: 'hidden' },
  coverImage: { width: '100%', height: 160, borderRadius: BorderRadius.md },
  coverPlaceholder: {
    width: '100%', height: 160, borderRadius: BorderRadius.md,
    borderWidth: 2, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', gap: Spacing.xs,
  },
  coverText: { fontSize: FontSize.sm, fontFamily: FontFamily.body },
  fieldGroup: { gap: Spacing.xs },
  label: { fontSize: FontSize.sm, fontFamily: FontFamily.bodySemiBold },
  input: {
    fontSize: FontSize.md, fontFamily: FontFamily.body,
    borderWidth: 1, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  searchResults: { borderWidth: 1, borderRadius: BorderRadius.md, overflow: 'hidden' },
  searchItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  searchItemText: { flex: 1, fontSize: FontSize.md, fontFamily: FontFamily.body },
  selectedVenues: { gap: Spacing.sm },
  selectedVenueCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, gap: Spacing.md,
  },
  venuePosition: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  venuePositionText: { fontSize: FontSize.xs, fontFamily: FontFamily.headingBold, color: '#FFF' },
  selectedVenueName: { flex: 1, fontSize: FontSize.md, fontFamily: FontFamily.bodySemiBold },
});
