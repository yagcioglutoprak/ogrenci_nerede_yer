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

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const { mode, setMode } = useThemeStore();
  const colors = useThemeColors();

  const [notifPrefs, setNotifPrefs] = useState({
    new_follower: true, post_comment: true, post_like: true,
    answer_received: true, event_reminder: true, badge_earned: true, buddy_match: true,
  });

  useEffect(() => {
    if (user) {
      supabase.from('notification_preferences').select('*').eq('user_id', user.id).single()
        .then(({ data }) => { if (data) setNotifPrefs(data as any); });
    }
  }, [user]);

  const updateNotifPref = async (key: string, value: boolean) => {
    setNotifPrefs(prev => ({ ...prev, [key]: value }));
    if (user) {
      await supabase.from('notification_preferences')
        .upsert({ user_id: user.id, [key]: value }, { onConflict: 'user_id' });
    }
  };

  const handleSignOut = () => {
    Alert.alert('Cikis Yap', 'Hesabinizdan cikmak istediginize emin misiniz?', [
      { text: 'Iptal', style: 'cancel' },
      { text: 'Cikis Yap', style: 'destructive', onPress: () => { signOut(); router.replace('/auth/login'); } },
    ]);
  };

  const themeOptions: { label: string; value: 'light' | 'dark' | 'auto' }[] = [
    { label: 'Acik', value: 'light' },
    { label: 'Koyu', value: 'dark' },
    { label: 'Otomatik', value: 'auto' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Ayarlar</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity
          style={[styles.row, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
          onPress={() => router.push('/profile/edit')}
        >
          <Ionicons name="person-outline" size={20} color={Colors.primary} />
          <Text style={[styles.rowLabel, { color: colors.text }]}>Profili Duzenle</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>

        <View style={[styles.section, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Tema</Text>
          <View style={styles.themeRow}>
            {themeOptions.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.themeChip, mode === opt.value && { backgroundColor: Colors.primary }]}
                onPress={() => setMode(opt.value)}
              >
                <Text style={[styles.themeChipText, mode === opt.value && { color: '#FFF' }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Bildirimler</Text>
          {[
            { key: 'new_follower', label: 'Yeni takipci' },
            { key: 'post_comment', label: 'Yorum bildirimi' },
            { key: 'post_like', label: 'Begeni bildirimi' },
            { key: 'answer_received', label: 'Cevap bildirimi' },
            { key: 'event_reminder', label: 'Etkinlik hatirlatmasi' },
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

        <TouchableOpacity style={[styles.row, styles.signOutRow]} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={20} color={Colors.primary} />
          <Text style={[styles.rowLabel, { color: Colors.primary }]}>Cikis Yap</Text>
        </TouchableOpacity>
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
    borderRadius: BorderRadius.full, backgroundColor: '#F0F0F0',
  },
  themeChipText: { fontSize: FontSize.sm, fontFamily: FontFamily.bodySemiBold, color: '#666' },
  notifRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.xs },
  notifLabel: { fontSize: FontSize.md, fontFamily: FontFamily.body },
  signOutRow: { borderWidth: 0, backgroundColor: '#FFF0F0' },
});
