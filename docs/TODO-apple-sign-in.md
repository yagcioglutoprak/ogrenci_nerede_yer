# Apple Sign In Setup (Requires Apple Developer Membership)

Once you have an Apple Developer Program membership ($99/year), complete these steps:

## 1. Enable Sign In with Apple for your App ID

1. Go to https://developer.apple.com/account/resources/identifiers/list
2. Find or create identifier with Bundle ID: `com.ogrencinerdeyer.app`
3. Check **"Sign in with Apple"** under Capabilities
4. Click Save

## 2. (Optional) Create a Service ID for web OAuth flow

Only needed if you want Apple Sign In on web too (not just native iOS):

1. Go to Identifiers > click "+" > select "Services IDs"
2. Description: `Ogrenci Nerede Yer Web`
3. Identifier: `com.ogrencinerdeyer.web`
4. Enable "Sign in with Apple" > Configure
5. Add domain: `fcuwuokxtptshksjvles.supabase.co`
6. Add return URL: `https://fcuwuokxtptshksjvles.supabase.co/auth/v1/callback`

## 3. (Optional) Generate a Key for the Secret

Only needed for web OAuth flow:

1. Go to Keys > click "+"
2. Name: `Ogrenci Nerede Yer Auth Key`
3. Check "Sign in with Apple" > Configure > select your primary App ID
4. Download the `.p8` key file (you can only download it once!)
5. Note the **Key ID** shown
6. Your **Team ID** is in the top-right of the developer portal

## 4. Update Supabase (if you did steps 2-3)

1. Go to Supabase Dashboard > Auth > Providers > Apple
2. Add the Secret Key (generated JWT from the .p8 key)

## Current Status

- [x] Supabase Apple provider: **Enabled** with Client ID `com.ogrencinerdeyer.app`
- [x] `app.json`: `usesAppleSignIn: true` configured
- [x] `expo-apple-authentication` package installed
- [x] Code: `signInWithApple()` implemented in authStore
- [ ] Apple Developer: Enable "Sign in with Apple" capability for App ID
- [ ] Xcode: Capability will be auto-added by `expo-apple-authentication` plugin during prebuild

## Note

The native iOS `signInWithIdToken` flow does NOT require the Service ID or .p8 key. It only requires:
1. An Apple Developer account with "Sign in with Apple" enabled on the App ID
2. The Supabase Apple provider enabled with the bundle ID as Client ID (already done)

So **step 1 alone is sufficient** for the native mobile flow to work.
