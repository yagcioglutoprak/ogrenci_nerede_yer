import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, Image, ActivityIndicator,
  FlatList, Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../../lib/constants';
import { useAuthStore } from '../../stores/authStore';
import { useThemeColors } from '../../hooks/useThemeColors';
import { uploadImage } from '../../lib/imageUpload';
import { useDebounce } from '../../hooks/useDebounce';
import { haptic } from '../../lib/haptics';
import SCHOOLS from '../../data/schools.json';

function normalizeTurkish(text: string): string {
  return text
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .replace(/Ş/g, 'ş')
    .replace(/Ğ/g, 'ğ')
    .replace(/Ü/g, 'ü')
    .replace(/Ö/g, 'ö')
    .replace(/Ç/g, 'ç')
    .toLowerCase();
}

export default function ProfileEditScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const colors = useThemeColors();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [university, setUniversity] = useState(user?.university || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [nameError, setNameError] = useState('');

  const [schoolSearch, setSchoolSearch] = useState('');
  const [showSchoolPicker, setShowSchoolPicker] = useState(false);
  const debouncedSearch = useDebounce(schoolSearch, 200);

  const filteredSchools = useMemo(() => {
    if (!debouncedSearch.trim()) return [];
    const query = normalizeTurkish(debouncedSearch.trim());
    return SCHOOLS.filter(
      (s: { name: string }) => normalizeTurkish(s.name).includes(query)
    ).slice(0, 20);
  }, [debouncedSearch]);

  const handlePickAvatar = async () => {
    haptic.light();
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const localUri = result.assets[0].uri;
      setAvatarUploading(true);
      const { url, error } = await uploadImage(localUri, 'avatars');
      setAvatarUploading(false);
      if (url) {
        setAvatarUrl(url);
      } else {
        setAvatarUrl(localUri);
        Alert.alert('Uyarı', error || 'Fotoğraf yüklenemedi, yerel dosya kullanılacak');
      }
    }
  };

  const handleSave = async () => {
    if (!fullName.trim()) {
      setNameError('Ad soyad zorunludur');
      return;
    }
    setNameError('');
    setSaving(true);

    const { error } = await updateProfile({
      full_name: fullName.trim(),
      username: username.trim(),
      bio: bio.trim(),
      university: university.trim(),
      avatar_url: avatarUrl,
    });

    setSaving(false);
    if (error) {
      Alert.alert('Hata', error);
    } else {
      haptic.success();
      router.back();
    }
  };

  const handleSelectSchool = (name: string) => {
    haptic.selection();
    setUniversity(name);
    setSchoolSearch('');
    setShowSchoolPicker(false);
    Keyboard.dismiss();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Profili Düzenle</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveBtn}>
          {saving ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text style={styles.saveBtnText}>Kaydet</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.delay(0).springify().damping(22).stiffness(340)}>
          <TouchableOpacity style={styles.avatarContainer} onPress={handlePickAvatar} disabled={avatarUploading}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={40} color={Colors.textTertiary} />
              </View>
            )}
            {avatarUploading && (
              <View style={styles.avatarUploadingOverlay}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            )}
            <View style={styles.avatarBadge}>
              <Ionicons name="camera" size={14} color="#FFF" />
            </View>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).springify().damping(22).stiffness(340)} style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Ad Soyad</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: nameError ? Colors.error : colors.border, backgroundColor: colors.backgroundSecondary }]}
            value={fullName}
            onChangeText={(text) => {
              setFullName(text);
              if (nameError) setNameError('');
            }}
            placeholder="Adınız Soyadınız" placeholderTextColor={colors.textTertiary}
          />
          {nameError ? (
            <View style={styles.inlineError}>
              <Ionicons name="alert-circle" size={14} color={Colors.error} />
              <Text style={styles.inlineErrorText}>{nameError}</Text>
            </View>
          ) : null}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).springify().damping(22).stiffness(340)} style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Kullanıcı Adı</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
            value={username} onChangeText={setUsername}
            placeholder="kullanıcı_adı" placeholderTextColor={colors.textTertiary} autoCapitalize="none"
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).springify().damping(22).stiffness(340)} style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Biyografi</Text>
          <TextInput
            style={[styles.input, styles.textArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
            value={bio} onChangeText={setBio}
            placeholder="Kendinizden bahsedin..." placeholderTextColor={colors.textTertiary}
            multiline numberOfLines={3}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).springify().damping(22).stiffness(340)} style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Okul</Text>
          {university && !showSchoolPicker ? (
            <TouchableOpacity
              style={[styles.input, styles.selectedSchool, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
              onPress={() => setShowSchoolPicker(true)}
            >
              <View style={styles.selectedSchoolContent}>
                <Ionicons name="school-outline" size={18} color={Colors.primary} />
                <Text style={[styles.selectedSchoolText, { color: colors.text }]} numberOfLines={1}>
                  {university}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => { setUniversity(''); setShowSchoolPicker(true); }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </TouchableOpacity>
          ) : (
            <View>
              <View style={[styles.input, styles.searchInputRow, { borderColor: showSchoolPicker ? Colors.primary : colors.border, backgroundColor: colors.backgroundSecondary }]}>
                <Ionicons name="search" size={18} color={colors.textTertiary} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  value={schoolSearch}
                  onChangeText={(text) => {
                    setSchoolSearch(text);
                    if (!showSchoolPicker) setShowSchoolPicker(true);
                  }}
                  onFocus={() => setShowSchoolPicker(true)}
                  placeholder="Okul ara..."
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {schoolSearch ? (
                  <TouchableOpacity onPress={() => setSchoolSearch('')}>
                    <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                ) : null}
              </View>
              {showSchoolPicker && debouncedSearch.trim() !== '' && (
                <View style={[styles.schoolList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  {filteredSchools.length > 0 ? (
                    <FlatList
                      data={filteredSchools}
                      keyExtractor={(item) => item.name}
                      keyboardShouldPersistTaps="handled"
                      style={{ maxHeight: 200 }}
                      renderItem={({ item, index }) => (
                        <Animated.View entering={FadeInDown.delay(index * 40).springify().damping(18)}>
                          <TouchableOpacity
                            style={[styles.schoolItem, university === item.name && { backgroundColor: colors.primarySoft }]}
                            onPress={() => handleSelectSchool(item.name)}
                          >
                            <View style={styles.schoolItemContent}>
                              <Ionicons
                                name={item.type === 'university' ? 'school-outline' : 'book-outline'}
                                size={16}
                                color={university === item.name ? Colors.primary : colors.textTertiary}
                              />
                              <View style={styles.schoolItemText}>
                                <Text style={[styles.schoolName, { color: colors.text }]} numberOfLines={1}>
                                  {item.name}
                                </Text>
                                <Text style={[styles.schoolLocation, { color: colors.textTertiary }]} numberOfLines={1}>
                                  {item.location}
                                </Text>
                              </View>
                            </View>
                          </TouchableOpacity>
                        </Animated.View>
                      )}
                    />
                  ) : (
                    <View style={styles.noResults}>
                      <Text style={[styles.noResultsText, { color: colors.textTertiary }]}>
                        Sonuç bulunamadı
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
        </Animated.View>
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
  avatarContainer: { alignSelf: 'center' },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: { backgroundColor: '#F0F0F0', justifyContent: 'center', alignItems: 'center' },
  avatarUploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#FFF',
  },
  fieldGroup: { gap: Spacing.xs },
  label: { fontSize: FontSize.sm, fontFamily: FontFamily.bodySemiBold },
  input: {
    fontSize: FontSize.md, fontFamily: FontFamily.body,
    borderWidth: 1, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  selectedSchool: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  selectedSchoolContent: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
  },
  selectedSchoolText: {
    fontSize: FontSize.md, fontFamily: FontFamily.body, flex: 1,
  },
  searchInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
  },
  searchInput: {
    flex: 1, fontSize: FontSize.md, fontFamily: FontFamily.body,
    paddingVertical: 0,
  },
  schoolList: {
    borderWidth: 1, borderRadius: BorderRadius.md, marginTop: Spacing.xs,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  schoolItem: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  schoolItemContent: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
  },
  schoolItemText: { flex: 1 },
  schoolName: {
    fontSize: FontSize.md, fontFamily: FontFamily.body,
  },
  schoolLocation: {
    fontSize: FontSize.xs, fontFamily: FontFamily.body, marginTop: 1,
  },
  noResults: {
    paddingVertical: Spacing.xl, alignItems: 'center',
  },
  noResultsText: {
    fontSize: FontSize.sm, fontFamily: FontFamily.body,
  },
  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.primarySoft,
    borderRadius: BorderRadius.sm,
  },
  inlineErrorText: {
    fontSize: FontSize.xs,
    color: Colors.error,
    fontWeight: '500',
  },
});
