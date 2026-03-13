# Onboarding Flow Design Spec

## Overview

A first-time user onboarding flow for Öğrenci Nerede Yer? that introduces the app's core value, collects school and food preferences, and delivers a personalized first experience on the map screen.

## User Flow

```
App Launch
  → Check AsyncStorage "onboarding_completed"
    → YES → /(tabs)/map (existing behavior)
    → NO → /(onboarding)/welcome
        → 3 swipeable intro slides (phone mockup style)
        → Last slide: "Kayıt Ol" + "Giriş Yap" buttons
        → Taps either → existing auth modal opens
        → Auth completes → /(onboarding)/school
            → Search + select school
            → "Devam" → /(onboarding)/preferences
                → Multi-select food tags from VENUE_TAGS
                → "Keşfetmeye Başla" → save to Supabase + set AsyncStorage flag
                → Navigate to /(tabs)/map (centered on school area)
```

- Every step after auth has a visible "Atla" (skip) link
- Existing users who log in: skip straight to `/(tabs)/map` (they already have the flag)
- Returning users who re-install: AsyncStorage is empty, so `index.tsx` checks both AsyncStorage AND `user.university` after auth initializes — if the user already has school data in their profile, set the flag and skip onboarding
- **Auth navigation override:** Both `auth/login.tsx` and `auth/register.tsx` currently call `router.replace('/(tabs)/map')` on success. These must be modified to check AsyncStorage `@onboarding_completed` first — if not completed, navigate to `/(onboarding)/school` instead of `/(tabs)/map`

## File Structure

### New Files

```
src/app/(onboarding)/
  _layout.tsx                # Stack layout, no header, shared white background
  welcome.tsx                # 3 intro slides with horizontal FlatList paging
  school.tsx                 # School search + select (single select)
  preferences.tsx            # Food tag multi-select grid

src/lib/onboarding.ts        # AsyncStorage helpers:
                              #   hasCompletedOnboarding()
                              #   setOnboardingCompleted()
                              #   resetOnboarding()
```

### Modified Files

- `src/app/index.tsx` — add async onboarding check before redirect
- `src/app/_layout.tsx` — register `(onboarding)` route group in Stack
- `src/app/auth/login.tsx` — change post-auth navigation to check onboarding flag
- `src/app/auth/register.tsx` — change post-auth navigation to check onboarding flag
- `src/types/index.ts` — add `school_lat`, `school_lng`, `food_preferences` fields to `User` interface
- New migration: `supabase/migrations/014_onboarding_fields.sql`

**Note:** `authStore.ts` already has an `updateProfile(updates: Partial<User>)` method — no changes needed there.

## Database Changes

```sql
-- Reuse existing `university` column for school name (already TEXT, already in User interface)
-- Only add the new columns:
ALTER TABLE users ADD COLUMN school_lat DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN school_lng DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN food_preferences TEXT[] DEFAULT '{}';
```

**Note:** The `university` column already exists on the `users` table. We reuse it for school name (works for universities, high schools, vocational schools). No need for a separate `school_name` column.

No RLS changes needed — users already have UPDATE on their own row.

## Screen Details

### Welcome Screen (`welcome.tsx`)

- Horizontal `FlatList` with `pagingEnabled`, `snapToInterval`, `decelerationRate="fast"`
- 3 slides, each containing:
  - Phone mockup frame (white rounded rect, border, shadow) showing simplified feature preview
  - Title + subtitle below the mockup
- Slide content:
  1. Map with venue pins → "Haritada Keşfet" / "Okuluna yakın öğrenci dostu mekanları bul"
  2. Venue card with ratings → "Paylaş & Puanla" / "Deneyimlerini paylaş, diğer öğrencilere yol göster"
  3. Buddy match cards → "Birlikte Ye" / "Yemek arkadaşı bul, buluşmalara katıl"
- Dot indicators: active = primary red elongated pill (24x8), inactive = gray circle (8x8)
- Last slide adds two buttons:
  - "Kayıt Ol" — gradient button (primary) → opens `/auth/register` modal
  - "Giriş Yap" — text link → opens `/auth/login` modal
- After auth completes, navigate to `/(onboarding)/school`
- Animations: `react-native-reanimated` spring animations for slide transitions, `FadeInDown` for button entrance on last slide
- Background: `colors.background` via `useThemeColors()` (white in light mode, dark in dark mode)

### School Screen (`school.tsx`)

- Header: "Okulun Hangisi?" title + "Sana yakın mekanları bulalım" subtitle
- Search input at top using existing `Input` component with `search-outline` icon
- Scrollable list of Istanbul schools filtered by search query (case-insensitive, Turkish char aware)
- Each row: graduation cap icon + school name + district in lighter text
- Single select: tapping a row selects it (red background tint + checkmark), deselects previous
- School data: hardcoded array in `src/lib/constants.ts` (`ISTANBUL_SCHOOLS`), each entry:
  ```ts
  { name: string; district: string; lat: number; lng: number }
  ```
  - Includes universities, high schools, vocational schools
  - Districts use values matching the existing `ISTANBUL_SEMTLER` constant
  - Can be expanded later (or fetched from API)
- Bottom: "Devam" gradient button (disabled until a school is selected) + "Atla" skip text link
- Haptic feedback on selection

### Preferences Screen (`preferences.tsx`)

- Header: "Ne Yemeyi Seversin?" title + "En az 3 seç" subtitle
- Grid of all 12 `VENUE_TAGS` as tappable chips
- Each chip: emoji icon (from VENUE_TAGS icon mapping) + label text
- Multi-select: selected chips get `primarySoft` background + primary border, unselected get `backgroundSecondary` + standard border
- Counter text: "X seçildi" with animated number transition
- Bottom: "Keşfetmeye Başla" gradient button + "Atla" skip text link
- Button is always enabled (no hard minimum, "en az 3" is a suggestion)
- Haptic feedback on each tag toggle (`haptic.light()`)
- On submit:
  1. Save `food_preferences` array to Supabase `users` table via `authStore.updateProfile()`
  2. Set AsyncStorage `onboarding_completed = true`
  3. Navigate to `/(tabs)/map` with `router.replace()`

## Technical Details

### AsyncStorage Key

- `@onboarding_completed` — boolean flag, checked on app launch in `index.tsx`

### Onboarding Check (`index.tsx`)

```tsx
export default function Index() {
  const [checking, setChecking] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
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
  }, []);

  if (checking) return null; // Root layout splash is still showing

  if (needsOnboarding) return <Redirect href="/(onboarding)/welcome" />;
  return <Redirect href="/(tabs)/map" />;
}
```

### Auth Navigation Override

Both auth screens (`login.tsx` line 54, `register.tsx` line 78) currently call `router.replace('/(tabs)/map')` on success. These must be updated:

```tsx
// In both login.tsx and register.tsx, after successful auth:
const onboardingDone = await hasCompletedOnboarding();
if (onboardingDone) {
  router.replace('/(tabs)/map');
} else {
  router.replace('/(onboarding)/school');
}
```

### Profile Update

Uses the existing `authStore.updateProfile(updates: Partial<User>)` method — no new method needed. Returns `{ error: string | null }`.

### Error Handling

- If the Supabase profile update fails on the preferences screen, show an error toast but still set the AsyncStorage flag and navigate to the map. The user can update preferences later from settings.
- Submit button shows a loading spinner while the network call is in progress to prevent double-taps.

### Map Centering

When the map screen loads, if `user.school_lat` and `user.school_lng` exist, use them as the initial region instead of `DEFAULT_REGION` (Istanbul center). This gives users an immediate "this app knows my area" experience.

## Design System Usage

- Colors: `Colors.*`, `useThemeColors()` — dark mode supported on all screens
- Typography: `FontFamily.heading` for titles, `FontFamily.body` for body, `FontFamily.bodySemiBold` for buttons
- Spacing: `Spacing.*` for all margins/padding
- Border radius: `BorderRadius.*` for all rounded elements
- Animations: `react-native-reanimated` with `SpringConfig.snappy` for interactions, `FadeInDown` for entrance
- Haptics: `haptic.light()` for selections, `haptic.success()` on completion
- Button: gradient from `Colors.gradientStart` → `Colors.gradientEnd` for primary CTAs

## Constraints

- No new npm dependencies — uses existing FlatList, Reanimated, Ionicons, AsyncStorage
- School list is hardcoded in constants (not a separate API call)
- No profile photo or bio collection — existing profile completion banner handles that
- All UI text in Turkish, code identifiers in English
