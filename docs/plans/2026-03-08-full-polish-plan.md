# Full App Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all design inconsistencies, missing polish, UX friction, performance issues, and hardcoded values across the entire app.

**Architecture:** Six parallel work streams targeting visual polish, dark mode consistency, UX improvements, performance optimization, accessibility, and code cleanup. Each stream is independent and can run in parallel.

**Tech Stack:** React Native 0.83.2, Expo SDK 55, Zustand v5, react-native-reanimated v3, expo-haptics

---

## Stream A: Dark Mode & Theme Consistency

### Task A1: Extract hardcoded rgba colors in map.tsx callouts

**Files:**
- Modify: `src/app/(tabs)/map.tsx:326,361-362,371,435,518`

**Step 1: Replace all inline dark mode rgba values with theme colors**

In `map.tsx`, every callout and marker uses inline `isDark ? 'rgba(30,30,30,0.95)' : 'rgba(255,255,255,0.92)'`. Replace all instances with `colors.glass.background` from the theme:

```tsx
// BEFORE (appears 3+ times):
{ backgroundColor: isDark ? 'rgba(30,30,30,0.95)' : 'rgba(255,255,255,0.92)', borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.6)' }

// AFTER:
{ backgroundColor: colors.glass.background, borderColor: colors.glass.border }
```

Also for unreviewed tags:
```tsx
// BEFORE:
{ backgroundColor: isDark ? 'rgba(60,60,60,0.9)' : '#ECECF0', borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }

// AFTER — add to constants.ts:
// In Colors: tagUnreviewed: '#ECECF0', tagUnreviewedBorder: 'rgba(0,0,0,0.06)'
// In DarkColors: tagUnreviewed: 'rgba(60,60,60,0.9)', tagUnreviewedBorder: 'rgba(255,255,255,0.1)'
// Then use: { backgroundColor: colors.tagUnreviewed, borderColor: colors.tagUnreviewedBorder }
```

Similarly for text colors:
```tsx
// BEFORE:
{ color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)' }

// AFTER — add to constants.ts:
// In Colors: textMuted: 'rgba(0,0,0,0.45)'
// In DarkColors: textMuted: 'rgba(255,255,255,0.55)'
```

**Step 2: Run the app to verify map callouts look correct in both light and dark mode**

Run: `npx expo start --port 8090`

**Step 3: Commit**

```bash
git add src/app/\(tabs\)/map.tsx src/lib/constants.ts
git commit -m "fix: extract hardcoded rgba colors to theme constants in map callouts"
```

### Task A2: Fix hardcoded colors in messages.tsx

**Files:**
- Modify: `src/app/(tabs)/messages.tsx:131-137`

**Step 1: Add message-specific theme colors to constants.ts**

```tsx
// In Colors object:
messageUnreadBg: 'rgba(226,55,68,0.04)',
messageUnreadBorder: 'rgba(226,55,68,0.12)',

// In DarkColors object:
messageUnreadBg: 'rgba(226,55,68,0.08)',
messageUnreadBorder: 'rgba(226,55,68,0.20)',
```

**Step 2: Replace inline calculations in messages.tsx**

```tsx
// BEFORE:
const cardBg = hasUnread
  ? isDark ? 'rgba(226,55,68,0.08)' : 'rgba(226,55,68,0.04)'
  : isDark ? colors.surface : colors.background;

const cardBorder = hasUnread
  ? isDark ? 'rgba(226,55,68,0.20)' : 'rgba(226,55,68,0.12)'
  : isDark ? colors.border : colors.borderLight;

// AFTER:
const cardBg = hasUnread ? colors.messageUnreadBg : colors.background;
const cardBorder = hasUnread ? colors.messageUnreadBorder : colors.borderLight;
```

Remove the `isDark` import since it's no longer needed for this logic.

**Step 3: Commit**

```bash
git add src/app/\(tabs\)/messages.tsx src/lib/constants.ts
git commit -m "fix: use theme colors for message unread states"
```

### Task A3: Fix searchDivider hardcoded color in map

**Files:**
- Modify: `src/app/(tabs)/map.tsx:743-748`

**Step 1: Replace hardcoded divider color**

```tsx
// BEFORE:
searchDivider: {
  width: 0.5,
  height: 20,
  backgroundColor: 'rgba(0,0,0,0.12)',
  marginHorizontal: Spacing.sm,
},

// AFTER — use theme inline:
// In the JSX, change the View to:
<View style={[styles.searchDivider, { backgroundColor: colors.border }]} />
```

**Step 2: Also fix searchDropdownItem borderBottomColor**

```tsx
// BEFORE (line 784):
borderBottomColor: 'rgba(0,0,0,0.06)',

// AFTER — use theme inline in renderItem:
style={[styles.searchDropdownItem, { borderBottomColor: colors.borderLight }]}
```

**Step 3: Commit**

```bash
git add src/app/\(tabs\)/map.tsx
git commit -m "fix: use theme colors for map search dividers"
```

---

## Stream B: Haptic Feedback

### Task B1: Install expo-haptics and add haptic utility

**Files:**
- Create: `src/lib/haptics.ts`

**Step 1: Install expo-haptics**

Run: `npx expo install expo-haptics`

**Step 2: Create haptic utility module**

```tsx
// src/lib/haptics.ts
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

export const haptic = {
  light: () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },
  medium: () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },
  heavy: () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  },
  success: () => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
  error: () => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  },
  selection: () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
  },
};
```

**Step 3: Commit**

```bash
git add src/lib/haptics.ts package.json
git commit -m "feat: add expo-haptics with utility module"
```

### Task B2: Add haptics to tab bar

**Files:**
- Modify: `src/app/(tabs)/_layout.tsx`

**Step 1: Add haptic on tab press**

```tsx
import { haptic } from '../../lib/haptics';

// In handlePress function, add:
const handlePress = (name: string) => {
  haptic.light(); // ADD THIS
  const idx = findRouteIndex(name);
  // ... rest stays the same
};
```

**Step 2: Add haptic on add button press**

In AddButton component, wrap onPress:
```tsx
onPress={() => { haptic.medium(); onPress(); }}
```

**Step 3: Commit**

```bash
git add src/app/\(tabs\)/_layout.tsx
git commit -m "feat: add haptic feedback to tab bar"
```

### Task B3: Add haptics to feed interactions

**Files:**
- Modify: `src/components/feed/PostCard.tsx`

**Step 1: Add haptic on like**

Import haptics and add `haptic.light()` before like toggle action.

**Step 2: Add haptic on bookmark**

Add `haptic.selection()` before bookmark toggle.

**Step 3: Commit**

```bash
git add src/components/feed/PostCard.tsx
git commit -m "feat: add haptic feedback to feed card interactions"
```

### Task B4: Add haptics to map interactions

**Files:**
- Modify: `src/app/(tabs)/map.tsx`

**Step 1: Add haptic on marker press, filter apply, and search select**

```tsx
import { haptic } from '../../lib/haptics';

// In handleMarkerPress:
haptic.light();

// In applyFilters:
haptic.success();

// In clearFilters:
haptic.light();

// In handleSelectSearchResult:
haptic.selection();

// In handleClusterPress:
haptic.light();
```

**Step 2: Commit**

```bash
git add src/app/\(tabs\)/map.tsx
git commit -m "feat: add haptic feedback to map interactions"
```

### Task B5: Add haptics to profile and messages

**Files:**
- Modify: `src/app/(tabs)/profile.tsx`
- Modify: `src/app/(tabs)/messages.tsx`

**Step 1: Profile tab switch haptic**

In profile.tsx, add `haptic.selection()` on tab change.

**Step 2: Messages conversation tap haptic**

In messages.tsx, add `haptic.light()` on conversation press.

**Step 3: Commit**

```bash
git add src/app/\(tabs\)/profile.tsx src/app/\(tabs\)/messages.tsx
git commit -m "feat: add haptic feedback to profile and messages"
```

---

## Stream C: UX Improvements

### Task C1: Add offline indicator banner

**Files:**
- Create: `src/components/ui/OfflineBanner.tsx`
- Modify: `src/app/_layout.tsx`

**Step 1: Create OfflineBanner component**

```tsx
// src/components/ui/OfflineBanner.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { Colors, Spacing, FontSize, FontFamily, BorderRadius } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';

export default function OfflineBanner({ visible }: { visible: boolean }) {
  const colors = useThemeColors();
  if (!visible) return null;

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(18)}
      exiting={FadeOutUp.springify().damping(18)}
      style={[styles.banner, { backgroundColor: colors.warning + '15', borderColor: colors.warning + '30' }]}
    >
      <Ionicons name="cloud-offline-outline" size={16} color={Colors.warning} />
      <Text style={[styles.text, { color: colors.text }]}>
        Cevrimdisi mod — ornek veriler gosteriliyor
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  text: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodyMedium,
  },
});
```

**Step 2: Track connection status in venueStore or a new hook**

Add a `useNetworkStatus` hook using NetInfo or simply check if Supabase returned empty in the stores and expose `isUsingMockData` boolean.

**Step 3: Commit**

```bash
git add src/components/ui/OfflineBanner.tsx
git commit -m "feat: add offline mode banner component"
```

### Task C2: Fix buddy FAB positioning on map

**Files:**
- Modify: `src/app/(tabs)/map.tsx:1099-1110`

**Step 1: Use safe area insets for dynamic positioning**

```tsx
// Import useSafeAreaInsets (already imported)
// Change buddyFab style to use insets:

// BEFORE:
buddyFab: {
  position: 'absolute',
  bottom: 190,
  right: 16,

// AFTER (use dynamic bottom based on insets):
// In the component, calculate bottom position:
const insets = useSafeAreaInsets(); // already available
// ...
<TouchableOpacity
  style={[styles.buddyFab, { bottom: Math.max(insets.bottom, 8) + 110 }]}
```

**Step 2: Same for myLocationBlur**

```tsx
// BEFORE:
bottom: 100,

// AFTER:
// <GlassView style={[styles.myLocationBlur, { bottom: Math.max(insets.bottom, 8) + 80, borderColor: colors.glass.border }]}>
```

**Step 3: Commit**

```bash
git add src/app/\(tabs\)/map.tsx
git commit -m "fix: use safe area insets for map FAB positioning"
```

### Task C3: Improve filter UX — make "Hepsi" label clearer

**Files:**
- Modify: `src/app/(tabs)/map.tsx:659-684`

**Step 1: Change rating 0 label from "Hepsi" to "Tumu" with icon**

```tsx
// BEFORE:
<Text ...>Hepsi</Text>

// AFTER:
<>
  <Ionicons name="checkmark-circle" size={14} color={isActive ? '#FFFFFF' : colors.textSecondary} />
  <Text ...>Tumu</Text>
</>
```

**Step 2: Commit**

```bash
git add src/app/\(tabs\)/map.tsx
git commit -m "fix: improve filter rating 'all' label clarity"
```

### Task C4: Fix mapPadding to use safe area insets

**Files:**
- Modify: `src/app/(tabs)/map.tsx:290`

**Step 1: Calculate dynamic map padding**

```tsx
// Need to get insets inside the component (already using SafeAreaView)
// Import useSafeAreaInsets:
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// In the component:
const insets = useSafeAreaInsets();

// BEFORE:
mapPadding={{ top: 100, right: 0, bottom: 80, left: 0 }}

// AFTER:
mapPadding={{ top: insets.top + 60, right: 0, bottom: insets.bottom + 60, left: 0 }}
```

**Step 2: Commit**

```bash
git add src/app/\(tabs\)/map.tsx
git commit -m "fix: use safe area insets for map padding"
```

---

## Stream D: Performance

### Task D1: React.memo for feed card components

**Files:**
- Modify: `src/components/feed/PostCard.tsx`
- Modify: `src/components/feed/EventCard.tsx`
- Modify: `src/components/feed/QuestionCard.tsx`
- Modify: `src/components/feed/MomentCard.tsx`

**Step 1: Wrap each card export with React.memo**

For each file, change:
```tsx
// BEFORE:
export default function PostCard(props: PostCardProps) { ... }

// AFTER:
function PostCardInner(props: PostCardProps) { ... }
export default React.memo(PostCardInner);
```

Do the same for EventCard, QuestionCard, MomentCard.

**Step 2: Test feed scrolling is still smooth**

Run: `npx expo start --port 8090` and scroll the feed rapidly.

**Step 3: Commit**

```bash
git add src/components/feed/PostCard.tsx src/components/feed/EventCard.tsx src/components/feed/QuestionCard.tsx src/components/feed/MomentCard.tsx
git commit -m "perf: wrap feed card components with React.memo"
```

### Task D2: Memoize filtered conversations in messages

**Files:**
- Modify: `src/app/(tabs)/messages.tsx:59-63`

**Step 1: Use useMemo for filtered conversations**

```tsx
// BEFORE:
const filteredConversations = conversations.filter((c) => {
  if (!searchQuery.trim()) return true;
  const name = (c.other_user?.full_name || c.other_user?.username || '').toLowerCase();
  return name.includes(searchQuery.toLowerCase());
});

// AFTER:
const filteredConversations = useMemo(() =>
  conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const name = (c.other_user?.full_name || c.other_user?.username || '').toLowerCase();
    return name.includes(searchQuery.toLowerCase());
  }),
  [conversations, searchQuery]
);
```

Add `useMemo` to imports.

**Step 2: Same for recentActive**

```tsx
const recentActive = useMemo(() =>
  conversations.filter((c) => (c.unread_count ?? 0) > 0).slice(0, 6),
  [conversations]
);
```

**Step 3: Commit**

```bash
git add src/app/\(tabs\)/messages.tsx
git commit -m "perf: memoize filtered conversations and active contacts"
```

---

## Stream E: Accessibility

### Task E1: Add accessibility labels to map controls

**Files:**
- Modify: `src/app/(tabs)/map.tsx`

**Step 1: Add labels to all interactive elements**

```tsx
// Search input:
<TextInput
  ...
  accessibilityLabel="Mekan veya semt ara"
/>

// Filter button:
<TouchableOpacity
  ...
  accessibilityLabel="Filtreleri ac"
  accessibilityRole="button"
>

// My location button:
<TouchableOpacity
  ...
  accessibilityLabel="Konumuma git"
  accessibilityRole="button"
>

// Buddy FAB:
<TouchableOpacity
  ...
  accessibilityLabel="Yemek arkadasi bul"
  accessibilityRole="button"
>

// Clear search button:
<TouchableOpacity
  ...
  accessibilityLabel="Aramayi temizle"
  accessibilityRole="button"
>
```

**Step 2: Add labels to filter chips**

```tsx
// Price filter chip:
<TouchableOpacity
  ...
  accessibilityLabel={`Fiyat araligi ${price.label} ${price.description}`}
  accessibilityState={{ selected: isActive }}
>

// Rating filter chip:
<TouchableOpacity
  ...
  accessibilityLabel={rating > 0 ? `Minimum ${rating} puan` : 'Tum puanlar'}
  accessibilityState={{ selected: isActive }}
>
```

**Step 3: Commit**

```bash
git add src/app/\(tabs\)/map.tsx
git commit -m "a11y: add accessibility labels to map controls and filters"
```

### Task E2: Add accessibility labels to feed screen

**Files:**
- Modify: `src/app/(tabs)/feed.tsx`
- Modify: `src/components/feed/PostCard.tsx`

**Step 1: Feed category chips**

```tsx
<TouchableOpacity
  ...
  accessibilityLabel={`${cat.label} kategorisi`}
  accessibilityRole="tab"
  accessibilityState={{ selected: isActive }}
>
```

**Step 2: PostCard actions**

Add to like button: `accessibilityLabel="Begeni"`, comment: `accessibilityLabel="Yorum yap"`, bookmark: `accessibilityLabel="Kaydet"`, share: `accessibilityLabel="Paylas"`

**Step 3: Commit**

```bash
git add src/app/\(tabs\)/feed.tsx src/components/feed/PostCard.tsx
git commit -m "a11y: add accessibility labels to feed and post cards"
```

### Task E3: Add accessibility to profile and messages

**Files:**
- Modify: `src/app/(tabs)/profile.tsx`
- Modify: `src/app/(tabs)/messages.tsx`

**Step 1: Profile tab buttons**

```tsx
<TouchableOpacity
  ...
  accessibilityRole="tab"
  accessibilityLabel={`${tabLabel} sekmesi`}
  accessibilityState={{ selected: activeTab === tabKey }}
>
```

**Step 2: Message conversation cards**

```tsx
<TouchableOpacity
  ...
  accessibilityLabel={`${item.other_user?.full_name} ile sohbet${hasUnread ? `, ${item.unread_count} okunmamis mesaj` : ''}`}
  accessibilityRole="button"
>
```

**Step 3: Commit**

```bash
git add src/app/\(tabs\)/profile.tsx src/app/\(tabs\)/messages.tsx
git commit -m "a11y: add accessibility labels to profile tabs and message cards"
```

---

## Stream F: Code Cleanup & Constants

### Task F1: Extract magic numbers to constants

**Files:**
- Modify: `src/lib/constants.ts`
- Modify: `src/app/(tabs)/map.tsx`

**Step 1: Add map-specific constants**

```tsx
// In constants.ts, add:
export const MapConfig = {
  CLUSTER_ZOOM_THRESHOLD: 0.012,
  MARKER_ANIMATION_DURATION: 500,
  SEARCH_DEBOUNCE_MS: 300,
  MAX_SEARCH_RESULTS: 5,
  DEFAULT_ZOOM_DELTA: 0.01,
  CLUSTER_PADDING: 0.002,
  MIN_CLUSTER_DELTA: 0.005,
} as const;
```

**Step 2: Replace magic numbers in map.tsx**

```tsx
// BEFORE:
const CLUSTER_ZOOM_THRESHOLD = 0.012;

// AFTER:
import { MapConfig } from '../../lib/constants';
// Use MapConfig.CLUSTER_ZOOM_THRESHOLD, etc.
```

**Step 3: Commit**

```bash
git add src/lib/constants.ts src/app/\(tabs\)/map.tsx
git commit -m "refactor: extract map magic numbers to constants"
```

### Task F2: Shared animation configs

**Files:**
- Modify: `src/lib/constants.ts`

**Step 1: Add shared spring configs**

```tsx
// In constants.ts, add:
export const SpringConfig = {
  default: { damping: 15, stiffness: 180, mass: 0.7 },
  snappy: { damping: 18, stiffness: 200 },
  gentle: { damping: 15, stiffness: 120 },
  bouncy: { damping: 12, stiffness: 200 },
} as const;

export const AnimationConfig = {
  staggerInterval: 50,
  maxStaggerDelay: 250,
  fadeInDuration: 300,
} as const;
```

**Step 2: Import and use in tab layout, feed, messages, profile**

Replace locally defined spring configs with shared ones. For example in `_layout.tsx`:

```tsx
// BEFORE:
const SPRING_CONFIG = { damping: 15, stiffness: 180, mass: 0.7 };

// AFTER:
import { SpringConfig } from '../../lib/constants';
// Use SpringConfig.default
```

**Step 3: Commit**

```bash
git add src/lib/constants.ts
git commit -m "refactor: extract shared animation configs to constants"
```

### Task F3: Fix badge borderColor hardcoded white in tab bar

**Files:**
- Modify: `src/app/(tabs)/_layout.tsx:529-530`

**Step 1: Use theme background color**

```tsx
// BEFORE:
borderColor: '#FFF',

// AFTER — use colors.background in the component:
// The badge needs the colors prop or needs to read from theme
// Since it's inside GlassTabItem which has isDark prop:
borderColor: isDark ? DarkColors.background : Colors.background,
// Or simpler: use the colors from useThemeColors
```

**Step 2: Same for activeBadge borderColor in messages.tsx**

```tsx
// BEFORE (line 460):
borderColor: '#FFF',

// AFTER:
borderColor: colors.background,
```

**Step 3: Commit**

```bash
git add src/app/\(tabs\)/_layout.tsx src/app/\(tabs\)/messages.tsx
git commit -m "fix: use theme background for badge borders"
```

---

## Execution Order

These streams are independent and can run in parallel:

- **Stream A** (3 tasks): Dark mode theme consistency
- **Stream B** (5 tasks): Haptic feedback
- **Stream C** (4 tasks): UX improvements
- **Stream D** (2 tasks): Performance
- **Stream E** (3 tasks): Accessibility
- **Stream F** (3 tasks): Code cleanup

**Total: 20 tasks**

Recommended execution: Dispatch streams A, B, C, D, E, F to parallel agents.
