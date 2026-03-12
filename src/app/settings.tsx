import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../lib/constants';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { useThemeColors } from '../hooks/useThemeColors';
import ScreenHeader from '../components/ui/ScreenHeader';

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const { mode, setMode } = useThemeStore();
  const colors = useThemeColors();

  const [notifPrefs, setNotifPrefs] = useState({
    new_follower: true, post_comment: true, post_like: true,
    answer_received: true, event_reminder: true, badge_earned: true, buddy_match: true,
  });

  const [dmPrivacy, setDmPrivacy] = useState<'followers_only' | 'everyone'>('followers_only');

  useEffect(() => {
    if (user) {
      supabase.from('notification_preferences').select('*').eq('user_id', user.id).single()
        .then(({ data }) => { if (data) setNotifPrefs(data as any); });
    }
  }, [user]);

  // Load dm_privacy
  useEffect(() => {
    if (user) {
      supabase.from('users').select('dm_privacy').eq('id', user.id).single()
        .then(({ data }) => {
          if (data?.dm_privacy) setDmPrivacy(data.dm_privacy);
        });
    }
  }, [user]);

  const updateDmPrivacy = async (value: 'followers_only' | 'everyone') => {
    setDmPrivacy(value);
    if (user) {
      await supabase.from('users')
        .update({ dm_privacy: value })
        .eq('id', user.id);
    }
  };

  const updateNotifPref = async (key: string, value: boolean) => {
    setNotifPrefs(prev => ({ ...prev, [key]: value }));
    if (user) {
      await supabase.from('notification_preferences')
        .upsert({ user_id: user.id, [key]: value }, { onConflict: 'user_id' });
    }
  };

  const handleSignOut = () => {
    Alert.alert('Çıkış Yap', 'Hesabınızdan çıkmak istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Çıkış Yap', style: 'destructive', onPress: () => { signOut(); router.replace('/auth/login'); } },
    ]);
  };

  const themeOptions: { label: string; value: 'light' | 'dark' | 'auto' }[] = [
    { label: 'Açık', value: 'light' },
    { label: 'Koyu', value: 'dark' },
    { label: 'Otomatik', value: 'auto' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title="Ayarlar"
        compact
        leftAction={{ icon: 'chevron-back', onPress: () => router.back() }}
      />

      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity
          style={[styles.row, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
          onPress={() => router.push('/profile/edit')}
        >
          <Ionicons name="person-outline" size={20} color={colors.primary} />
          <Text style={[styles.rowLabel, { color: colors.text }]}>Profili Düzenle</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>

        <View style={[styles.section, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Tema</Text>
          <View style={styles.themeRow}>
            {themeOptions.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.themeChip,
                  { backgroundColor: colors.surface },
                  mode === opt.value && { backgroundColor: Colors.primary },
                ]}
                onPress={() => setMode(opt.value)}
              >
                <Text style={[
                  styles.themeChipText,
                  { color: colors.textSecondary },
                  mode === opt.value && { color: '#FFFFFF' },
                ]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Bildirimler</Text>
          {[
            { key: 'new_follower', label: 'Yeni takipçi' },
            { key: 'post_comment', label: 'Yorum bildirimi' },
            { key: 'post_like', label: 'Beğeni bildirimi' },
            { key: 'answer_received', label: 'Cevap bildirimi' },
            { key: 'event_reminder', label: 'Etkinlik hatırlatması' },
            { key: 'badge_earned', label: 'Rozet bildirimi' },
          ].map(({ key, label }) => (
            <View key={key} style={styles.notifRow}>
              <Text style={[styles.notifLabel, { color: colors.text }]}>{label}</Text>
              <Switch
                value={notifPrefs[key as keyof typeof notifPrefs]}
                onValueChange={(v) => updateNotifPref(key, v)}
                trackColor={{ true: Colors.primary }}
              />
            </View>
          ))}
        </View>

        <View style={[styles.section, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Gizlilik</Text>
          <Text style={[styles.privacyDescription, { color: colors.textTertiary }]}>
            Kimler sana doğrudan mesaj atabilsin?
          </Text>
          {[
            { key: 'followers_only' as const, label: 'Sadece takipleştiğim kişiler' },
            { key: 'everyone' as const, label: 'Herkes' },
          ].map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={styles.radioRow}
              onPress={() => updateDmPrivacy(key)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={dmPrivacy === key ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={dmPrivacy === key ? Colors.primary : colors.textTertiary}
              />
              <Text style={[styles.radioLabel, { color: colors.text }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.row, styles.signOutRow, { backgroundColor: colors.primarySoft }]}
          onPress={handleSignOut}
        >
          <Ionicons name="log-out-outline" size={20} color={Colors.primary} />
          <Text style={[styles.rowLabel, { color: Colors.primary }]}>Çıkış Yap</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md },
  row: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.lg,
    borderRadius: BorderRadius.md, borderWidth: 1, gap: Spacing.md,
  },
  rowLabel: { flex: 1, fontSize: FontSize.md, fontFamily: FontFamily.bodySemiBold },
  section: { padding: Spacing.lg, borderRadius: BorderRadius.md, borderWidth: 1, gap: Spacing.sm },
  sectionTitle: { fontSize: FontSize.sm, fontFamily: FontFamily.bodySemiBold, marginBottom: Spacing.xs },
  themeRow: { flexDirection: 'row', gap: Spacing.sm },
  themeChip: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  themeChipText: { fontSize: FontSize.sm, fontFamily: FontFamily.bodySemiBold },
  notifRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.xs },
  notifLabel: { fontSize: FontSize.md, fontFamily: FontFamily.body },
  privacyDescription: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  radioRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  radioLabel: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
  },
  signOutRow: { borderWidth: 0 },
});
