# Social Login (Apple + Google) Design Spec

## Overview

Add native social login as the primary authentication method. Apple Sign In shown on iOS only, Google Sign In on both platforms. Email/password auth remains as a secondary option below a divider.

## Approach

**Native SDKs + Supabase `signInWithIdToken`**

- `expo-apple-authentication` for Apple Sign In (native iOS sheet)
- `@react-native-google-signin/google-signin` for Google Sign In (native account picker on both platforms)
- ID tokens passed to Supabase `signInWithIdToken` — no browser redirect

## Packages

| Package | Purpose |
|---------|---------|
| `expo-apple-authentication` | Native Apple Sign In on iOS |
| `@react-native-google-signin/google-signin` | Native Google Sign In on iOS + Android |
| `expo-crypto` | SHA-256 hashing for Apple Sign In nonce |

## Screen Layout (Login + Register)

Both screens are **restructured** — the current layout (email form on top, divider, footer) is inverted so that social login becomes primary:

1. **Brand section** — logo + title (unchanged)
2. **Social buttons** (primary, prominent)
   - "Apple ile Devam Et" — iOS only, black bg in light mode / white bg in dark mode (Apple HIG)
   - "Google ile Devam Et" — both platforms, white bg with Google "G" icon, bordered
3. **"veya" divider** (moved from bottom to middle)
4. **Email/password form** (secondary, below divider)
5. **Footer link** — login/register toggle (unchanged)

### Platform Behavior

- **iOS**: Shows Apple button + Google button
- **Android**: Shows Google button only
- Apple button conditionally rendered based on `AppleAuthentication.isAvailableAsync()` (not just `Platform.OS`), since Apple Sign In requires iOS 13+ and may not be available in all regions

## Auth Store Changes (`authStore.ts`)

### New Interface Methods

```typescript
signInWithApple: () => Promise<{ error: string | null }>;
signInWithGoogle: () => Promise<{ error: string | null }>;
```

### Google Sign In Configuration

`GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID })` must be called before any sign-in attempt. This should be called in the module scope of `authStore.ts` (or in `initialize()`). The `webClientId` is the **Web** client ID from Google Cloud Console (not the iOS or Android client ID) — stored in constants or env.

### `signInWithApple()`

1. Set `loading: true, error: null`
2. Generate a random string (raw nonce)
3. SHA-256 hash it using `expo-crypto` → `hashedNonce`
4. Call `AppleAuthentication.signInAsync({ requestedScopes: [FULL_NAME, EMAIL], nonce: hashedNonce })`
5. Capture `fullName` from the credential response directly (Apple only provides name on first authorization — it's `null` on subsequent sign-ins)
6. Extract `identityToken` from credential
7. Call `supabase.auth.signInWithIdToken({ provider: 'apple', token: identityToken, options: { nonce: rawNonce } })`
8. If this is a first-time Apple user, pass the captured `fullName` to profile creation (since `user_metadata` may not have it)
9. Set `loading: false` (also in catch/error paths via `finally` to prevent stuck loading state)
10. Return `{ error: null }` on success

**Apple name threading**: The captured `fullName` from step 5 is stored in a module-level variable (e.g., `let pendingAppleName: string | null = null`) before the Supabase call. The `onAuthStateChange` handler checks this variable when creating a profile for an Apple user, then clears it after use.

### `signInWithGoogle()`

1. Set `loading: true, error: null`
2. Ensure `GoogleSignin` is configured (call `configure()` if not already done)
3. Call `GoogleSignin.signIn()`
4. Extract `idToken` from response
5. Call `supabase.auth.signInWithIdToken({ provider: 'google', token: idToken })`
6. Set `loading: false` (also in catch/error paths via `finally`)
7. Return `{ error: null }` on success

**Note**: On Android, call `GoogleSignin.hasPlayServices()` before `signIn()` to ensure Google Play Services are available. Consider calling `GoogleSignin.signOut()` before `signIn()` if the user needs to switch accounts.

## Profile Auto-Creation

When `onAuthStateChange` fires and no `users` row exists for the authenticated user:

1. Query `users` table for `session.user.id`
2. If no row found, **upsert** with `onConflict: 'id'` (to avoid race conditions with concurrent calls):
   - `id`: `session.user.id`
   - `email`: `session.user.email`
   - `username`: derived from name or email prefix, with collision handling (try `prefix`, then `prefix_XXXX` with random 4-digit suffix, retry on unique constraint violation)
   - `full_name`: from `user_metadata.full_name` or `user_metadata.name` (or the captured Apple `fullName` passed through)
   - `avatar_url`: from `user_metadata.avatar_url` (Google provides this)
   - `xp_points`: 0
3. Set profile in store

**Note**: The existing `signUpWithEmail` creates profiles synchronously within the method. The `onAuthStateChange` auto-creation uses `upsert` specifically to avoid conflicts with any other code path that may have already created the profile.

### Username Collision Handling

The `users` table has a `UNIQUE` constraint on `username`. To handle collisions:
1. Try `email_prefix` (e.g., `ali` from `ali@gmail.com`)
2. On conflict, try `email_prefix_XXXX` (random 4-digit suffix)
3. Retry up to 3 times with different suffixes

## app.json Changes

```json
{
  "ios": {
    "usesAppleSignIn": true
  },
  "plugins": [
    "expo-apple-authentication",
    [
      "@react-native-google-signin/google-signin",
      { "iosUrlScheme": "<REVERSED_CLIENT_ID from Google Cloud Console>" }
    ]
  ]
}
```

The `iosUrlScheme` is the reversed client ID from the Google Cloud Console iOS OAuth credential (format: `com.googleusercontent.apps.XXXX`).

## Supabase Dashboard Configuration (Manual)

User must configure in Supabase Dashboard:

1. **Apple Provider**: Enable + add Service ID, Team ID, Key ID, and private key
2. **Google Provider**: Enable + add Google Cloud OAuth Web Client ID and Client Secret

## Post-Auth Flow (Navigation)

Social login methods return `{ error: null }` on success. The **calling component** (in `login.tsx` / `register.tsx`) handles navigation — exactly like the existing email login pattern:

```typescript
const result = await signInWithApple(); // or signInWithGoogle()
if (!result.error) {
  haptic.success();
  const onboardingDone = await hasCompletedOnboarding();
  router.replace(onboardingDone ? '/(tabs)/map' : '/(onboarding)/school');
}
```

Navigation is NOT in `onAuthStateChange` or in the store — it stays at the call site, consistent with the existing pattern.

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/stores/authStore.ts` | Add `signInWithApple`, `signInWithGoogle`, Google configure call, update `onAuthStateChange` for auto-profile with upsert |
| `src/app/auth/login.tsx` | Restructure: social buttons on top, email form below divider |
| `src/app/auth/register.tsx` | Restructure: social buttons on top, email form below divider |
| `src/components/auth/SocialLoginButtons.tsx` | New shared component for Apple + Google buttons with availability check |
| `app.json` | Add plugins, `usesAppleSignIn` |
| `package.json` | New dependencies (expo-apple-authentication, @react-native-google-signin/google-signin, expo-crypto) |

## Error Handling

- Apple sign-in cancellation (`ERR_REQUEST_CANCELED`) — silently ignore, don't show error
- Google sign-in cancellation (`SIGN_IN_CANCELLED`) — silently ignore
- Network errors — show Turkish error message: "Baglanti hatasi. Lutfen tekrar deneyin."
- Supabase token exchange failure — show: "Giris yapilirken hata olustu"
- Username collision exhaustion (3 retries failed) — show: "Hesap olusturulamadi. Lutfen tekrar deneyin."

## Testing Considerations

- Apple Sign In only testable on physical iOS device (requires iOS 13+)
- Google Sign In requires a development build (`expo-dev-client`), not Expo Go
- Both require Supabase providers to be configured in dashboard
- Test first-time Apple sign-in name capture separately from subsequent sign-ins
