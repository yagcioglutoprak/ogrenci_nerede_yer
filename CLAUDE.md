# Ogrenci Nerede Yer? - Project Guide

## Overview

A React Native social platform for Turkish university students to discover affordable restaurants, share food experiences, match with meal buddies, and build curated dining lists. Centered around Istanbul with an interactive map + social feed experience.

**Language**: All UI text in **Turkish**. Code identifiers, types, variables in **English**. Comments mixed.

## Tech Stack

- **Framework**: React Native 0.83.2 + Expo SDK 55 + Expo Router (file-based routing)
- **State**: Zustand v5 (8 stores: `authStore`, `venueStore`, `feedStore`, `buddyStore`, `messageStore`, `eventStore`, `listStore`, `themeStore`)
- **Backend**: Supabase (PostgreSQL, Auth, RLS, Storage, Realtime subscriptions)
- **Maps**: `react-native-maps` (Apple Maps on iOS, Google Maps on Android)
- **Animations**: `react-native-reanimated` v4 + `react-native-gesture-handler`
- **UI**: `@gorhom/bottom-sheet`, `expo-blur` (glass morphism), `expo-haptics`, `expo-image`
- **Fonts**: Nunito via `@expo-google-fonts/nunito`
- **Language**: TypeScript strict mode
- **Entry point**: `expo-router/entry` (set in `package.json` main field)

## Project Structure

```
src/
  app/                        # Expo Router file-based routes
    _layout.tsx               # Root Stack navigator + auth init + splash
    index.tsx                 # Redirect to /(tabs)/map
    (tabs)/
      _layout.tsx             # Bottom tab bar (Harita, Kesfet, Ekle, Mesajlar, Profil)
      map.tsx                 # Interactive map with venue pins + bottom sheet
      feed.tsx                # Social feed with stories bar + category chips
      add.tsx                 # Add venue / create post (segmented forms)
      messages.tsx            # DM conversation list with unread badges
      profile.tsx             # User profile + stats + favorites + lists
      discover.tsx            # Discovery screen (hidden tab, href: null)
    venue/[id].tsx            # Venue detail (hero image, ratings, reviews, community posts)
    post/[id].tsx             # Post detail with comments
    event/[id].tsx            # Event detail with attendees + group chat
    list/[id].tsx             # Curated venue list detail
    list/create.tsx           # Create new list
    user/[id].tsx             # Other user's profile
    chat/[id].tsx             # DM conversation thread
    chat/new.tsx              # New conversation (user search)
    buddy.tsx                 # Tinder-style meal buddy matching
    reels.tsx                 # Video feed (moments)
    settings.tsx              # App settings
    profile/edit.tsx          # Edit user profile
    auth/
      login.tsx               # Email/password login
      register.tsx            # Registration form
  components/
    ui/                       # Primitives: Button, Input, StarRating, Badge, Avatar, BadgeCard,
                              #   CircleRating, RatingBar, CirclePicker, ScreenHeader, EmptyState,
                              #   ErrorState, Skeleton, GlassView
    venue/
      VenueCard.tsx           # Venue list card
      VenueBottomSheet.tsx    # Apple Maps-style venue bottom sheet on map
    feed/
      PostCard.tsx            # Post card with image carousel
      EventCard.tsx           # Meetup event preview card
      QuestionCard.tsx        # Question post with answers
      MomentCard.tsx          # Ephemeral moment with countdown
      StoriesBar.tsx          # Instagram-style story avatars
    forms/
      VenueForm.tsx           # Add/edit venue
      PostForm.tsx            # Create post (4 types)
      EventForm.tsx           # Create meetup event
      QuestionForm.tsx        # Ask recommendation question
      MomentCapture.tsx       # Photo capture + expiration
      ImageGrid.tsx           # Multi-image selector
      TagSelector.tsx         # Venue tag multi-select
      LocationPicker.tsx      # Map-based location selection
    chat/
      MessageBubble.tsx       # Text message bubble
      ImageBubble.tsx         # Image message preview
      VenueBubble.tsx         # Rich venue card in chat
      AttachmentSheet.tsx     # Attach image/venue bottom sheet
      VenuePickerModal.tsx    # Venue search for sharing
    buddy/
      SwipeDeck.tsx           # Tinder-style swipeable card deck
    share/
      ShareCard.tsx           # Social sharing UI
  stores/
    authStore.ts              # Auth state + Supabase auth + dev auto-login
    venueStore.ts             # Venues, reviews, filters, favorites, search
    feedStore.ts              # Posts (4 types), comments, likes, bookmarks, Q&A answers
    buddyStore.ts             # Meal buddy matching, realtime messages, ratings
    messageStore.ts           # DM conversations, messages (text/image/venue), realtime
    eventStore.ts             # Events, attendees, waitlist, group chat, realtime
    listStore.ts              # Curated lists, like/follow, CRUD
    themeStore.ts             # Light/dark/auto mode with AsyncStorage persistence
  lib/
    constants.ts              # Design tokens + DarkColors + FontFamily + animation configs
    supabase.ts               # Supabase client init with AsyncStorage
    mockData.ts               # Rich mock data (20 venues, 15 posts, 10 users, 5 events, etc.)
    utils.ts                  # getRelativeTime, calculateDistance, formatRating
    badgeChecker.ts           # Auto-award badges based on user stats (11 condition types)
    imageUpload.ts            # Image upload to Supabase Storage
    shareUtils.ts             # Share post/list via social or clipboard
    notifications.ts          # Push notification registration + Expo push API
    haptics.ts                # Haptic feedback helpers (light/medium/heavy/success/error)
  hooks/
    useLocation.ts            # expo-location wrapper
    useImagePicker.ts         # expo-image-picker wrapper
    useDebounce.ts            # Debounce hook for search
    useThemeColors.ts         # Theme-aware color palette (light/dark/auto)
    useNotifications.ts       # Notification registration + deep-link routing
  types/
    index.ts                  # All TypeScript interfaces
supabase/
  migrations/
    001_initial_schema.sql    # Core tables, indexes, RLS, seed badges
    002_posts_with_counts_view.sql
    003_social_features.sql   # Events, lists, buddy matching
    004_quick_wins.sql
    005_push_notifications.sql
    006_taste_lists.sql
    007_buddy_matching.sql
    008_direct_messages.sql
    009_message_types.sql
docs/
  plans/                      # Design specs and implementation plans
```

## Database Schema (Supabase)

20+ tables across 9 migrations with full RLS:
- **users** - profiles linked to auth.users (UUID PK), xp_points
- **venues** - restaurants with lat/lng, 3-axis ratings, tags[], level (1-4)
- **reviews** - per-venue unique per user, 3 rating axes (taste, value, friendliness)
- **posts** - 4 types: discovery, meetup, question, moment (with expires_at)
- **post_images** - ordered images for posts
- **likes** / **comments** / **favorites** / **follows** - social graph
- **badges** / **user_badges** - gamification (11 condition types, 7+ seeded)
- **events** / **event_attendees** / **event_messages** - meetups with group chat
- **lists** / **list_venues** - curated venue collections
- **meal_buddies** / **buddy_matches** / **buddy_messages** - meal buddy matching
- **conversations** / **direct_messages** - 1-to-1 DMs (text/image/venue types)
- **push_tokens** - push notification device tokens
- **recommendation_answers** - Q&A with upvoting

Supabase project ref: `fcuwuokxtptshksjvles`. Credentials are in `.env`.

## Design System

**Palette**: White background + Red (#E23744) primary + Golden Amber (#F5A623) accent. Dark mode supported.

All design tokens in `src/lib/constants.ts`:
- `Colors` / `DarkColors` - full light/dark palette
- `Spacing` - xs(4) through xxxl(32)
- `BorderRadius` - sm(8) through full(9999)
- `FontSize` - xs(11) through display(40)
- `FontFamily` - Nunito variants (regular, medium, semiBold, bold, extraBold)
- `AnimationConfigs` - spring presets (default, snappy, gentle, bouncy)
- `PriceRanges` - 4 tiers (TL currency)
- `VenueLevels` - Yeni(1) -> Popular(2) -> Ogrenci Onayli(3) -> Efsane(4)
- `VENUE_TAGS` - 12 food category tags
- `POST_TYPES` / `FEED_CATEGORIES` - content type definitions
- `ISTANBUL_DISTRICTS` - district list for location features

## Key Patterns

### Mock Data Fallback
All stores try Supabase first → fall back to `MOCK_*` arrays from `mockData.ts`. App is fully functional without a live database.

### 4 Post Types
`discovery` (venue review), `meetup` (event), `question` (recommendation request), `moment` (ephemeral, expires_at)

### Rating System
3-axis: Lezzet (Taste), Fiyat/Performans (Value), Ortam (Atmosphere). Each 1-5 stars. `overall_rating` = average.

### Venue Levels
Based on `total_reviews`: Yeni(0+) → Popular(5+) → Ogrenci Onayli(15+) → Efsane(50+).

### Realtime Subscriptions
Used for: DM messages, buddy match updates, event group chat, conversation list. Always clean up channels on unmount.

### Optimistic Updates
Messages: insert locally with temp ID, replace on server confirmation. Likes: toggle immediately, sync async.

### Gamification
XP awarded per action (venue +15, review +10, post +10, event +30/+25, buddy +20). `badgeChecker.ts` auto-awards badges fire-and-forget.

### Auth Guard
Protected screens check `useAuthStore.user` → redirect to login if null. Dev mode: `DEV_AUTO_LOGIN = true` uses MOCK_USERS[0].

### Glass Morphism Tab Bar
iOS: floating glass tab bar with BlurView. Android: standard opaque tab bar. Add button elevated with gradient.

## Running the App

```bash
npm install --legacy-peer-deps    # React 19 compat
npx expo start --port 8090        # Start Expo dev server
npx expo start --ios              # iOS simulator

# Database
npx supabase link --project-ref fcuwuokxtptshksjvles
npx supabase db push
```

## Known Issues / TODO

- Google Maps API key placeholder in `app.json` needs a real key for Android
- `@/*` path aliases defined in tsconfig but not in metro/babel config
- Stories feature has StoriesBar UI but no creation/viewing flow yet
- Reels screen template exists but video playback not fully implemented
- No search-by-text for venues (only map + filter)

## Conventions

- Use `Colors.*`, `Spacing.*`, `BorderRadius.*`, `FontSize.*`, `FontFamily.*` from constants — never hardcode
- `useThemeColors()` hook for dark mode-aware colors
- Zustand stores are the single source of truth — no prop drilling
- Supabase queries join relations: `.select('*, user:users(*)')`
- Mock data IDs prefixed: `u-` users, `v-` venues, `p-` posts, `r-` reviews, `mb-` buddies, `conv-` conversations
- Turkish text in UI, English in code
- Haptic feedback via `haptics.ts` helpers for user interactions
- Reanimated spring animations with configs from `AnimationConfigs`
