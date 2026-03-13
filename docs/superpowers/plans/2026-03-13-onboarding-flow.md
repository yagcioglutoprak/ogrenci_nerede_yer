# Onboarding Flow Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a first-time user onboarding flow that introduces the app, collects school + food preferences, and delivers a personalized map experience.

**Architecture:** New `(onboarding)` route group with 3 screens (welcome slides, school picker, food preferences). AsyncStorage flag gates entry. Auth screens modified to route through onboarding when flag is unset. School coordinates used to center the map on first load.

**Tech Stack:** React Native, Expo Router, Zustand, Supabase, react-native-reanimated, AsyncStorage

**Spec:** `docs/superpowers/specs/2026-03-13-onboarding-flow-design.md`

---

## Chunk 1: Foundation (Database, Types, Helpers, Routing)

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/014_onboarding_fields.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Add onboarding-related columns to users table
-- Reuses existing `university` column for school name
ALTER TABLE users ADD COLUMN IF NOT EXISTS school_lat DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN IF NOT EXISTS school_lng DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN IF NOT EXISTS food_preferences TEXT[] DEFAULT '{}';
```

- [ ] **Step 2: Verify migration syntax**

Run: `cat supabase/migrations/014_onboarding_fields.sql`
Expected: The SQL above with no syntax errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/014_onboarding_fields.sql
git commit -m "feat(db): add school_lat, school_lng, food_preferences columns to users"
```

---

### Task 2: Update User TypeScript Interface

**Files:**
- Modify: `src/types/index.ts:5-19` (User interface)

- [ ] **Step 1: Add new fields to User interface**

In `src/types/index.ts`, add these fields after line 17 (`dm_privacy`), before `created_at`:

```ts
  school_lat?: number | null;
  school_lng?: number | null;
  food_preferences?: string[];
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No new errors related to User type.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add school_lat, school_lng, food_preferences to User"
```

---

### Task 3: AsyncStorage Onboarding Helpers

**Files:**
- Create: `src/lib/onboarding.ts`

- [ ] **Step 1: Create the onboarding helpers module**

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = '@onboarding_completed';

export async function hasCompletedOnboarding(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(ONBOARDING_KEY);
    return value === 'true';
  } catch {
    return false; // Default to showing onboarding if storage read fails
  }
}

export async function setOnboardingCompleted(): Promise<void> {
  try {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
  } catch {
    // Non-critical — worst case user sees onboarding again
  }
}

export async function resetOnboarding(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ONBOARDING_KEY);
  } catch {
    // Non-critical
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/onboarding.ts
git commit -m "feat(lib): add AsyncStorage onboarding helpers"
```

---

### Task 4: Add School Data to Constants

**Files:**
- Modify: `src/lib/constants.ts` (add `ISTANBUL_SCHOOLS` array at the end)

- [ ] **Step 1: Add the ISTANBUL_SCHOOLS constant**

Add this at the end of `src/lib/constants.ts`, before the final line:

```ts
// Istanbul okulları (üniversiteler, liseler, meslek okulları)
export const ISTANBUL_SCHOOLS = [
  // Üniversiteler
  { name: 'İstanbul Teknik Üniversitesi (İTÜ)', district: 'Sarıyer', lat: 41.1055, lng: 29.0250 },
  { name: 'Boğaziçi Üniversitesi', district: 'Sarıyer', lat: 41.0843, lng: 29.0510 },
  { name: 'İstanbul Üniversitesi', district: 'Fatih', lat: 41.0115, lng: 28.9634 },
  { name: 'Yıldız Teknik Üniversitesi', district: 'Beşiktaş', lat: 41.0496, lng: 29.0134 },
  { name: 'Marmara Üniversitesi', district: 'Kadıköy', lat: 40.9862, lng: 29.0606 },
  { name: 'Yeditepe Üniversitesi', district: 'Ataşehir', lat: 40.9712, lng: 29.1520 },
  { name: 'Bahçeşehir Üniversitesi', district: 'Beşiktaş', lat: 41.0424, lng: 29.0092 },
  { name: 'Koç Üniversitesi', district: 'Sarıyer', lat: 41.2054, lng: 29.0728 },
  { name: 'Sabancı Üniversitesi', district: 'Pendik', lat: 40.8904, lng: 29.3787 },
  { name: 'Galatasaray Üniversitesi', district: 'Beşiktaş', lat: 41.0462, lng: 29.0116 },
  { name: 'Mimar Sinan Güzel Sanatlar Üniversitesi', district: 'Beyoğlu', lat: 41.0315, lng: 28.9837 },
  { name: 'İstanbul Medeniyet Üniversitesi', district: 'Üsküdar', lat: 41.0218, lng: 29.0539 },
  { name: 'İstanbul Bilgi Üniversitesi', district: 'Beyoğlu', lat: 41.0526, lng: 28.9508 },
  { name: 'Kadir Has Üniversitesi', district: 'Fatih', lat: 41.0218, lng: 28.9503 },
  { name: 'Özyeğin Üniversitesi', district: 'Çekmeköy', lat: 41.0387, lng: 29.2469 },
  { name: 'Medipol Üniversitesi', district: 'Beykoz', lat: 41.1092, lng: 29.0897 },
  { name: 'İstanbul Kültür Üniversitesi', district: 'Bakırköy', lat: 40.9926, lng: 28.8598 },
  { name: 'Maltepe Üniversitesi', district: 'Maltepe', lat: 40.9629, lng: 29.1318 },
  { name: 'İstanbul Ticaret Üniversitesi', district: 'Üsküdar', lat: 41.0236, lng: 29.0431 },
  { name: 'İstanbul Aydın Üniversitesi', district: 'Küçükçekmece', lat: 41.0197, lng: 28.7890 },
  { name: 'İstanbul Gelişim Üniversitesi', district: 'Avcılar', lat: 40.9941, lng: 28.7148 },
  { name: 'Beykent Üniversitesi', district: 'Beylikdüzü', lat: 41.0050, lng: 28.6290 },
  { name: 'Nişantaşı Üniversitesi', district: 'Sarıyer', lat: 41.1061, lng: 29.0210 },
  { name: 'Doğuş Üniversitesi', district: 'Kadıköy', lat: 40.9797, lng: 29.0867 },
  { name: 'Haliç Üniversitesi', district: 'Beyoğlu', lat: 41.0381, lng: 28.9716 },
  // Liseler
  { name: 'Galatasaray Lisesi', district: 'Beyoğlu', lat: 41.0341, lng: 28.9749 },
  { name: 'İstanbul Erkek Lisesi', district: 'Fatih', lat: 41.0153, lng: 28.9500 },
  { name: 'Kabataş Erkek Lisesi', district: 'Beşiktaş', lat: 41.0420, lng: 29.0040 },
  { name: 'Kadıköy Anadolu Lisesi', district: 'Kadıköy', lat: 40.9878, lng: 29.0268 },
  { name: 'Haydarpaşa Lisesi', district: 'Kadıköy', lat: 40.9957, lng: 29.0191 },
  { name: 'Vefa Lisesi', district: 'Fatih', lat: 41.0159, lng: 28.9570 },
  { name: 'Saint-Joseph Lisesi', district: 'Beyoğlu', lat: 41.0361, lng: 28.9800 },
  { name: 'Robert Kolej', district: 'Sarıyer', lat: 41.0850, lng: 29.0520 },
  { name: 'Üsküdar Amerikan Lisesi', district: 'Üsküdar', lat: 41.0291, lng: 29.0267 },
  // Meslek Okulları
  { name: 'İstanbul Anadolu İmam Hatip Lisesi', district: 'Fatih', lat: 41.0087, lng: 28.9527 },
  { name: 'Tuzla Meslek ve Teknik Anadolu Lisesi', district: 'Pendik', lat: 40.8674, lng: 29.3040 },
] as const;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/constants.ts
git commit -m "feat(constants): add ISTANBUL_SCHOOLS data for onboarding"
```

---

### Task 5: Register Onboarding Route Group

**Files:**
- Create: `src/app/(onboarding)/_layout.tsx`
- Modify: `src/app/_layout.tsx:75-111` (add onboarding Stack.Screen)
- Modify: `src/app/index.tsx` (add onboarding check)

- [ ] **Step 1: Create the onboarding layout**

Create `src/app/(onboarding)/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';
import { useThemeColors } from '../../hooks/useThemeColors';

export default function OnboardingLayout() {
  const colors = useThemeColors();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    />
  );
}
```

- [ ] **Step 2: Register the route group in root layout**

In `src/app/_layout.tsx`, add this line after the `<Stack.Screen name="(tabs)" />` line (line 77):

```tsx
<Stack.Screen name="(onboarding)" options={{ headerShown: false, animation: 'none' }} />
```

- [ ] **Step 3: Update index.tsx with onboarding check**

Replace the entire content of `src/app/index.tsx` with:

```tsx
import { useState, useEffect } from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { hasCompletedOnboarding, setOnboardingCompleted } from '../lib/onboarding';

export default function Index() {
  const [checking, setChecking] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);

  useEffect(() => {
    if (!initialized) return;

    hasCompletedOnboarding().then((completed) => {
      if (!completed && user?.university) {
        // Re-install case: user has profile data, skip onboarding
        setOnboardingCompleted();
        setNeedsOnboarding(false);
      } else {
        setNeedsOnboarding(!completed);
      }
      setChecking(false);
    });
  }, [initialized]);

  if (checking) return null;

  if (needsOnboarding) return <Redirect href="/(onboarding)/welcome" />;
  return <Redirect href="/(tabs)/map" />;
}
```

- [ ] **Step 4: Verify app compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors (welcome.tsx doesn't exist yet, but the redirect won't crash since the route group exists).

- [ ] **Step 5: Commit**

```bash
git add src/app/(onboarding)/_layout.tsx src/app/_layout.tsx src/app/index.tsx
git commit -m "feat(routing): add onboarding route group and entry check"
```

---

### Task 6: Modify Auth Screens for Onboarding Flow

**Files:**
- Modify: `src/app/auth/login.tsx:54` (change post-auth navigation)
- Modify: `src/app/auth/register.tsx:78` (change post-auth navigation)

- [ ] **Step 1: Update login.tsx**

In `src/app/auth/login.tsx`, add the import at the top (after the existing imports):

```ts
import { hasCompletedOnboarding } from '../../lib/onboarding';
```

Then replace line 54 (`router.replace('/(tabs)/map');`) with:

```ts
      const onboardingDone = await hasCompletedOnboarding();
      router.replace(onboardingDone ? '/(tabs)/map' : '/(onboarding)/school');
```

- [ ] **Step 2: Update register.tsx**

In `src/app/auth/register.tsx`, add the import at the top (after the existing imports):

```ts
import { hasCompletedOnboarding } from '../../lib/onboarding';
```

Then replace line 78 (`router.replace('/(tabs)/map');`) with:

```ts
      const onboardingDone = await hasCompletedOnboarding();
      router.replace(onboardingDone ? '/(tabs)/map' : '/(onboarding)/school');
```

- [ ] **Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/auth/login.tsx src/app/auth/register.tsx
git commit -m "feat(auth): route to onboarding school step after first-time auth"
```

---

## Chunk 2: Welcome Screen (Intro Slides)

### Task 7: Build Welcome Screen with 3 Intro Slides

**Files:**
- Create: `src/app/(onboarding)/welcome.tsx`

- [ ] **Step 1: Create the welcome screen**

Create `src/app/(onboarding)/welcome.tsx` with:

- A horizontal `FlatList` with `pagingEnabled` and `decelerationRate="fast"` (no `snapToInterval` — it conflicts with `pagingEnabled`)
- 3 slide data items, each with: `id`, `title`, `subtitle`, `mockupType` ('map' | 'venue' | 'buddy')
- Each slide renders a phone mockup frame (rounded rect with border + shadow) containing a simplified illustration of the feature:
  - Slide 1 (map): Colored circles representing map pins on a green background
  - Slide 2 (venue): Simple card layout with star rating dots
  - Slide 3 (buddy): Two overlapping profile circles with a heart
- Title + subtitle below each mockup, centered
- Animated dot indicators at bottom using `onScroll` event and `Animated.event`:
  - Active: primary red pill shape (width 24, height 8, borderRadius 4)
  - Inactive: gray circle (width 8, height 8, borderRadius 4)
  - Smooth width/color interpolation as user swipes
- On the last slide (index 2), render two buttons with `FadeInDown` entrance animation:
  - "Kayıt Ol" — `Button` component (primary variant) → `router.push('/auth/register')`
  - "Giriş Yap" — `TouchableOpacity` text link → `router.push('/auth/login')`
- Use `useThemeColors()` for dark mode support
- Use `useWindowDimensions()` for slide width
- Use `haptic.light()` on dot indicator updates

Key implementation details:
- `FlatList` with `data={slides}` where slides is a local constant array
- `renderItem` renders `SlideItem` component with `width` from `useWindowDimensions`
- `keyExtractor={(item) => item.id}`
- `showsHorizontalScrollIndicator={false}`
- `bounces={false}`
- `onScroll` updates a `scrollX` shared value for dot animation
- `SafeAreaView` wrapping the whole screen
- Import `Button` from `../../components/ui/Button`
- Import animation helpers from `react-native-reanimated`

- [ ] **Step 2: Verify screen renders**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No TypeScript errors.

- [ ] **Step 3: Manual test**

Reset onboarding state and launch the app to verify:
1. App opens to onboarding welcome screen (not map)
2. 3 slides are swipeable
3. Dot indicators animate smoothly
4. Last slide shows Kayıt Ol + Giriş Yap buttons
5. Tapping Kayıt Ol opens registration modal
6. After registering, app navigates to school step (will be empty screen for now)

- [ ] **Step 4: Commit**

```bash
git add src/app/(onboarding)/welcome.tsx
git commit -m "feat(onboarding): add welcome screen with 3 swipeable intro slides"
```

---

## Chunk 3: School Picker Screen

### Task 8: Build School Picker Screen

**Files:**
- Create: `src/app/(onboarding)/school.tsx`

- [ ] **Step 1: Create the school picker screen**

Create `src/app/(onboarding)/school.tsx` with:

- `SafeAreaView` wrapper with `colors.background`
- Header section:
  - Title: "Okulun Hangisi?" using `FontFamily.heading`, `FontSize.xxl`
  - Subtitle: "Sana yakın mekanları bulalım" using `FontFamily.body`, `colors.textSecondary`
- Search `Input` component with `icon="search-outline"`, `placeholder="Okul ara..."`
- `useState` for `searchQuery` and `selectedSchool` (index or null)
- Filter logic: `ISTANBUL_SCHOOLS.filter(s => s.name.toLocaleLowerCase('tr-TR').includes(query.toLocaleLowerCase('tr-TR')))`
- `FlatList` of filtered schools (`keyboardShouldPersistTaps="handled"` so tapping a row dismisses keyboard):
  - Each row is a `TouchableOpacity` with:
    - `Ionicons` graduation cap icon (`school-outline`, size 20)
    - School name text (`FontFamily.bodySemiBold`, `colors.text`)
    - District label (`FontFamily.body`, `colors.textSecondary`, `FontSize.sm`)
    - If selected: `primarySoft` background, primary text color, checkmark icon on right
  - `haptic.light()` on selection
  - Row height ~56px with padding from `Spacing.md`
- Bottom section (pinned with `position: 'absolute'` or outside FlatList):
  - `Button` component (primary variant), title "Devam", disabled if no school selected
  - On press:
    1. Save school to user profile via `authStore.updateProfile({ university: school.name, school_lat: school.lat, school_lng: school.lng })`
    2. Navigate to `/(onboarding)/preferences` with `router.replace()`
  - "Atla" skip link (`TouchableOpacity`): navigates to `/(onboarding)/preferences` without saving
  - `haptic.success()` on submit

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Manual test**

1. Complete auth from welcome screen
2. School screen appears with search bar and school list
3. Search filters schools (try "İTÜ", "Galatasaray")
4. Tapping a school highlights it red
5. "Devam" button enables when a school is selected
6. Tapping "Devam" navigates to preferences screen (empty for now)
7. "Atla" link also works

- [ ] **Step 4: Commit**

```bash
git add src/app/(onboarding)/school.tsx
git commit -m "feat(onboarding): add school picker screen with search and selection"
```

---

## Chunk 4: Food Preferences Screen

### Task 9: Build Food Preferences Screen

**Files:**
- Create: `src/app/(onboarding)/preferences.tsx`

- [ ] **Step 1: Create the food preferences screen**

Create `src/app/(onboarding)/preferences.tsx` with:

- `SafeAreaView` wrapper with `colors.background`
- Header section:
  - Title: "Ne Yemeyi Seversin?" using `FontFamily.heading`, `FontSize.xxl`
  - Subtitle: "En az 3 seç" using `FontFamily.body`, `colors.textSecondary`
- `useState` for `selectedTags: string[]` and `loading: boolean`
- Tag grid using `View` with `flexWrap: 'wrap'`, `flexDirection: 'row'`, `gap: Spacing.sm`:
  - Map over `VENUE_TAGS` from constants
  - Each tag is a `TouchableOpacity` chip:
    - Emoji mapping: `ev-yemegi` → 🏠, `fast-food` → 🍔, `kahvalti` → 🍳, `cay` → ☕, `doner` → 🔥, `tost` → 🍕, `vejetaryen` → 🌿, `wifi` → 📶, `ogrenci-menu` → 🎓, `tatli` → 🍰, `kofte` → 🍖, `pide` → 🫓
    - Text label from `VENUE_TAGS[i].label`
    - Selected state: `primarySoft` background + primary border (1.5px) + primary text
    - Unselected: `colors.backgroundSecondary` background + transparent border + `colors.text`
    - `haptic.light()` on toggle
    - Toggle logic: if selected, remove from array; if not, add to array
  - Padding: `Spacing.md` horizontal, `Spacing.sm` vertical per chip
  - `BorderRadius.full` for pill shape
- Counter text below grid: `"${selectedTags.length} seçildi"` with `colors.textSecondary`, wrap in `Animated.Text` with `FadeIn` layout animation for smooth number transitions
- Bottom section:
  - `Button` component (primary variant), title "Keşfetmeye Başla" — **always enabled** (no minimum tag selection enforced, "en az 3" is just a hint)
  - `loading` state passed to Button's `loading` prop
  - On press:
    1. Set `loading = true`
    2. Call `authStore.updateProfile({ food_preferences: selectedTags })`
    3. If error, show `Alert.alert('Hata', ...)` but continue anyway
    4. Call `setOnboardingCompleted()` from `src/lib/onboarding.ts`
    5. Call `haptic.success()`
    6. `router.replace('/(tabs)/map')`
  - "Atla" skip link: calls `setOnboardingCompleted()` then navigates to map
    - Also fires `haptic.light()` on skip

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Manual test (full flow)**

1. Fresh install / reset AsyncStorage
2. App opens to welcome slides
3. Swipe through 3 slides → tap "Kayıt Ol"
4. Register new account
5. School picker appears → search and select a school → tap "Devam"
6. Food preferences appear → select 3+ tags → tap "Keşfetmeye Başla"
7. Map screen appears, centered on the selected school's area
8. Kill and reopen app → should go directly to map (skip onboarding)

- [ ] **Step 4: Commit**

```bash
git add src/app/(onboarding)/preferences.tsx
git commit -m "feat(onboarding): add food preferences screen with tag multi-select"
```

---

## Chunk 5: Map Centering Integration

### Task 10: Center Map on User's School

**Files:**
- Modify: `src/app/(tabs)/map.tsx:161` (initial region logic)

- [ ] **Step 1: Update map initial region**

In `src/app/(tabs)/map.tsx`, add this import near the top:

```ts
import { useAuthStore } from '../../stores/authStore';
```

Then find the line where `region` state is initialized (line 161):

```ts
const [region, setRegion] = useState<Region>(DEFAULT_REGION);
```

Replace it with:

```ts
const authUser = useAuthStore((s) => s.user);
const initialRegion = useMemo(() => {
  if (authUser?.school_lat && authUser?.school_lng) {
    return {
      latitude: authUser.school_lat,
      longitude: authUser.school_lng,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };
  }
  return DEFAULT_REGION;
}, [authUser?.school_lat, authUser?.school_lng]);
const [region, setRegion] = useState<Region>(initialRegion);
```

Also update the `initialRegion` prop on the `MapView` component (line 383):

Change `initialRegion={DEFAULT_REGION}` to `initialRegion={initialRegion}`.

Note: `useAuthStore` may already be imported in map.tsx — check first and only add the import if missing. Similarly, `useMemo` should already be imported.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 3: Manual test**

1. Complete onboarding with a school selection (e.g., İTÜ in Sarıyer)
2. Map should open centered on the İTÜ area, not generic Istanbul center
3. Zoom level should be tighter (0.02 delta vs 0.05)

- [ ] **Step 4: Commit**

```bash
git add src/app/(tabs)/map.tsx
git commit -m "feat(map): center on user's school location after onboarding"
```

---

### Task 11: Final Integration Verification

- [ ] **Step 1: Full end-to-end test**

Test the complete flow:
1. Reset onboarding: In settings or via `resetOnboarding()` call
2. App → welcome slides → register → school picker → food preferences → map
3. Verify map centers on selected school
4. Relaunch app → should skip to map
5. Log out → log back in → should skip to map (onboarding flag persists)
6. Test "Atla" (skip) on school step → should go to preferences
7. Test "Atla" (skip) on preferences step → should go to map
8. Test login flow (existing user) → should route correctly based on onboarding flag

- [ ] **Step 2: Test dark mode**

1. Switch device to dark mode
2. Run through onboarding — all screens should use dark colors
3. No white flashes or hardcoded colors

- [ ] **Step 3: Commit any final fixes**

```bash
git add -A
git commit -m "feat(onboarding): complete onboarding flow integration"
```
