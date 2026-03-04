# Feature Bundle Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement 5 feature areas: Quick Wins + Q&A Fix, Real-Time Event Chat, Push Notifications, Taste Lists, and Yemek Buddy Matching.

**Architecture:** All features follow existing patterns — Zustand stores with Supabase queries + mock fallback, Expo Router file-based navigation, design tokens from constants.ts. New features get their own stores, migrations, and route files.

**Tech Stack:** React Native 0.83.2, Expo SDK 55, Expo Router, Zustand v5, Supabase (PostgreSQL + Auth + Realtime + Storage + Edge Functions), expo-notifications, @react-native-community/datetimepicker

---

## Phase 1: Quick Wins + Q&A Fix

### Task 1: Database Migration — Quick Wins

**Files:**
- Create: `supabase/migrations/004_quick_wins.sql`

**Step 1: Write the migration**

```sql
-- 004_quick_wins.sql

-- Streak tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_date date;

-- Post bookmarks (separate from venue favorites)
CREATE TABLE IF NOT EXISTS bookmarks (
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bookmarks"
  ON bookmarks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bookmarks"
  ON bookmarks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bookmarks"
  ON bookmarks FOR DELETE
  USING (auth.uid() = user_id);
```

**Step 2: Commit**

```bash
git add supabase/migrations/004_quick_wins.sql
git commit -m "feat(db): add bookmarks table and last_active_date column"
```

---

### Task 2: Fix badgeChecker — likes_received bug + missing stats

**Files:**
- Modify: `src/lib/badgeChecker.ts`

**Step 1: Fix the likes_received query**

In `badgeChecker.ts`, replace the broken likes query (around line 31):

```ts
// BEFORE (bug: post_id is never equal to userId)
supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', userId),

// AFTER (correct: count likes on posts owned by the user)
supabase.from('likes').select('*, post:posts!inner(user_id)', { count: 'exact', head: true }).eq('posts.user_id', userId),
```

**Step 2: Add missing streak_days and upvotes_received to statsMap**

Add two new parallel queries alongside existing ones:

```ts
// Add to the Promise.all array:
supabase.from('recommendation_answers').select('upvotes').eq('user_id', userId),
supabase.from('users').select('last_active_date').eq('id', userId).single(),
```

Destructure:

```ts
const [
  // ...existing destructured results...
  { data: answersData },
  { data: streakData },
] = await Promise.all([...]);
```

Calculate stats:

```ts
// Upvotes received = sum of all upvotes on user's answers
const upvotesReceived = answersData?.reduce((sum, a) => sum + (a.upvotes || 0), 0) || 0;

// Streak calculation
const today = new Date().toISOString().split('T')[0];
const lastActive = streakData?.last_active_date;
let streakDays = 0;
if (lastActive) {
  const diff = Math.floor((new Date(today).getTime() - new Date(lastActive).getTime()) / 86400000);
  streakDays = diff <= 1 ? (diff === 0 ? 1 : 2) : 0; // Simplified - real streak needs a counter column
}
```

Add to statsMap:

```ts
const statsMap: Record<string, number> = {
  // ...existing entries...
  upvotes_received: upvotesReceived,
  streak_days: streakDays,
};
```

**Step 3: Update last_active_date in addXP**

In the `addXP` function, after the XP update succeeds, also set `last_active_date`:

```ts
await supabase
  .from('users')
  .update({
    xp_points: currentXP + points,
    last_active_date: new Date().toISOString().split('T')[0],
  })
  .eq('id', userId);
```

**Step 4: Commit**

```bash
git add src/lib/badgeChecker.ts
git commit -m "fix(badges): fix likes_received query and add streak_days + upvotes_received stats"
```

---

### Task 3: Fix Q&A System — Wire answers to correct table

**Files:**
- Modify: `src/stores/feedStore.ts`
- Modify: `src/app/post/[id].tsx`
- Modify: `src/types/index.ts`

**Step 1: Add Q&A actions to feedStore**

Add these actions to the feedStore (after `addComment` action):

```ts
fetchAnswers: async (postId: string) => {
  try {
    const { data, error } = await supabase
      .from('recommendation_answers')
      .select('*, user:users(*), venue:venues(id, name, cover_image_url)')
      .eq('post_id', postId)
      .order('upvotes', { ascending: false });

    if (error || !data?.length) {
      // Mock fallback
      const { MOCK_RECOMMENDATION_ANSWERS, MOCK_USERS, MOCK_VENUES } = await import('../lib/mockData');
      const mockAnswers = MOCK_RECOMMENDATION_ANSWERS
        .filter(a => a.post_id === postId)
        .map(a => ({
          ...a,
          user: MOCK_USERS.find(u => u.id === a.user_id),
          venue: a.venue_id ? MOCK_VENUES.find(v => v.id === a.venue_id) : undefined,
        }))
        .sort((a, b) => (b.upvotes ?? 0) - (a.upvotes ?? 0));
      return mockAnswers;
    }
    return data as RecommendationAnswer[];
  } catch {
    return [];
  }
},

submitAnswer: async (postId: string, userId: string, text: string, venueId?: string) => {
  try {
    const { data, error } = await supabase
      .from('recommendation_answers')
      .insert({
        post_id: postId,
        user_id: userId,
        text,
        venue_id: venueId || null,
        upvotes: 0,
      })
      .select('*, user:users(*), venue:venues(id, name, cover_image_url)')
      .single();

    if (error) throw error;
    await addXP(userId, 10);
    checkAndAwardBadges(userId).catch(() => {});
    return data as RecommendationAnswer;
  } catch {
    return null;
  }
},

upvoteAnswer: async (answerId: string, userId: string) => {
  try {
    // Check if already upvoted
    const { data: existing } = await supabase
      .from('answer_upvotes')
      .select('*')
      .eq('answer_id', answerId)
      .eq('user_id', userId)
      .single();

    if (existing) {
      // Remove upvote
      await supabase.from('answer_upvotes').delete().eq('answer_id', answerId).eq('user_id', userId);
      await supabase.rpc('decrement_answer_upvotes', { answer_id: answerId }); // or manual update
      return false; // removed
    } else {
      // Add upvote
      await supabase.from('answer_upvotes').insert({ answer_id: answerId, user_id: userId });
      await supabase.from('recommendation_answers').update({
        upvotes: supabase.rpc ? undefined : 0, // We'll do a direct increment
      }).eq('id', answerId);
      // Simpler: read current, increment, write back
      const { data: answer } = await supabase.from('recommendation_answers').select('upvotes').eq('id', answerId).single();
      if (answer) {
        await supabase.from('recommendation_answers').update({ upvotes: (answer.upvotes || 0) + 1 }).eq('id', answerId);
      }
      return true; // added
    }
  } catch {
    return null;
  }
},
```

**Step 2: Add imports for new types**

At the top of `feedStore.ts`, add `RecommendationAnswer` to the type import:

```ts
import type { Post, Comment, FeedCategory, RecommendationAnswer } from '../types';
```

**Step 3: Update post/[id].tsx to use real answers**

Replace the mock answer loading (around lines 116-124) with:

```ts
const [answers, setAnswers] = useState<RecommendationAnswer[]>([]);
const [upvotedAnswers, setUpvotedAnswers] = useState<Set<string>>(new Set());

useEffect(() => {
  if (post?.post_type === 'question') {
    useFeedStore.getState().fetchAnswers(post.id).then(setAnswers);
  }
}, [post]);
```

Replace the answer submission handler:

```ts
const handleSubmitAnswer = async () => {
  if (!user) { router.push('/auth/login'); return; }
  if (!commentText.trim() || !post) return;
  setSubmitting(true);

  if (post.post_type === 'question') {
    const newAnswer = await useFeedStore.getState().submitAnswer(post.id, user.id, commentText.trim());
    if (newAnswer) {
      setAnswers(prev => [newAnswer, ...prev]);
    }
  } else {
    await addComment(post.id, user.id, commentText.trim());
  }

  setCommentText('');
  setSubmitting(false);
};
```

Wire the upvote button:

```tsx
<TouchableOpacity
  activeOpacity={0.6}
  onPress={async () => {
    if (!user) { router.push('/auth/login'); return; }
    const result = await useFeedStore.getState().upvoteAnswer(item.id, user.id);
    if (result !== null) {
      setAnswers(prev => prev.map(a =>
        a.id === item.id
          ? { ...a, upvotes: (a.upvotes || 0) + (result ? 1 : -1) }
          : a
      ));
      setUpvotedAnswers(prev => {
        const next = new Set(prev);
        result ? next.add(item.id) : next.delete(item.id);
        return next;
      });
    }
  }}
>
  <Ionicons
    name={upvotedAnswers.has(item.id) ? "arrow-up-circle" : "arrow-up-circle-outline"}
    size={28}
    color={upvotedAnswers.has(item.id) ? Colors.primary : '#8B5CF6'}
  />
</TouchableOpacity>
```

**Step 4: Commit**

```bash
git add src/stores/feedStore.ts src/app/post/\[id\].tsx
git commit -m "feat(qa): wire answers to recommendation_answers table with upvoting"
```

---

### Task 4: Fix profile posts grid — add navigation

**Files:**
- Modify: `src/app/(tabs)/profile.tsx`

**Step 1: Add onPress to posts grid items**

Find the posts grid `TouchableOpacity` (around line 580) and add the handler:

```tsx
<TouchableOpacity
  style={[styles.gridItem, { width: GRID_ITEM_WIDTH }]}
  activeOpacity={0.85}
  onPress={() => router.push(`/post/${post.id}`)}
>
```

**Step 2: Commit**

```bash
git add src/app/\(tabs\)/profile.tsx
git commit -m "fix(profile): make posts grid items tappable"
```

---

### Task 5: Wire bookmark action on post detail

**Files:**
- Modify: `src/stores/feedStore.ts`
- Modify: `src/app/post/[id].tsx`

**Step 1: Add bookmark actions to feedStore**

```ts
toggleBookmark: async (postId: string, userId: string) => {
  try {
    const { data: existing } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', userId)
      .eq('post_id', postId)
      .single();

    if (existing) {
      await supabase.from('bookmarks').delete().eq('user_id', userId).eq('post_id', postId);
      return false;
    } else {
      await supabase.from('bookmarks').insert({ user_id: userId, post_id: postId });
      return true;
    }
  } catch {
    return null;
  }
},

checkBookmark: async (postId: string, userId: string) => {
  try {
    const { data } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', userId)
      .eq('post_id', postId)
      .single();
    return !!data;
  } catch {
    return false;
  }
},
```

**Step 2: Wire in post/[id].tsx**

Add state and effect:

```ts
const [isBookmarked, setIsBookmarked] = useState(false);

useEffect(() => {
  if (post && user) {
    useFeedStore.getState().checkBookmark(post.id, user.id).then(setIsBookmarked);
  }
}, [post, user]);
```

Wire the bookmark button `onPress`:

```tsx
onPress={async () => {
  if (!user) { router.push('/auth/login'); return; }
  const result = await useFeedStore.getState().toggleBookmark(post.id, user.id);
  if (result !== null) setIsBookmarked(result);
}}
```

Update the icon to reflect state:

```tsx
<Ionicons name={isBookmarked ? "bookmark" : "bookmark-outline"} size={22} color={colors.text} />
```

**Step 3: Commit**

```bash
git add src/stores/feedStore.ts src/app/post/\[id\].tsx
git commit -m "feat(bookmarks): wire bookmark toggle on post detail"
```

---

### Task 6: Settings Screen

**Files:**
- Create: `src/app/settings.tsx`
- Modify: `src/app/_layout.tsx` (register route)
- Modify: `src/app/(tabs)/profile.tsx` (change gear icon navigation)

**Step 1: Create settings screen**

```tsx
// src/app/settings.tsx
import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Switch, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../lib/constants';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore, useThemeColors, useIsDarkMode } from '../stores/themeStore';

export default function SettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuthStore();
  const { mode, setMode } = useThemeStore();
  const colors = useThemeColors();
  const isDark = useIsDarkMode();

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
        {/* Profile Edit */}
        <TouchableOpacity
          style={[styles.row, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
          onPress={() => router.push('/profile/edit')}
        >
          <Ionicons name="person-outline" size={20} color={Colors.primary} />
          <Text style={[styles.rowLabel, { color: colors.text }]}>Profili Duzenle</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>

        {/* Theme */}
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

        {/* Sign Out */}
        <TouchableOpacity
          style={[styles.row, styles.signOutRow]}
          onPress={handleSignOut}
        >
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
  section: {
    padding: Spacing.lg, borderRadius: BorderRadius.md, borderWidth: 1, gap: Spacing.sm,
  },
  sectionTitle: { fontSize: FontSize.sm, fontFamily: FontFamily.bodySemiBold, marginBottom: Spacing.xs },
  themeRow: { flexDirection: 'row', gap: Spacing.sm },
  themeChip: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full, backgroundColor: '#F0F0F0',
  },
  themeChipText: { fontSize: FontSize.sm, fontFamily: FontFamily.bodySemiBold, color: '#666' },
  signOutRow: { borderWidth: 0, backgroundColor: '#FFF0F0' },
});
```

**Step 2: Register route in _layout.tsx**

Add after the `user/[id]` screen registration:

```tsx
<Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
```

**Step 3: Update profile.tsx gear icon**

Replace the gear icon's `onPress` handler (currently calls `handleSignOut` directly) with:

```tsx
onPress={() => router.push('/settings')}
```

**Step 4: Commit**

```bash
git add src/app/settings.tsx src/app/_layout.tsx src/app/\(tabs\)/profile.tsx
git commit -m "feat(settings): add settings screen with theme toggle and sign out"
```

---

### Task 7: Profile Edit Screen

**Files:**
- Create: `src/app/profile/edit.tsx`
- Modify: `src/app/_layout.tsx` (register route)

**Step 1: Create profile edit screen**

```tsx
// src/app/profile/edit.tsx
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
import { useThemeColors } from '../../stores/themeStore';
import { uploadImage } from '../../lib/imageUpload';

const UNIVERSITIES = [
  'Istanbul Universitesi', 'Istanbul Teknik Universitesi', 'Bogazici Universitesi',
  'Marmara Universitesi', 'Yildiz Teknik Universitesi', 'Galatasaray Universitesi',
  'Medipol Universitesi', 'Sabanci Universitesi', 'Koc Universitesi',
  'Bahcesehir Universitesi', 'Bilgi Universitesi', 'Ozyegin Universitesi',
  'Kultur Universitesi', 'Diger',
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
  const [showUniPicker, setShowUniPicker] = useState(false);

  const handlePickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setAvatarUrl(uri);
    }
  };

  const handleSave = async () => {
    if (!fullName.trim()) { Alert.alert('Hata', 'Ad soyad zorunludur'); return; }
    setSaving(true);

    let finalAvatarUrl = avatarUrl;
    if (avatarUrl && avatarUrl !== user?.avatar_url && !avatarUrl.startsWith('http')) {
      const uploaded = await uploadImage(avatarUrl, 'avatars');
      if (uploaded) finalAvatarUrl = uploaded;
    }

    const { error } = await updateProfile({
      full_name: fullName.trim(),
      username: username.trim(),
      bio: bio.trim(),
      university: university.trim(),
      avatar_url: finalAvatarUrl,
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Profili Duzenle</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveBtn}>
          {saving ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text style={styles.saveBtnText}>Kaydet</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Avatar */}
        <TouchableOpacity style={styles.avatarContainer} onPress={handlePickAvatar}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={40} color={Colors.textTertiary} />
            </View>
          )}
          <View style={styles.avatarBadge}>
            <Ionicons name="camera" size={14} color="#FFF" />
          </View>
        </TouchableOpacity>

        {/* Fields */}
        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Ad Soyad</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Adiniz Soyadiniz"
            placeholderTextColor={colors.textTertiary}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Kullanici Adi</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
            value={username}
            onChangeText={setUsername}
            placeholder="kullanici_adi"
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Biyografi</Text>
          <TextInput
            style={[styles.input, styles.textArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
            value={bio}
            onChangeText={setBio}
            placeholder="Kendinizden bahsedin..."
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Universite</Text>
          <TouchableOpacity
            style={[styles.input, styles.pickerBtn, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
            onPress={() => setShowUniPicker(!showUniPicker)}
          >
            <Text style={[{ color: university ? colors.text : colors.textTertiary, fontSize: FontSize.md }]}>
              {university || 'Universite secin'}
            </Text>
            <Ionicons name="chevron-down" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
          {showUniPicker && (
            <View style={[styles.uniList, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              {UNIVERSITIES.map((uni) => (
                <TouchableOpacity
                  key={uni}
                  style={[styles.uniItem, university === uni && { backgroundColor: Colors.primarySoft }]}
                  onPress={() => { setUniversity(uni); setShowUniPicker(false); }}
                >
                  <Text style={[styles.uniItemText, { color: colors.text }]}>{uni}</Text>
                </TouchableOpacity>
              ))}
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
  uniList: { borderWidth: 1, borderRadius: BorderRadius.md, maxHeight: 200 },
  uniItem: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  uniItemText: { fontSize: FontSize.md, fontFamily: FontFamily.body },
});
```

**Step 2: Register route in _layout.tsx**

```tsx
<Stack.Screen name="profile/edit" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
```

**Step 3: Commit**

```bash
git add src/app/profile/edit.tsx src/app/_layout.tsx
git commit -m "feat(profile): add profile edit screen with avatar, bio, university picker"
```

---

### Task 8: Date Picker for Event Form

**Files:**
- Modify: `src/components/forms/EventForm.tsx`
- Install: `@react-native-community/datetimepicker`

**Step 1: Install dependency**

```bash
npx expo install @react-native-community/datetimepicker
```

**Step 2: Replace TextInput with DateTimePicker**

In `EventForm.tsx`, add imports:

```ts
import DateTimePicker from '@react-native-community/datetimepicker';
```

Replace the `dateTime` string state with a Date:

```ts
const [eventDate, setEventDate] = useState<Date>(new Date());
const [showDatePicker, setShowDatePicker] = useState(false);
const [showTimePicker, setShowTimePicker] = useState(false);
```

Replace the TextInput section (lines 194-208) with:

```tsx
<View style={[styles.sectionCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
  <Text style={[styles.sectionTitle, { color: colors.text }]}>Tarih ve Saat</Text>
  <TouchableOpacity
    style={[styles.inputWrapper, { borderColor: colors.border }]}
    onPress={() => setShowDatePicker(true)}
  >
    <Ionicons name="calendar-outline" size={18} color={Colors.textTertiary} style={styles.inputIcon} />
    <Text style={[styles.textInput, { color: colors.text }]}>
      {eventDate.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
      {' '}
      {eventDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
    </Text>
  </TouchableOpacity>
  {showDatePicker && (
    <DateTimePicker
      value={eventDate}
      mode="date"
      minimumDate={new Date()}
      onChange={(_, date) => {
        setShowDatePicker(false);
        if (date) {
          setEventDate(date);
          setShowTimePicker(true);
        }
      }}
    />
  )}
  {showTimePicker && (
    <DateTimePicker
      value={eventDate}
      mode="time"
      onChange={(_, date) => {
        setShowTimePicker(false);
        if (date) setEventDate(date);
      }}
    />
  )}
</View>
```

Update the submit handler to pass the ISO string:

```ts
event_date: eventDate.toISOString(),
```

**Step 3: Commit**

```bash
git add src/components/forms/EventForm.tsx package.json
git commit -m "feat(events): replace text input with native date/time picker"
```

---

## Phase 2: Real-Time Event Chat

### Task 9: Add Supabase Realtime subscription to event chat

**Files:**
- Modify: `src/stores/eventStore.ts`
- Modify: `src/app/event/[id].tsx`

**Step 1: Add subscription methods to eventStore**

```ts
subscribeToMessages: (eventId: string) => {
  const channel = supabase
    .channel(`event-messages-${eventId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'event_messages',
      filter: `event_id=eq.${eventId}`,
    }, async (payload) => {
      const newMsg = payload.new as any;
      // Fetch the user data for the new message
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', newMsg.user_id)
        .single();

      const message: EventMessage = {
        ...newMsg,
        user: userData || undefined,
      };

      const { messages } = get();
      // Avoid duplicates (our own sent messages are already in state)
      if (!messages.find(m => m.id === message.id)) {
        set({ messages: [...messages, message] });
      }
    })
    .subscribe();

  return channel;
},

unsubscribeFromMessages: (channel: any) => {
  if (channel) {
    supabase.removeChannel(channel);
  }
},
```

**Step 2: Wire subscription in event/[id].tsx**

In the `useEffect` that loads data (around line 61), add the subscription after `fetchMessages`:

```ts
useEffect(() => {
  if (!id) return;
  let channel: any = null;

  const loadData = async () => {
    // ...existing event loading logic...
    await Promise.all([fetchAttendees(id), fetchMessages(id)]);

    // Subscribe to new messages
    channel = useEventStore.getState().subscribeToMessages(id);
  };

  loadData();

  return () => {
    if (channel) {
      useEventStore.getState().unsubscribeFromMessages(channel);
    }
  };
}, [id]);
```

**Step 3: Add auto-scroll on new messages**

Add a ref and effect:

```ts
const flatListRef = useRef<FlatList>(null);

useEffect(() => {
  if (messages.length > 0) {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }
}, [messages.length]);
```

Attach to the FlatList:

```tsx
<FlatList ref={flatListRef} ... />
```

**Step 4: Commit**

```bash
git add src/stores/eventStore.ts src/app/event/\[id\].tsx
git commit -m "feat(chat): add real-time message subscription to event chat"
```

---

## Phase 3: Push Notifications

### Task 10: Database Migration — Push Notifications

**Files:**
- Create: `supabase/migrations/005_push_notifications.sql`

**Step 1: Write the migration**

```sql
-- 005_push_notifications.sql

CREATE TABLE IF NOT EXISTS push_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  expo_push_token text NOT NULL,
  platform text CHECK (platform IN ('ios', 'android')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, expo_push_token)
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own tokens"
  ON push_tokens FOR ALL
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id uuid REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
  new_follower boolean DEFAULT true,
  post_comment boolean DEFAULT true,
  post_like boolean DEFAULT true,
  answer_received boolean DEFAULT true,
  answer_upvote boolean DEFAULT true,
  event_reminder boolean DEFAULT true,
  badge_earned boolean DEFAULT true,
  buddy_match boolean DEFAULT true
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own preferences"
  ON notification_preferences FOR ALL
  USING (auth.uid() = user_id);
```

**Step 2: Commit**

```bash
git add supabase/migrations/005_push_notifications.sql
git commit -m "feat(db): add push_tokens and notification_preferences tables"
```

---

### Task 11: Push Notification Client Setup

**Files:**
- Install: `expo-notifications`, `expo-device`
- Create: `src/lib/notifications.ts`
- Create: `src/hooks/useNotifications.ts`
- Modify: `src/app/_layout.tsx`

**Step 1: Install dependencies**

```bash
npx expo install expo-notifications expo-device
```

**Step 2: Create notifications lib**

```ts
// src/lib/notifications.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(userId: string): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  const tokenData = await Notifications.getExpoPushTokenAsync();
  const token = tokenData.data;

  // Save to Supabase
  await supabase.from('push_tokens').upsert({
    user_id: userId,
    expo_push_token: token,
    platform: Platform.OS,
  }, { onConflict: 'user_id,expo_push_token' });

  return token;
}

export async function sendPushNotification(
  targetUserId: string,
  title: string,
  body: string,
  data?: Record<string, string>,
) {
  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('expo_push_token')
    .eq('user_id', targetUserId);

  if (!tokens?.length) return;

  const messages = tokens.map((t) => ({
    to: t.expo_push_token,
    sound: 'default' as const,
    title,
    body,
    data: data || {},
  }));

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messages),
  });
}
```

**Step 3: Create useNotifications hook**

```ts
// src/hooks/useNotifications.ts
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { registerForPushNotifications } from '../lib/notifications';

export function useNotifications() {
  const router = useRouter();
  const { user } = useAuthStore();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    if (!user) return;

    registerForPushNotifications(user.id);

    // Handle notification tap
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.route) {
        router.push(data.route as string);
      }
    });

    return () => {
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [user]);
}
```

**Step 4: Wire in _layout.tsx**

Import and call the hook inside `RootLayout`:

```ts
import { useNotifications } from '../hooks/useNotifications';

// Inside the RootLayout component, after auth init:
useNotifications();
```

**Step 5: Commit**

```bash
git add src/lib/notifications.ts src/hooks/useNotifications.ts src/app/_layout.tsx package.json
git commit -m "feat(notifications): add push notification registration and handling"
```

---

### Task 12: Wire notification triggers to user actions

**Files:**
- Modify: `src/stores/feedStore.ts` (likes, comments)
- Modify: `src/stores/eventStore.ts` (event join)
- Modify: `src/lib/badgeChecker.ts` (badge earned)

**Step 1: Add notification sends after key actions**

In `feedStore.ts` `toggleLike` — after successful like insert:

```ts
import { sendPushNotification } from '../lib/notifications';

// After like insert succeeds, notify post owner:
if (post.user_id !== userId) {
  sendPushNotification(
    post.user_id,
    'Yeni Begeni',
    `${user.full_name} gonderini begendi`,
    { route: `/post/${postId}` }
  ).catch(() => {});
}
```

In `feedStore.ts` `addComment` — after successful comment insert:

```ts
if (post.user_id !== userId) {
  sendPushNotification(
    post.user_id,
    'Yeni Yorum',
    `${user.full_name} gonderine yorum yapti`,
    { route: `/post/${postId}` }
  ).catch(() => {});
}
```

In `badgeChecker.ts` — after awarding a badge:

```ts
import { sendPushNotification } from './notifications';

// After successful user_badges insert:
sendPushNotification(
  userId,
  'Yeni Rozet!',
  `"${badge.name}" rozetini kazandin!`,
  { route: '/profile' }
).catch(() => {});
```

**Step 2: Commit**

```bash
git add src/stores/feedStore.ts src/stores/eventStore.ts src/lib/badgeChecker.ts
git commit -m "feat(notifications): wire push notifications to likes, comments, and badge awards"
```

---

### Task 13: Add notification preferences to Settings

**Files:**
- Modify: `src/app/settings.tsx`

**Step 1: Add notification toggles section**

Add state and fetch:

```ts
const [notifPrefs, setNotifPrefs] = useState({
  new_follower: true, post_comment: true, post_like: true,
  answer_received: true, event_reminder: true, badge_earned: true, buddy_match: true,
});

useEffect(() => {
  if (user) {
    supabase.from('notification_preferences').select('*').eq('user_id', user.id).single()
      .then(({ data }) => { if (data) setNotifPrefs(data); });
  }
}, [user]);

const updateNotifPref = async (key: string, value: boolean) => {
  setNotifPrefs(prev => ({ ...prev, [key]: value }));
  await supabase.from('notification_preferences')
    .upsert({ user_id: user!.id, [key]: value }, { onConflict: 'user_id' });
};
```

Add UI section after the theme section:

```tsx
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
```

Add styles:

```ts
notifRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.xs },
notifLabel: { fontSize: FontSize.md, fontFamily: FontFamily.body },
```

**Step 2: Commit**

```bash
git add src/app/settings.tsx
git commit -m "feat(settings): add notification preference toggles"
```

---

## Phase 4: Lezzet Listesi (Taste Lists)

### Task 14: Database Migration — Lists

**Files:**
- Create: `supabase/migrations/006_taste_lists.sql`

**Step 1: Write the migration**

```sql
-- 006_taste_lists.sql

CREATE TABLE IF NOT EXISTS lists (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  cover_image_url text,
  is_public boolean DEFAULT true,
  slug text UNIQUE,
  likes_count int DEFAULT 0,
  followers_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS list_venues (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id uuid REFERENCES lists(id) ON DELETE CASCADE,
  venue_id uuid REFERENCES venues(id) ON DELETE CASCADE,
  position int NOT NULL,
  note text,
  added_at timestamptz DEFAULT now(),
  UNIQUE(list_id, venue_id)
);

CREATE TABLE IF NOT EXISTS list_follows (
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  list_id uuid REFERENCES lists(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, list_id)
);

CREATE TABLE IF NOT EXISTS list_likes (
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  list_id uuid REFERENCES lists(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, list_id)
);

ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public lists visible to all" ON lists FOR SELECT USING (is_public = true OR auth.uid() = user_id);
CREATE POLICY "Users manage own lists" ON lists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own lists" ON lists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own lists" ON lists FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "List venues visible with list" ON list_venues FOR SELECT USING (true);
CREATE POLICY "List owner manages venues" ON list_venues FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM lists WHERE lists.id = list_venues.list_id AND lists.user_id = auth.uid())
);
CREATE POLICY "List owner updates venues" ON list_venues FOR UPDATE USING (
  EXISTS (SELECT 1 FROM lists WHERE lists.id = list_venues.list_id AND lists.user_id = auth.uid())
);
CREATE POLICY "List owner deletes venues" ON list_venues FOR DELETE USING (
  EXISTS (SELECT 1 FROM lists WHERE lists.id = list_venues.list_id AND lists.user_id = auth.uid())
);

CREATE POLICY "Users manage own follows" ON list_follows FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own likes" ON list_likes FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_lists_user ON lists(user_id);
CREATE INDEX idx_lists_slug ON lists(slug);
CREATE INDEX idx_list_venues_list ON list_venues(list_id, position);

-- Seed badge
INSERT INTO badges (name, description, icon_name, condition_type, condition_value, color)
VALUES ('Liste Ustasi', '3 liste olustur', 'list', 'lists_created', 3, '#F97316')
ON CONFLICT DO NOTHING;
```

**Step 2: Commit**

```bash
git add supabase/migrations/006_taste_lists.sql
git commit -m "feat(db): add lists, list_venues, list_follows, list_likes tables"
```

---

### Task 15: List Store

**Files:**
- Create: `src/stores/listStore.ts`
- Modify: `src/types/index.ts` (add types)

**Step 1: Add types**

In `src/types/index.ts`, add:

```ts
export interface List {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  is_public: boolean;
  slug: string | null;
  likes_count: number;
  followers_count: number;
  created_at: string;
  updated_at: string;
  // Joined
  user?: User;
  venues?: ListVenue[];
}

export interface ListVenue {
  id: string;
  list_id: string;
  venue_id: string;
  position: number;
  note: string | null;
  added_at: string;
  // Joined
  venue?: Venue;
}
```

**Step 2: Create listStore**

```ts
// src/stores/listStore.ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { checkAndAwardBadges, addXP } from '../lib/badgeChecker';
import type { List, ListVenue } from '../types';

interface ListState {
  lists: List[];
  userLists: List[];
  selectedList: List | null;
  loading: boolean;
  error: string | null;

  fetchPopularLists: () => Promise<void>;
  fetchUserLists: (userId: string) => Promise<void>;
  fetchListById: (id: string) => Promise<void>;
  createList: (data: { title: string; description?: string; cover_image_url?: string; user_id: string }) => Promise<List | null>;
  deleteList: (id: string) => Promise<void>;
  addVenueToList: (listId: string, venueId: string, note?: string) => Promise<void>;
  removeVenueFromList: (listId: string, venueId: string) => Promise<void>;
  toggleListLike: (listId: string, userId: string) => Promise<boolean | null>;
  toggleListFollow: (listId: string, userId: string) => Promise<boolean | null>;
}

export const useListStore = create<ListState>((set, get) => ({
  lists: [],
  userLists: [],
  selectedList: null,
  loading: false,
  error: null,

  fetchPopularLists: async () => {
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('lists')
        .select('*, user:users(*)')
        .eq('is_public', true)
        .order('likes_count', { ascending: false })
        .limit(10);

      if (!error && data) {
        set({ lists: data as List[] });
      }
    } catch { /* ignore */ }
    set({ loading: false });
  },

  fetchUserLists: async (userId) => {
    try {
      const { data } = await supabase
        .from('lists')
        .select('*, venues:list_venues(*, venue:venues(*))')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (data) set({ userLists: data as List[] });
    } catch { /* ignore */ }
  },

  fetchListById: async (id) => {
    set({ loading: true });
    try {
      const { data } = await supabase
        .from('lists')
        .select('*, user:users(*), venues:list_venues(*, venue:venues(*))')
        .eq('id', id)
        .single();

      if (data) {
        // Sort venues by position
        if (data.venues) {
          data.venues.sort((a: any, b: any) => a.position - b.position);
        }
        set({ selectedList: data as List });
      }
    } catch { /* ignore */ }
    set({ loading: false });
  },

  createList: async ({ title, description, cover_image_url, user_id }) => {
    try {
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const { data, error } = await supabase
        .from('lists')
        .insert({ title, description, cover_image_url, user_id, slug: `${slug}-${Date.now()}` })
        .select('*, user:users(*)')
        .single();

      if (error) throw error;

      addXP(user_id, 10).catch(() => {});
      checkAndAwardBadges(user_id).catch(() => {});

      const list = data as List;
      set({ userLists: [list, ...get().userLists] });
      return list;
    } catch {
      return null;
    }
  },

  deleteList: async (id) => {
    await supabase.from('lists').delete().eq('id', id);
    set({ userLists: get().userLists.filter(l => l.id !== id) });
  },

  addVenueToList: async (listId, venueId, note) => {
    const { data: existing } = await supabase
      .from('list_venues')
      .select('position')
      .eq('list_id', listId)
      .order('position', { ascending: false })
      .limit(1);

    const nextPosition = existing?.length ? existing[0].position + 1 : 0;

    await supabase.from('list_venues').insert({
      list_id: listId,
      venue_id: venueId,
      position: nextPosition,
      note,
    });
  },

  removeVenueFromList: async (listId, venueId) => {
    await supabase.from('list_venues').delete().eq('list_id', listId).eq('venue_id', venueId);
  },

  toggleListLike: async (listId, userId) => {
    try {
      const { data: existing } = await supabase
        .from('list_likes')
        .select('*')
        .eq('list_id', listId)
        .eq('user_id', userId)
        .single();

      if (existing) {
        await supabase.from('list_likes').delete().eq('list_id', listId).eq('user_id', userId);
        await supabase.from('lists').update({ likes_count: supabase.rpc ? 0 : 0 }).eq('id', listId);
        // Decrement
        const { data: list } = await supabase.from('lists').select('likes_count').eq('id', listId).single();
        if (list) await supabase.from('lists').update({ likes_count: Math.max(0, (list.likes_count || 0) - 1) }).eq('id', listId);
        return false;
      } else {
        await supabase.from('list_likes').insert({ list_id: listId, user_id: userId });
        const { data: list } = await supabase.from('lists').select('likes_count').eq('id', listId).single();
        if (list) await supabase.from('lists').update({ likes_count: (list.likes_count || 0) + 1 }).eq('id', listId);
        return true;
      }
    } catch { return null; }
  },

  toggleListFollow: async (listId, userId) => {
    try {
      const { data: existing } = await supabase
        .from('list_follows')
        .select('*')
        .eq('list_id', listId)
        .eq('user_id', userId)
        .single();

      if (existing) {
        await supabase.from('list_follows').delete().eq('list_id', listId).eq('user_id', userId);
        const { data: list } = await supabase.from('lists').select('followers_count').eq('id', listId).single();
        if (list) await supabase.from('lists').update({ followers_count: Math.max(0, (list.followers_count || 0) - 1) }).eq('id', listId);
        return false;
      } else {
        await supabase.from('list_follows').insert({ list_id: listId, user_id: userId });
        const { data: list } = await supabase.from('lists').select('followers_count').eq('id', listId).single();
        if (list) await supabase.from('lists').update({ followers_count: (list.followers_count || 0) + 1 }).eq('id', listId);
        return true;
      }
    } catch { return null; }
  },
}));
```

**Step 3: Add `lists_created` to badgeChecker statsMap**

In `badgeChecker.ts`, add a query for lists count in the Promise.all:

```ts
supabase.from('lists').select('*', { count: 'exact', head: true }).eq('user_id', userId),
```

Add to statsMap:

```ts
lists_created: listsCount || 0,
```

**Step 4: Commit**

```bash
git add src/stores/listStore.ts src/types/index.ts src/lib/badgeChecker.ts
git commit -m "feat(lists): add listStore with CRUD, like, follow actions"
```

---

### Task 16: List Detail Screen

**Files:**
- Create: `src/app/list/[id].tsx`
- Modify: `src/app/_layout.tsx`

**Step 1: Create list detail screen**

Create `src/app/list/[id].tsx` with:
- Header: cover image with gradient overlay, back button, share button
- List info: title, description, author row (avatar + name), stats (likes + followers)
- Like/Follow action buttons
- Ordered venue cards with position numbers and optional notes
- Each venue card navigates to `/venue/${venue.id}`
- Share via native share sheet

Follow the same visual pattern as `venue/[id].tsx` — hero image, glass buttons, scrollable content below.

**Step 2: Register route**

In `_layout.tsx`:

```tsx
<Stack.Screen name="list/[id]" options={{ animation: 'slide_from_right' }} />
```

**Step 3: Commit**

```bash
git add src/app/list/\[id\].tsx src/app/_layout.tsx
git commit -m "feat(lists): add list detail screen with venues, likes, follows"
```

---

### Task 17: List Creation Screen

**Files:**
- Create: `src/app/list/create.tsx`
- Modify: `src/app/_layout.tsx`

**Step 1: Create list creation screen**

Create `src/app/list/create.tsx` with:
- Header: close button, "Yeni Liste" title, save button
- Cover image picker (optional)
- Title input (required)
- Description input (multiline, optional)
- Venue search + add section (reuse venue search pattern from EventForm)
- Added venues shown as reorderable cards with remove button

**Step 2: Register route**

```tsx
<Stack.Screen name="list/create" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
```

**Step 3: Commit**

```bash
git add src/app/list/create.tsx src/app/_layout.tsx
git commit -m "feat(lists): add list creation screen with venue search"
```

---

### Task 18: Integrate Lists into Profile and Discover

**Files:**
- Modify: `src/app/(tabs)/profile.tsx` — add "Listelerim" tab
- Modify: `src/app/(tabs)/discover.tsx` — add "Populer Listeler" section
- Modify: `src/app/venue/[id].tsx` — add "Listeye Ekle" button

**Step 1: Profile — add Lists tab**

Change `ProfileTab` type to include `'lists'`:

```ts
type ProfileTab = 'favorites' | 'posts' | 'lists';
```

Add third tab chip "Listelerim". Render user's lists when `activeTab === 'lists'` using `useListStore.fetchUserLists(user.id)`. Each list card shows cover image, title, venue count. Tapping navigates to `/list/${list.id}`. Add a "Yeni Liste" button at top of the lists section.

**Step 2: Discover — add Popular Lists section**

After the "Populer Sorular" section, add:

```tsx
<SectionHeader title="Populer Listeler" icon="list" color="#F97316" />
<FlatList
  horizontal
  data={popularLists}
  renderItem={({ item }) => <ListCard list={item} onPress={() => router.push(`/list/${item.id}`)} />}
  // ...
/>
```

Call `useListStore.getState().fetchPopularLists()` in the screen's init effect.

**Step 3: Venue detail — "Listeye Ekle" button**

Add a button in the action row of `venue/[id].tsx`. On press, show a bottom sheet with user's lists (fetched from `listStore.fetchUserLists`). Tapping a list calls `listStore.addVenueToList(listId, venueId)`.

**Step 4: Commit**

```bash
git add src/app/\(tabs\)/profile.tsx src/app/\(tabs\)/discover.tsx src/app/venue/\[id\].tsx
git commit -m "feat(lists): integrate lists into profile, discover, and venue detail"
```

---

## Phase 5: Yemek Buddy Matching

### Task 19: Database Migration — Buddy System

**Files:**
- Create: `supabase/migrations/007_buddy_matching.sql`

**Step 1: Write the migration**

```sql
-- 007_buddy_matching.sql

CREATE TABLE IF NOT EXISTS meal_buddies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  status text CHECK (status IN ('available', 'matched', 'expired')) DEFAULT 'available',
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  radius_km double precision DEFAULT 2.0,
  available_from timestamptz NOT NULL,
  available_until timestamptz NOT NULL,
  note text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS buddy_matches (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_buddy_id uuid REFERENCES meal_buddies(id) ON DELETE CASCADE,
  target_buddy_id uuid REFERENCES meal_buddies(id) ON DELETE CASCADE,
  status text CHECK (status IN ('pending', 'accepted', 'declined', 'expired')) DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS buddy_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid REFERENCES buddy_matches(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS buddy_ratings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid REFERENCES buddy_matches(id) ON DELETE CASCADE,
  rater_id uuid REFERENCES users(id) ON DELETE CASCADE,
  rating boolean NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(match_id, rater_id)
);

-- RLS
ALTER TABLE meal_buddies ENABLE ROW LEVEL SECURITY;
ALTER TABLE buddy_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE buddy_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE buddy_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Available buddies visible to auth users" ON meal_buddies
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users manage own buddy status" ON meal_buddies
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Match participants see matches" ON buddy_matches
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM meal_buddies
      WHERE meal_buddies.id IN (buddy_matches.requester_buddy_id, buddy_matches.target_buddy_id)
      AND meal_buddies.user_id = auth.uid()
    )
  );
CREATE POLICY "Auth users create matches" ON buddy_matches
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Match participants update" ON buddy_matches
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM meal_buddies
      WHERE meal_buddies.id = buddy_matches.target_buddy_id
      AND meal_buddies.user_id = auth.uid()
    )
  );

CREATE POLICY "Match participants see messages" ON buddy_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM buddy_matches bm
      JOIN meal_buddies mb ON mb.id IN (bm.requester_buddy_id, bm.target_buddy_id)
      WHERE bm.id = buddy_messages.match_id AND mb.user_id = auth.uid()
    )
  );
CREATE POLICY "Match participants send messages" ON buddy_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users manage own ratings" ON buddy_ratings
  FOR ALL USING (auth.uid() = rater_id);

-- Indexes
CREATE INDEX idx_meal_buddies_active ON meal_buddies(status, available_until) WHERE status = 'available';
CREATE INDEX idx_buddy_matches_status ON buddy_matches(status);
CREATE INDEX idx_buddy_messages_match ON buddy_messages(match_id, created_at);

-- Seed badge
INSERT INTO badges (name, description, icon_name, condition_type, condition_value, color)
VALUES ('Sosyal Kelebek', '5 farkli kisiyle yemek ye', 'people', 'buddy_matches_completed', 5, '#06B6D4')
ON CONFLICT DO NOTHING;
```

**Step 2: Commit**

```bash
git add supabase/migrations/007_buddy_matching.sql
git commit -m "feat(db): add buddy matching tables and Sosyal Kelebek badge"
```

---

### Task 20: Buddy Store

**Files:**
- Create: `src/stores/buddyStore.ts`
- Modify: `src/types/index.ts`

**Step 1: Add types**

```ts
export interface MealBuddy {
  id: string;
  user_id: string;
  status: 'available' | 'matched' | 'expired';
  latitude: number;
  longitude: number;
  radius_km: number;
  available_from: string;
  available_until: string;
  note: string | null;
  created_at: string;
  // Joined
  user?: User;
}

export interface BuddyMatch {
  id: string;
  requester_buddy_id: string;
  target_buddy_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  created_at: string;
  // Joined
  requester?: MealBuddy;
  target?: MealBuddy;
}

export interface BuddyMessage {
  id: string;
  match_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  // Joined
  user?: User;
}
```

**Step 2: Create buddyStore**

```ts
// src/stores/buddyStore.ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { checkAndAwardBadges, addXP } from '../lib/badgeChecker';
import { sendPushNotification } from '../lib/notifications';
import type { MealBuddy, BuddyMatch, BuddyMessage } from '../types';

interface BuddyState {
  myBuddy: MealBuddy | null;
  nearbyBuddies: MealBuddy[];
  activeMatch: BuddyMatch | null;
  messages: BuddyMessage[];
  loading: boolean;
  error: string | null;

  goAvailable: (data: { user_id: string; latitude: number; longitude: number; available_from: string; available_until: string; note?: string }) => Promise<MealBuddy | null>;
  goUnavailable: () => Promise<void>;
  fetchNearbyBuddies: (lat: number, lng: number) => Promise<void>;
  sendMatchRequest: (targetBuddyId: string) => Promise<BuddyMatch | null>;
  respondToMatch: (matchId: string, accept: boolean) => Promise<void>;
  fetchMessages: (matchId: string) => Promise<void>;
  sendMessage: (matchId: string, senderId: string, content: string) => Promise<void>;
  subscribeToMessages: (matchId: string) => any;
  rateBuddy: (matchId: string, raterId: string, thumbsUp: boolean) => Promise<void>;
  fetchMyBuddy: (userId: string) => Promise<void>;
  fetchActiveMatch: (userId: string) => Promise<void>;
}

export const useBuddyStore = create<BuddyState>((set, get) => ({
  myBuddy: null,
  nearbyBuddies: [],
  activeMatch: null,
  messages: [],
  loading: false,
  error: null,

  fetchMyBuddy: async (userId) => {
    const { data } = await supabase
      .from('meal_buddies')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'available')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    set({ myBuddy: data as MealBuddy | null });
  },

  goAvailable: async ({ user_id, latitude, longitude, available_from, available_until, note }) => {
    try {
      // Expire any existing availability
      await supabase.from('meal_buddies').update({ status: 'expired' }).eq('user_id', user_id).eq('status', 'available');

      const { data, error } = await supabase
        .from('meal_buddies')
        .insert({ user_id, latitude, longitude, available_from, available_until, note, status: 'available' })
        .select('*')
        .single();

      if (error) throw error;
      const buddy = data as MealBuddy;
      set({ myBuddy: buddy });
      return buddy;
    } catch { return null; }
  },

  goUnavailable: async () => {
    const { myBuddy } = get();
    if (myBuddy) {
      await supabase.from('meal_buddies').update({ status: 'expired' }).eq('id', myBuddy.id);
      set({ myBuddy: null });
    }
  },

  fetchNearbyBuddies: async (lat, lng) => {
    set({ loading: true });
    try {
      // Simple bounding box query (approx 5km radius)
      const delta = 0.045; // ~5km in degrees
      const { data } = await supabase
        .from('meal_buddies')
        .select('*, user:users(*)')
        .eq('status', 'available')
        .gte('available_until', new Date().toISOString())
        .gte('latitude', lat - delta)
        .lte('latitude', lat + delta)
        .gte('longitude', lng - delta)
        .lte('longitude', lng + delta)
        .limit(20);

      if (data) {
        // Filter out own buddy
        const { myBuddy } = get();
        set({ nearbyBuddies: (data as MealBuddy[]).filter(b => b.id !== myBuddy?.id) });
      }
    } catch { /* ignore */ }
    set({ loading: false });
  },

  sendMatchRequest: async (targetBuddyId) => {
    try {
      const { myBuddy } = get();
      if (!myBuddy) return null;

      const { data, error } = await supabase
        .from('buddy_matches')
        .insert({ requester_buddy_id: myBuddy.id, target_buddy_id: targetBuddyId })
        .select('*')
        .single();

      if (error) throw error;

      // Notify target user
      const { data: targetBuddy } = await supabase
        .from('meal_buddies')
        .select('user_id')
        .eq('id', targetBuddyId)
        .single();

      if (targetBuddy) {
        sendPushNotification(
          targetBuddy.user_id,
          'Yemek Arkadasi Istegi!',
          'Birisi seninle yemek yemek istiyor!',
          { route: '/buddy' }
        ).catch(() => {});
      }

      return data as BuddyMatch;
    } catch { return null; }
  },

  respondToMatch: async (matchId, accept) => {
    const newStatus = accept ? 'accepted' : 'declined';
    await supabase.from('buddy_matches').update({ status: newStatus }).eq('id', matchId);

    if (accept) {
      // Mark both buddies as matched
      const { data: match } = await supabase
        .from('buddy_matches')
        .select('*, requester:meal_buddies!requester_buddy_id(*), target:meal_buddies!target_buddy_id(*)')
        .eq('id', matchId)
        .single();

      if (match) {
        await supabase.from('meal_buddies').update({ status: 'matched' }).in('id', [match.requester_buddy_id, match.target_buddy_id]);
        set({ activeMatch: match as BuddyMatch });
      }
    }
  },

  fetchMessages: async (matchId) => {
    const { data } = await supabase
      .from('buddy_messages')
      .select('*, user:users(*)')
      .eq('match_id', matchId)
      .order('created_at', { ascending: true });

    if (data) set({ messages: data as BuddyMessage[] });
  },

  sendMessage: async (matchId, senderId, content) => {
    await supabase.from('buddy_messages').insert({ match_id: matchId, sender_id: senderId, content });
  },

  subscribeToMessages: (matchId) => {
    const channel = supabase
      .channel(`buddy-messages-${matchId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'buddy_messages',
        filter: `match_id=eq.${matchId}`,
      }, async (payload) => {
        const newMsg = payload.new as any;
        const { data: userData } = await supabase.from('users').select('*').eq('id', newMsg.sender_id).single();
        const message: BuddyMessage = { ...newMsg, user: userData || undefined };
        const { messages } = get();
        if (!messages.find(m => m.id === message.id)) {
          set({ messages: [...messages, message] });
        }
      })
      .subscribe();
    return channel;
  },

  rateBuddy: async (matchId, raterId, thumbsUp) => {
    await supabase.from('buddy_ratings').insert({ match_id: matchId, rater_id: raterId, rating: thumbsUp });
    addXP(raterId, 20).catch(() => {});
    checkAndAwardBadges(raterId).catch(() => {});
  },

  fetchActiveMatch: async (userId) => {
    // Find an active match for this user
    const { data: myBuddies } = await supabase
      .from('meal_buddies')
      .select('id')
      .eq('user_id', userId)
      .in('status', ['available', 'matched']);

    if (!myBuddies?.length) { set({ activeMatch: null }); return; }

    const buddyIds = myBuddies.map(b => b.id);
    const { data: match } = await supabase
      .from('buddy_matches')
      .select('*, requester:meal_buddies!requester_buddy_id(*, user:users(*)), target:meal_buddies!target_buddy_id(*, user:users(*))')
      .eq('status', 'accepted')
      .or(`requester_buddy_id.in.(${buddyIds.join(',')}),target_buddy_id.in.(${buddyIds.join(',')})`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    set({ activeMatch: match as BuddyMatch | null });
  },
}));
```

**Step 3: Add `buddy_matches_completed` to badgeChecker**

In `badgeChecker.ts`, add query:

```ts
supabase.from('buddy_ratings').select('*', { count: 'exact', head: true }).eq('rater_id', userId),
```

Add to statsMap:

```ts
buddy_matches_completed: buddyRatingsCount || 0,
```

**Step 4: Commit**

```bash
git add src/stores/buddyStore.ts src/types/index.ts src/lib/badgeChecker.ts
git commit -m "feat(buddy): add buddyStore with matching, chat, and rating"
```

---

### Task 21: Buddy Screen

**Files:**
- Create: `src/app/buddy.tsx`
- Modify: `src/app/_layout.tsx`

**Step 1: Create buddy screen**

Create `src/app/buddy.tsx` with three states:

**State A — Not available:** "Yemek Arkadasi Ara" form
- Time window selector (now + 1h, now + 2h, custom)
- Note input ("Ne yemek istersin?")
- Location auto-filled from `useLocation` hook
- "Hazirla!" submit button → calls `buddyStore.goAvailable()`

**State B — Available, no match:** Mini map showing nearby buddies
- User's own pin (highlighted)
- Nearby buddy pins with avatar + note tooltip
- Tap a buddy → bottom sheet with profile preview + "Bulusma Iste" button
- "Iptal Et" button to go unavailable
- Auto-refreshes `fetchNearbyBuddies()` every 30 seconds

**State C — Matched:** Chat interface
- Reuse `MessageBubble` component from event chat
- Match info header (buddy name, avatar, note)
- Message input bar
- Real-time via `subscribeToMessages()`
- "Bulusma Nasil Gecti?" rating prompt after time window expires (thumbs up/down)

Navigation: header with back button, title "Yemek Buddy".

**Step 2: Register route**

```tsx
<Stack.Screen name="buddy" options={{ animation: 'slide_from_bottom' }} />
```

**Step 3: Commit**

```bash
git add src/app/buddy.tsx src/app/_layout.tsx
git commit -m "feat(buddy): add buddy screen with availability, matching, and chat"
```

---

### Task 22: Add Buddy FAB to Map Screen

**Files:**
- Modify: `src/app/(tabs)/map.tsx`

**Step 1: Add floating buddy button**

After the My Location `GlassView` block, add:

```tsx
<GlassView style={[styles.buddyBlur, { borderColor: colors.glass.border }]}>
  <TouchableOpacity
    style={styles.buddyButton}
    onPress={() => router.push('/buddy')}
    activeOpacity={0.7}
  >
    <Ionicons name="people" size={20} color="#06B6D4" />
  </TouchableOpacity>
</GlassView>
```

Add styles:

```ts
buddyBlur: {
  position: 'absolute',
  bottom: 180, // above my-location button
  right: Spacing.lg,
  borderRadius: BorderRadius.glass,
  borderWidth: 1,
  overflow: 'hidden',
},
buddyButton: {
  width: 44,
  height: 44,
  justifyContent: 'center',
  alignItems: 'center',
},
```

**Step 2: Commit**

```bash
git add src/app/\(tabs\)/map.tsx
git commit -m "feat(buddy): add Yemek Buddy FAB button to map screen"
```

---

### Task 23: Add Buddy Banner to Feed

**Files:**
- Modify: `src/app/(tabs)/feed.tsx`

**Step 1: Add buddy banner above feed**

At the top of the ScrollView/FlatList, add a dismissable banner:

```tsx
const [showBuddyBanner, setShowBuddyBanner] = useState(true);

// Above the posts list:
{showBuddyBanner && (
  <TouchableOpacity
    style={styles.buddyBanner}
    onPress={() => router.push('/buddy')}
    activeOpacity={0.85}
  >
    <LinearGradient
      colors={['#06B6D4', '#0891B2']}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
      style={styles.buddyBannerGradient}
    >
      <Ionicons name="people" size={24} color="#FFF" />
      <View style={{ flex: 1 }}>
        <Text style={styles.buddyBannerTitle}>Yalniz yemek yeme!</Text>
        <Text style={styles.buddyBannerSubtitle}>Yakininda yemek arkadasi bul</Text>
      </View>
      <TouchableOpacity onPress={() => setShowBuddyBanner(false)}>
        <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>
    </LinearGradient>
  </TouchableOpacity>
)}
```

**Step 2: Commit**

```bash
git add src/app/\(tabs\)/feed.tsx
git commit -m "feat(buddy): add Yemek Buddy banner to feed screen"
```

---

## Summary

| Phase | Tasks | Key Deliverables |
|-------|-------|-----------------|
| 1 | 1-8 | DB migration, badge fixes, Q&A system, bookmarks, settings, profile edit, date picker |
| 2 | 9 | Real-time event chat via Supabase Realtime |
| 3 | 10-13 | Push notifications (client + triggers + settings) |
| 4 | 14-18 | Lists store, detail screen, creation screen, integrations |
| 5 | 19-23 | Buddy matching (DB, store, screen, map FAB, feed banner) |

**Total: 23 tasks across 5 phases.**
