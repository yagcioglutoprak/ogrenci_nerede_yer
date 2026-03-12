import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../lib/constants';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { useThemeColors } from '../hooks/useThemeColors';
import ScreenHeader from '../components/ui/ScreenHeader';
import Avatar from '../components/ui/Avatar';

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

  const themeOptions: { label: string; value: 'light' | 'dark' | 'auto'; emoji: string }[] = [
    { label: 'Açık', value: 'light', emoji: '☀️' },
    { label: 'Koyu', value: 'dark', emoji: '🌙' },
    { label: 'Otomatik', value: 'auto', emoji: '📱' },
  ];

  const notifConfig = [
    { key: 'new_follower', label: 'Yeni takipçi', icon: 'person-outline' as const, bg: Colors.primarySoft },
    { key: 'post_comment', label: 'Yorum bildirimi', icon: 'chatbubble-outline' as const, bg: Colors.accentSoft },
    { key: 'post_like', label: 'Beğeni bildirimi', icon: 'heart-outline' as const, bg: '#FFF0F0' },
    { key: 'answer_received', label: 'Cevap bildirimi', icon: 'arrow-undo-outline' as const, bg: '#EFF6FF' },
    { key: 'event_reminder', label: 'Etkinlik hatırlatması', icon: 'calendar-outline' as const, bg: '#ECFEFF' },
    { key: 'badge_earned', label: 'Rozet bildirimi', icon: 'trophy-outline' as const, bg: Colors.accentSoft },
  ];

  const privacyOptions = [
    { key: 'followers_only' as const, label: 'Sadece takipleştiğim kişiler', icon: 'people-outline' as const },
    { key: 'everyone' as const, label: 'Herkes', icon: 'globe-outline' as const },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}>
      <ScreenHeader
        title="Ayarlar"
        compact
        leftAction={{ icon: 'chevron-back', onPress: () => router.back() }}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Row */}
        <Animated.View entering={FadeInDown.delay(0).springify().damping(22).stiffness(340)}>
          <TouchableOpacity
            style={[styles.groupedCard, styles.profileRow, { backgroundColor: colors.surface }]}
            onPress={() => router.push('/profile/edit')}
            activeOpacity={0.7}
          >
            <Avatar
              uri={user?.avatar_url}
              name={user?.full_name ?? user?.username ?? 'Kullanıcı'}
              size={48}
            />
            <View style={styles.profileRowInfo}>
              <Text style={[styles.profileRowName, { color: colors.text }]}>
                {user?.full_name ?? user?.username ?? 'Kullanıcı'}
              </Text>
              <Text style={[styles.profileRowSub, { color: colors.textSecondary }]}>
                Profili Düzenle
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        </Animated.View>

        {/* Theme Section */}
        <Animated.View entering={FadeInDown.delay(80).springify().damping(22).stiffness(340)}>
          <View style={[styles.groupedCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>GÖRÜNÜM</Text>
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
                  activeOpacity={0.7}
                >
                  <Text style={styles.themeEmoji}>{opt.emoji}</Text>
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
        </Animated.View>

        {/* Notifications Section */}
        <Animated.View entering={FadeInDown.delay(160).springify().damping(22).stiffness(340)}>
          <View style={[styles.groupedCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>BİLDİRİMLER</Text>
            {notifConfig.map(({ key, label, icon, bg }, index) => (
              <React.Fragment key={key}>
                <View style={styles.notifRow}>
                  <View style={[styles.iconPill, { backgroundColor: bg }]}>
                    <Ionicons name={icon} size={14} color={Colors.primary} />
                  </View>
                  <Text style={[styles.notifLabel, { color: colors.text }]}>{label}</Text>
                  <Switch
                    value={notifPrefs[key as keyof typeof notifPrefs]}
                    onValueChange={(v) => updateNotifPref(key, v)}
                    trackColor={{ true: Colors.primary }}
                  />
                </View>
                {index < notifConfig.length - 1 && (
                  <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
                )}
              </React.Fragment>
            ))}
          </View>
        </Animated.View>

        {/* Privacy Section */}
        <Animated.View entering={FadeInDown.delay(240).springify().damping(22).stiffness(340)}>
          <View style={[styles.groupedCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>GİZLİLİK</Text>
            <Text style={[styles.privacyDescription, { color: colors.textTertiary }]}>
              Kimler sana doğrudan mesaj atabilsin?
            </Text>
            {privacyOptions.map(({ key, label, icon }) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.radioRow,
                  dmPrivacy === key && { backgroundColor: Colors.primarySoft },
                ]}
                onPress={() => updateDmPrivacy(key)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconPill, { backgroundColor: dmPrivacy === key ? Colors.primarySoft : colors.backgroundSecondary }]}>
                  <Ionicons
                    name={icon}
                    size={14}
                    color={dmPrivacy === key ? Colors.primary : colors.textTertiary}
                  />
                </View>
                <Text style={[styles.radioLabel, { color: colors.text }]}>{label}</Text>
                <Ionicons
                  name={dmPrivacy === key ? 'radio-button-on' : 'radio-button-off'}
                  size={20}
                  color={dmPrivacy === key ? Colors.primary : colors.textTertiary}
                />
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* Sign Out */}
        <Animated.View entering={FadeInDown.delay(320).springify().damping(22).stiffness(340)}>
          <TouchableOpacity
            style={[styles.groupedCard, styles.signOutCard, { backgroundColor: Colors.primarySoft }]}
            onPress={handleSignOut}
            activeOpacity={0.7}
          >
            <View style={[styles.iconPill, { backgroundColor: '#FFDDE0' }]}>
              <Ionicons name="log-out-outline" size={14} color={Colors.primary} />
            </View>
            <Text style={styles.signOutText}>Çıkış Yap</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxxl },
  groupedCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  profileRowInfo: { flex: 1, marginLeft: Spacing.md },
  profileRowName: { fontSize: FontSize.lg, fontFamily: FontFamily.headingBold },
  profileRowSub: { fontSize: FontSize.sm, fontFamily: FontFamily.body, marginTop: 2 },
  sectionLabel: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemiBold,
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  themeRow: { flexDirection: 'row', gap: Spacing.sm },
  themeChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  themeEmoji: { fontSize: 18 },
  themeChipText: { fontSize: FontSize.sm, fontFamily: FontFamily.bodySemiBold },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  notifLabel: { flex: 1, fontSize: FontSize.md, fontFamily: FontFamily.body },
  iconPill: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    marginLeft: 28 + Spacing.md,
  },
  privacyDescription: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  radioLabel: {
    flex: 1,
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
  },
  signOutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  signOutText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.bodySemiBold,
    color: Colors.primary,
  },
});
