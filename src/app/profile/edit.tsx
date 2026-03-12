import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput, Alert, Image, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../../lib/constants';
import { useAuthStore } from '../../stores/authStore';
import { useThemeColors } from '../../hooks/useThemeColors';
import { uploadImage } from '../../lib/imageUpload';

const UNIVERSITIES = [
  'İstanbul Üniversitesi', 'İstanbul Teknik Üniversitesi', 'Boğaziçi Üniversitesi',
  'Marmara Üniversitesi', 'Yıldız Teknik Üniversitesi', 'Galatasaray Üniversitesi',
  'Medipol Üniversitesi', 'Sabancı Üniversitesi', 'Koç Üniversitesi',
  'Bahçeşehir Üniversitesi', 'Bilgi Üniversitesi', 'Özyeğin Üniversitesi',
  'Kültür Üniversitesi', 'Diğer',
];

export default function ProfileEditScreen() {
  const router = useRouter();
  const { user, updateProfile } = useAuthStore();
  const colors = useThemeColors();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [university, setUniversity] = useState(user?.university || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [showUniPicker, setShowUniPicker] = useState(false);
  const [nameError, setNameError] = useState('');

  const handlePickAvatar = async () => {
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
        // Fallback to local URI if upload fails, warn user
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
      router.back();
    }
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

      <ScrollView contentContainerStyle={styles.content}>
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

        <View style={styles.fieldGroup}>
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
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Kullanıcı Adı</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
            value={username} onChangeText={setUsername}
            placeholder="kullanıcı_adı" placeholderTextColor={colors.textTertiary} autoCapitalize="none"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Biyografi</Text>
          <TextInput
            style={[styles.input, styles.textArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
            value={bio} onChangeText={setBio}
            placeholder="Kendinizden bahsedin..." placeholderTextColor={colors.textTertiary}
            multiline numberOfLines={3}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Üniversite</Text>
          <TouchableOpacity
            style={[styles.input, styles.pickerBtn, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
            onPress={() => setShowUniPicker(!showUniPicker)}
          >
            <Text style={{ color: university ? colors.text : colors.textTertiary, fontSize: FontSize.md }}>
              {university || 'Üniversite seçin'}
            </Text>
            <Ionicons name="chevron-down" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
          {showUniPicker && (
            <View style={[styles.uniList, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                {UNIVERSITIES.map((uni) => (
                  <TouchableOpacity
                    key={uni}
                    style={[styles.uniItem, university === uni && { backgroundColor: Colors.primarySoft }]}
                    onPress={() => { setUniversity(uni); setShowUniPicker(false); }}
                  >
                    <Text style={{ color: colors.text, fontSize: FontSize.md, fontFamily: FontFamily.body }}>{uni}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
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
  pickerBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  uniList: { borderWidth: 1, borderRadius: BorderRadius.md, overflow: 'hidden' },
  uniItem: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
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
