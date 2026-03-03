# Ogrenci Nerede Yer? - Project Guide

## Overview

A React Native mobile app for Turkish university students to discover affordable restaurants, share food photos, and rate dining spots. The app is centered around Istanbul, with a social feed + interactive map experience.

**Language**: All UI text and user-facing strings are in **Turkish**. Code comments mix Turkish and English. All code identifiers, type names, and variable names are in English.

## Tech Stack

- **Framework**: React Native 0.83.2 + Expo SDK 55 + Expo Router (file-based routing)
- **State**: Zustand v5 (3 stores: `authStore`, `venueStore`, `feedStore`)
- **Backend**: Supabase (PostgreSQL, Auth, RLS, Storage)
- **Maps**: `react-native-maps` (Apple Maps on iOS, Google Maps on Android)
- **Language**: TypeScript (strict mode, path aliases `@/*` not yet configured in tsconfig)
- **Entry point**: `expo-router/entry` (set in `package.json` main field)

## Project Structure

```
src/
  app/                    # Expo Router file-based routes
    _layout.tsx           # Root Stack navigator + auth init + splash screen
    index.tsx             # Redirect to /(tabs)/map
    (tabs)/
      _layout.tsx         # Bottom tab bar (Harita, Kesfet, Ekle, Profil)
      map.tsx             # Interactive map with venue pins + filters
      feed.tsx            # Social feed with posts + category chips
      add.tsx             # Add venue / create post (segmented)
      profile.tsx         # User profile + stats + favorites
    venue/[id].tsx        # Venue detail (hero image, ratings, reviews)
    auth/
      login.tsx           # Email/password login
      register.tsx        # Registration form
  components/
    ui/                   # Reusable primitives (Button, Input, StarRating, Badge, Avatar)
    venue/VenueCard.tsx   # Venue list card
    feed/PostCard.tsx     # Feed post card with image carousel
  stores/
    authStore.ts          # Auth state + Supabase auth methods
    venueStore.ts         # Venues, reviews, filters, favorites
    feedStore.ts          # Posts, comments, likes
  lib/
    constants.ts          # Design tokens (Colors, Spacing, BorderRadius, FontSize) + config
    supabase.ts           # Supabase client init with AsyncStorage
    mockData.ts           # Rich mock data (20 venues, 15 posts, 10 users, etc.)
    utils.ts              # getRelativeTime, calculateDistance, formatRating
  hooks/
    useLocation.ts        # expo-location wrapper
    useImagePicker.ts     # expo-image-picker wrapper
  types/
    index.ts              # All TypeScript interfaces
supabase/
  migrations/
    001_initial_schema.sql  # 11 tables, indexes, RLS policies, seed badges
```

## Database Schema (Supabase)

11 tables with full RLS:
- **users** - profiles linked to auth.users (UUID PK)
- **venues** - restaurants with lat/lng, 3-axis ratings, tags[], level (1-4)
- **reviews** - per-venue, unique per user, 3 rating axes (taste, value, friendliness)
- **posts** - social feed posts, optionally linked to a venue
- **post_images** - ordered images for posts
- **likes** - composite PK (user_id, post_id)
- **comments** - on posts
- **favorites** - composite PK (user_id, venue_id)
- **follows** - composite PK (follower_id, following_id)
- **badges** - gamification definitions (7 seeded)
- **user_badges** - earned badges

Supabase project ref: `fcuwuokxtptshksjvles`. Credentials are in `.env`.

## Design System

**Palette**: White background + Red (#E23744) primary + Orange (#FF6B35) accent. Food-themed, modern, and polished.

All design tokens live in `src/lib/constants.ts`:
- `Colors` - primary, accent, gradients, neutrals, semantic colors
- `Spacing` - xs(4) through xxxl(32)
- `BorderRadius` - sm(8) through full(9999)
- `FontSize` - xs(11) through display(40)
- `PriceRanges` - 4 tiers (TL currency)
- `VenueLevels` - Yeni(1) -> Popular(2) -> Ogrenci Onayli(3) -> Efsane(4)
- `VENUE_TAGS` - 12 food category tags

## Key Patterns

### Mock Data Fallback
All stores try Supabase first. If Supabase returns empty or errors, they fall back to `MOCK_*` arrays from `mockData.ts`. This makes the app fully functional without a live database.

### Rating System
Venues use a 3-axis rating: Lezzet (Taste), Fiyat/Performans (Value), Ogrenci Dostu (Friendliness). Each 1-5 stars. `overall_rating` is the average of all three.

### Venue Levels
Based on `total_reviews`: Yeni(0+) -> Popular(5+) -> Ogrenci Onayli(15+) -> Efsane(50+). Level is recalculated in `venueStore.addReview()`.

### Auth Guard
Screens that need auth (add venue, create post, profile actions) check `useAuthStore.user` and redirect to login if null.

## Running the App

```bash
# Install deps (use --legacy-peer-deps for React 19 compat)
npm install --legacy-peer-deps

# Start Expo (use port 8090 if 8081 is busy)
npx expo start --port 8090

# iOS simulator
npx expo start --ios

# Push database migrations
npx supabase link --project-ref fcuwuokxtptshksjvles
npx supabase db push
```

## Known Issues / TODO

- Google Maps API key placeholder in `app.json` needs a real key for Android
- `@/*` path aliases defined in tsconfig but not in metro/babel config
- Gamification (XP, badges, streaks) has schema + types but no UI implementation yet
- Image upload uses URLs only (no Supabase Storage integration yet)
- No push notifications
- No search-by-text for venues (only map + filter)
- `post/[id]` and `user/[id]` routes referenced in types but not created as screens

## Conventions

- Use `Colors.*`, `Spacing.*`, `BorderRadius.*`, `FontSize.*` from constants - never hardcode design values
- Zustand stores are the single source of truth - no prop drilling for global state
- All Supabase queries include joined relations via `.select('*, user:users(*)')` pattern
- Mock data IDs use descriptive prefixes: `u-` for users, `v-` for venues, `p-` for posts, `r-` for reviews
- Turkish text in UI, English in code
