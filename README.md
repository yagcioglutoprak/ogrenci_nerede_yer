# Ogrenci Nerede Yer?

**Universite ogrencileri icin yemek kesfet, paylas, eslesmelerini bul.**

A social dining platform for Turkish university students. Discover affordable restaurants near campus, share food experiences, match with meal buddies, and build curated lists — all on an interactive map centered on Istanbul.

<p align="center">
  <img src="assets/icon.png" width="120" alt="App Icon" />
</p>

---

## Features

### Interactive Map
Browse venue pins on an Apple Maps-style interface with color-coded markers by food category. Tap a pin to reveal a detailed bottom sheet with ratings, photos, and quick actions. Filter by price, tags, and minimum rating.

### Social Feed
Scroll through four post types:
- **Kesfet** — venue discovery posts with photo carousels and ratings
- **Bulusma** — meetup events with RSVP, attendee lists, and group chat
- **Soru** — recommendation questions with community answers and upvoting
- **Anlar** — ephemeral moments that expire after a set time

An Instagram-style stories bar sits at the top for quick browsing.

### Yemek Buddy (Meal Buddy)
Tinder-style swipe cards to find nearby students who want to eat together. Set your availability window and proximity radius, swipe right to match, then chat in real time to pick a spot.

### Direct Messages
Full 1-to-1 messaging with text, image, and rich venue card message types. Unread counts, read receipts, and real-time delivery via Supabase subscriptions.

### Curated Lists
Create and share ordered restaurant lists (e.g., "En iyi 10 lahmacuncu"). Add venues with personal notes, make lists public or private, and follow other users' lists.

### Venue Ratings
Three-axis rating system:
| Axis | Turkish | Description |
|------|---------|-------------|
| Taste | Lezzet | Food quality |
| Value | Fiyat/Performans | Price-to-quality ratio |
| Atmosphere | Ortam | Student-friendliness |

Venues earn levels as they accumulate reviews: **Yeni** → **Popular** → **Ogrenci Onayli** → **Efsane**

### Gamification
Earn XP and unlock badges for contributing: adding venues, writing reviews, organizing meetups, completing buddy matches, and more. 11 badge categories with automatic awarding.

### Dark Mode
Full light/dark/auto theme support with a polished glass morphism tab bar on iOS.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React Native 0.83.2 + Expo SDK 55 |
| Routing | Expo Router (file-based) |
| State | Zustand v5 (8 stores) |
| Backend | Supabase (PostgreSQL, Auth, RLS, Storage, Realtime) |
| Maps | react-native-maps |
| Animations | react-native-reanimated v4 |
| UI | @gorhom/bottom-sheet, expo-blur, expo-haptics |
| Fonts | Nunito (Google Fonts) |
| Language | TypeScript (strict) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- iOS Simulator (Xcode) or Android Emulator
- Supabase account (optional — app works with mock data)

### Installation

```bash
# Clone the repo
git clone https://github.com/your-org/ogrenci-nerede-yer.git
cd ogrenci-nerede-yer

# Install dependencies (--legacy-peer-deps needed for React 19)
npm install --legacy-peer-deps

# Set up environment variables
cp .env.example .env
# Edit .env with your Supabase URL and anon key
```

### Running

```bash
# Start the Expo dev server
npx expo start --port 8090

# Run on iOS simulator
npx expo start --ios

# Run on Android emulator
npx expo start --android
```

### Database Setup (Optional)

The app ships with rich mock data and works fully without a database. To connect Supabase:

```bash
# Link to your Supabase project
npx supabase link --project-ref YOUR_PROJECT_REF

# Push all migrations (9 migration files)
npx supabase db push
```

---

## Project Structure

```
src/
  app/                    # 20+ screens via Expo Router
    (tabs)/               # 5 tabs: Map, Feed, Add, Messages, Profile
    venue/[id].tsx        # Venue detail
    post/[id].tsx         # Post detail
    event/[id].tsx        # Event detail + group chat
    chat/[id].tsx         # DM conversation
    buddy.tsx             # Meal buddy matching
    ...
  components/
    ui/                   # 14 reusable primitives
    venue/                # VenueCard, VenueBottomSheet
    feed/                 # PostCard, EventCard, QuestionCard, MomentCard, StoriesBar
    forms/                # 8 form components (venue, post, event, question, moment...)
    chat/                 # MessageBubble, ImageBubble, VenueBubble, AttachmentSheet
    buddy/                # SwipeDeck (Tinder-style cards)
    share/                # ShareCard
  stores/                 # 8 Zustand stores
  lib/                    # Constants, Supabase client, mock data, utilities
  hooks/                  # 5 custom hooks
  types/                  # TypeScript interfaces
supabase/
  migrations/             # 9 SQL migration files
docs/
  plans/                  # Design specs and implementation plans
```

---

## Design System

The app uses a food-themed visual language with warm colors and modern typography.

- **Primary**: Red `#E23744`
- **Accent**: Golden Amber `#F5A623`
- **Font**: Nunito (Regular, Medium, SemiBold, Bold, ExtraBold)
- **Surfaces**: White with subtle shadows (light), dark gray with glass morphism (dark)

All design values come from `src/lib/constants.ts` — no hardcoded colors, spacing, or font sizes anywhere in the codebase.

---

## Architecture

### State Management
Eight Zustand stores manage distinct domains. Each store tries Supabase first and falls back to embedded mock data, making the app fully functional offline or without a backend.

### Realtime
Supabase Realtime subscriptions power live updates for DMs, buddy matching, and event group chat. Channels are cleaned up on component unmount.

### Navigation
Expo Router file-based routing with a bottom tab navigator (5 tabs) and modal stack screens. The tab bar uses glass morphism on iOS with Reanimated spring animations.

### Mock Data
`src/lib/mockData.ts` contains 20 venues, 15 posts, 10 users, 5 events, and supporting data. Mock IDs use prefixes (`v-`, `u-`, `p-`, etc.) for easy identification.

---

## Environment Variables

Create a `.env` file in the project root:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Conventions

- Turkish for all user-facing text, English for code
- Use design tokens from `constants.ts` — never hardcode values
- Zustand stores are the single source of truth
- Add mock data fallbacks for any new Supabase queries

---

## License

This project is private and proprietary.

---

<p align="center">
  Built with React Native + Expo + Supabase
  <br/>
  <strong>Afiyet olsun!</strong>
</p>
