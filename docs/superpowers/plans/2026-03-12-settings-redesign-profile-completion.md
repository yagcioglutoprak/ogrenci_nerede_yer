# Settings Redesign + Profile Completion Banner — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize the settings page with Apple-style grouped sections and add a profile completion banner to the profile page.

**Architecture:** Two independent UI changes — a visual rewrite of `settings.tsx` (same logic, new layout/styles) and a new `ProfileCompletionBanner` component inserted into `profile.tsx`. Both use existing stores, no new dependencies.

**Tech Stack:** React Native, Expo Router, Reanimated v4, Zustand, Ionicons, LinearGradient, useThemeColors

**Spec:** `docs/superpowers/specs/2026-03-12-settings-redesign-profile-completion-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/app/settings.tsx` | Rewrite | Full visual overhaul — Apple-style grouped sections with icon pills, staggered animations |
| `src/app/(tabs)/profile.tsx` | Modify | Add `ProfileCompletionBanner` inline component + integrate between profile info and XP bar |

---

## Chunk 1: Settings Page Redesign

### Task 1: Rewrite settings.tsx with Apple-style grouped layout

**Files:**
- Rewrite: `src/app/settings.tsx`

**Imports needed (add to existing):**
- `Animated, { FadeInDown }` from `react-native-reanimated`
- `Image` from `react-native`
- `Avatar` from `../components/ui/Avatar`

- [ ] **Step 1: Update imports and add animation + avatar support**

Add to existing imports:
```tsx
import Animated, { FadeInDown } from 'react-native-reanimated';
import Avatar from '../components/ui/Avatar';
```

Remove `Image` if not used (it's not currently imported — no change needed).

- [ ] **Step 2: Replace the profile row with avatar-based grouped card**

Replace the current `TouchableOpacity` profile row (lines 84-91) with:

```tsx
<Animated.View entering={FadeInDown.delay(0).springify().damping(22).stiffness(340)}>
  <TouchableOpacity
    style={[styles.groupedCard, styles.profileRow, { backgroundColor: colors.surface }]}
    onPress={() => router.push('/profile/edit')}
    activeOpacity={0.7}
  >
    <Avatar
      uri={user?.avatar_url}
      name={user?.full_name || user?.username || ''}
      size={48}
    />
    <View style={styles.profileRowInfo}>
      <Text style={[styles.profileRowName, { color: colors.text }]}>
        {user?.full_name || 'Kullanıcı'}
      </Text>
      <Text style={[styles.profileRowSub, { color: colors.textSecondary }]}>
        Profili Düzenle
      </Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
  </TouchableOpacity>
</Animated.View>
```

- [ ] **Step 3: Replace theme section with emoji-decorated chips**

Replace the current theme `View` section (lines 93-116) with:

```tsx
<Animated.View entering={FadeInDown.delay(80).springify().damping(22).stiffness(340)}>
  <View style={[styles.groupedCard, { backgroundColor: colors.surface }]}>
    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>GÖRÜNÜM</Text>
    <View style={styles.themeRow}>
      {themeOptions.map((opt) => {
        const emoji = opt.value === 'light' ? '☀️' : opt.value === 'dark' ? '🌙' : '📱';
        const isActive = mode === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[
              styles.themeChip,
              { backgroundColor: isActive ? Colors.primary : colors.surface },
            ]}
            onPress={() => setMode(opt.value)}
            activeOpacity={0.7}
          >
            <Text style={styles.themeEmoji}>{emoji}</Text>
            <Text style={[
              styles.themeChipText,
              { color: isActive ? '#FFFFFF' : colors.textSecondary },
            ]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  </View>
</Animated.View>
```

- [ ] **Step 4: Replace notifications section with icon pills per row**

Define the notification config array (place inside the component, before the return):

```tsx
const notifConfig = [
  { key: 'new_follower', label: 'Yeni takipçi', icon: 'person-outline' as const, bg: Colors.primarySoft },
  { key: 'post_comment', label: 'Yorum bildirimi', icon: 'chatbubble-outline' as const, bg: Colors.accentSoft },
  { key: 'post_like', label: 'Beğeni bildirimi', icon: 'heart-outline' as const, bg: '#FFF0F0' },
  { key: 'answer_received', label: 'Cevap bildirimi', icon: 'arrow-undo-outline' as const, bg: '#EFF6FF' },
  { key: 'event_reminder', label: 'Etkinlik hatırlatması', icon: 'calendar-outline' as const, bg: '#ECFEFF' },
  { key: 'badge_earned', label: 'Rozet bildirimi', icon: 'trophy-outline' as const, bg: Colors.accentSoft },
];
```

Replace the notifications section (lines 118-137) with:

```tsx
<Animated.View entering={FadeInDown.delay(160).springify().damping(22).stiffness(340)}>
  <View style={[styles.groupedCard, { backgroundColor: colors.surface }]}>
    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>BİLDİRİMLER</Text>
    {notifConfig.map(({ key, label, icon, bg }, index) => (
      <View
        key={key}
        style={[
          styles.notifRow,
          index < notifConfig.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderLight },
        ]}
      >
        <View style={[styles.iconPill, { backgroundColor: bg }]}>
          <Ionicons name={icon} size={15} color={Colors.primary} />
        </View>
        <Text style={[styles.notifLabel, { color: colors.text }]}>{label}</Text>
        <Switch
          value={notifPrefs[key as keyof typeof notifPrefs]}
          onValueChange={(v) => updateNotifPref(key, v)}
          trackColor={{ true: Colors.primary, false: colors.border }}
        />
      </View>
    ))}
  </View>
</Animated.View>
```

- [ ] **Step 5: Replace privacy section with icon pills**

Replace the privacy section (lines 139-162) with:

```tsx
<Animated.View entering={FadeInDown.delay(240).springify().damping(22).stiffness(340)}>
  <View style={[styles.groupedCard, { backgroundColor: colors.surface }]}>
    <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>GİZLİLİK</Text>
    <Text style={[styles.privacyDescription, { color: colors.textTertiary }]}>
      Kimler sana doğrudan mesaj atabilsin?
    </Text>
    {[
      { key: 'followers_only' as const, label: 'Sadece takipleştiğim kişiler', icon: 'people-outline' as const },
      { key: 'everyone' as const, label: 'Herkes', icon: 'globe-outline' as const },
    ].map(({ key, label, icon }) => (
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
          <Ionicons name={icon} size={15} color={dmPrivacy === key ? Colors.primary : colors.textTertiary} />
        </View>
        <Text style={[styles.radioLabel, { color: colors.text }]}>{label}</Text>
        <Ionicons
          name={dmPrivacy === key ? 'radio-button-on' : 'radio-button-off'}
          size={22}
          color={dmPrivacy === key ? Colors.primary : colors.textTertiary}
        />
      </TouchableOpacity>
    ))}
  </View>
</Animated.View>
```

- [ ] **Step 6: Replace sign-out row with animated grouped card**

Replace the sign-out `TouchableOpacity` (lines 164-170) with:

```tsx
<Animated.View entering={FadeInDown.delay(320).springify().damping(22).stiffness(340)}>
  <TouchableOpacity
    style={[styles.groupedCard, styles.signOutCard, { backgroundColor: Colors.primarySoft }]}
    onPress={handleSignOut}
    activeOpacity={0.7}
  >
    <Ionicons name="log-out-outline" size={20} color={Colors.primary} />
    <Text style={[styles.signOutText]}>Çıkış Yap</Text>
  </TouchableOpacity>
</Animated.View>
```

- [ ] **Step 7: Update ScrollView background**

Change the `SafeAreaView` and `ScrollView` to use `backgroundSecondary` for the scroll area:

```tsx
<SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundSecondary }]}>
```

- [ ] **Step 8: Replace entire StyleSheet with new styles**

Replace the full `styles` object with:

```tsx
const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxxl },

  // Grouped card — shared base
  groupedCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },

  // Profile row
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  profileRowInfo: { flex: 1, marginLeft: Spacing.md },
  profileRowName: { fontSize: FontSize.lg, fontFamily: FontFamily.headingBold },
  profileRowSub: { fontSize: FontSize.sm, fontFamily: FontFamily.body, marginTop: 2 },

  // Section label
  sectionLabel: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemiBold,
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },

  // Theme
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

  // Notifications
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

  // Privacy
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

  // Sign out
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
```

- [ ] **Step 9: Verify in simulator**

Run: `npx expo start --ios`
Verify:
- Profile row shows avatar + name + subtitle
- Theme section has emoji icons, active chip is red
- Notification rows have colored icon pills
- Privacy section has icon pills and radio buttons
- Sign out button is red-tinted
- Sections animate in with stagger
- Dark mode works correctly
- All interactions (switches, theme change, sign out, navigate to edit) still work

- [ ] **Step 10: Commit**

```bash
git add src/app/settings.tsx
git commit -m "feat: redesign settings page with Apple-style grouped sections"
```

---

## Chunk 2: Profile Completion Banner

### Task 2: Add ProfileCompletionBanner to profile page

**Files:**
- Modify: `src/app/(tabs)/profile.tsx`

- [ ] **Step 1: Add the ProfileCompletionBanner component**

Add this component inside `profile.tsx`, after the `XPProgressBar` component and before `ProfileScreen`:

```tsx
// Profile Completion Banner
function ProfileCompletionBanner({ user, colors }: { user: any; colors: any }) {
  const router = useRouter();

  const fields = [
    { key: 'full_name', check: !!user.full_name?.trim() },
    { key: 'username', check: !!user.username?.trim() },
    { key: 'avatar_url', check: !!user.avatar_url, label: '📷 Fotoğraf Ekle', bg: colors.primarySoft, textColor: Colors.primary },
    { key: 'bio', check: !!user.bio?.trim(), label: '✏️ Biyografi Yaz', bg: colors.accentSoft, textColor: Colors.accentDark },
    { key: 'university', check: !!user.university?.trim(), label: '🎓 Üniversite Seç', bg: 'rgba(59,130,246,0.1)', textColor: '#3B82F6' },
  ];

  const completedCount = fields.filter(f => f.check).length;
  const percentage = Math.round((completedCount / fields.length) * 100);
  const missingFields = fields.filter(f => !f.check && f.label);

  // Hooks must be called before any conditional return (Rules of Hooks)
  const progress = useSharedValue(0);
  const pct = completedCount / fields.length;

  useEffect(() => {
    progress.value = withDelay(400, withSpring(pct, SpringConfig.gentle));
  }, [completedCount]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%` as any,
  }));

  if (percentage === 100) return null;

  return (
    <View style={[completionStyles.card, { backgroundColor: colors.background, borderColor: colors.primarySoft }]}>
      <View style={completionStyles.header}>
        <View style={completionStyles.headerLeft}>
          <Text style={completionStyles.headerEmoji}>🎯</Text>
          <Text style={[completionStyles.headerTitle, { color: colors.text }]}>Profilini Tamamla</Text>
        </View>
        <Text style={[completionStyles.headerPercent, { color: Colors.primary }]}>%{percentage}</Text>
      </View>

      <View style={[completionStyles.track, { backgroundColor: colors.border }]}>
        <Animated.View style={[completionStyles.fill, barStyle]}>
          <LinearGradient
            colors={[Colors.primary, Colors.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>

      <View style={completionStyles.chipsRow}>
        {missingFields.map((field) => (
          <TouchableOpacity
            key={field.key}
            style={[completionStyles.chip, { backgroundColor: field.bg }]}
            onPress={() => { haptic.selection(); router.push('/profile/edit'); }}
            activeOpacity={0.7}
          >
            <Text style={[completionStyles.chipText, { color: field.textColor }]}>
              {field.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const completionStyles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerEmoji: { fontSize: 16 },
  headerTitle: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
  },
  headerPercent: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.headingBold,
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    overflow: 'hidden',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: Spacing.xsm,
    borderRadius: BorderRadius.sm,
  },
  chipText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemiBold,
  },
});
```

- [ ] **Step 2: Insert the banner into the profile screen layout**

In the `ProfileScreen` component's JSX, add the banner between the profile info `Animated.View` (after university/bio) and the XP Progress Bar section. Find the comment `{/* XP Progress Bar */}` and insert before it:

```tsx
{/* Profile Completion Banner */}
<Animated.View entering={FadeInDown.delay(150).springify().damping(20).stiffness(300)}>
  <ProfileCompletionBanner user={user} colors={colors} />
</Animated.View>
```

- [ ] **Step 3: Adjust XP bar animation delay**

Change the XP Progress Bar `Animated.View` delay from `200` to `250` to keep stagger order after the new banner:

```tsx
<Animated.View entering={FadeInDown.delay(250).springify().damping(20).stiffness(300)}>
```

Also adjust subsequent sections:
- Stats card: `300` → `350`
- Tab switch: `400` → `450`
- Badges: `450` → `500`

- [ ] **Step 4: Verify in simulator**

Run: `npx expo start --ios`
Verify:
- Banner appears between name/bio and XP bar
- Progress bar fills correctly based on which fields are filled
- Missing field chips show with correct colors
- Tapping a chip navigates to profile edit
- Banner disappears when all fields are filled
- Animations stagger correctly with the new section inserted
- Dark mode renders correctly

- [ ] **Step 5: Commit**

```bash
git add src/app/(tabs)/profile.tsx
git commit -m "feat: add profile completion banner with progress bar and action chips"
```
