# Social Platform Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the feed from a photo-only timeline into a mixed-content social hub with 4 post types (Discovery, Meetup, Question, Moment), add a 5th tab (Kesfet/Discovery), and wire up image uploads + badge earning.

**Architecture:** Extend the existing `posts` table with `post_type` and `expires_at` columns. Create new `events`, `event_attendees` tables. Add new card components per post type. Update navigation from 4 tabs to 5. All changes maintain the mock-data fallback pattern.

**Tech Stack:** React Native + Expo Router, Zustand, Supabase (PostgreSQL + Realtime), TypeScript

---

## Task 1: Database Migration — Add post_type, expires_at, and event tables

**Files:**
- Create: `supabase/migrations/003_social_features.sql`

**Step 1: Write the migration SQL**

```sql
-- ==========================================
-- Social Platform Features Migration
-- ==========================================

-- Add post_type and expires_at to posts
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS post_type TEXT NOT NULL DEFAULT 'discovery'
    CHECK (post_type IN ('discovery', 'meetup', 'question', 'moment')),
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Index for filtering by post_type and expiry
CREATE INDEX IF NOT EXISTS idx_posts_post_type ON public.posts (post_type);
CREATE INDEX IF NOT EXISTS idx_posts_expires_at ON public.posts (expires_at)
  WHERE expires_at IS NOT NULL;

-- ==========================================
-- EVENTS (linked to a post of type 'meetup')
-- ==========================================
CREATE TABLE IF NOT EXISTS public.events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  venue_id        UUID REFERENCES public.venues(id) ON DELETE SET NULL,
  post_id         UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  location_name   TEXT,
  latitude        DOUBLE PRECISION,
  longitude       DOUBLE PRECISION,
  event_date      TIMESTAMPTZ NOT NULL,
  max_attendees   INTEGER NOT NULL DEFAULT 10,
  is_public       BOOLEAN NOT NULL DEFAULT true,
  status          TEXT NOT NULL DEFAULT 'upcoming'
                    CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_creator ON public.events (creator_id);
CREATE INDEX IF NOT EXISTS idx_events_venue ON public.events (venue_id);
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events (event_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON public.events (status);
CREATE INDEX IF NOT EXISTS idx_events_post ON public.events (post_id);

-- ==========================================
-- EVENT ATTENDEES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.event_attendees (
  event_id  UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status    TEXT NOT NULL DEFAULT 'confirmed'
              CHECK (status IN ('confirmed', 'waitlisted', 'cancelled')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_attendees_user ON public.event_attendees (user_id);

-- ==========================================
-- EVENT MESSAGES (mini group chat)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.event_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  message    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_messages_event ON public.event_messages (event_id);

-- ==========================================
-- RECOMMENDATION ANSWERS (for question posts)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.recommendation_answers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  venue_id   UUID REFERENCES public.venues(id) ON DELETE SET NULL,
  text       TEXT NOT NULL,
  upvotes    INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rec_answers_post ON public.recommendation_answers (post_id);

CREATE TABLE IF NOT EXISTS public.answer_upvotes (
  answer_id UUID NOT NULL REFERENCES public.recommendation_answers(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  PRIMARY KEY (answer_id, user_id)
);

-- ==========================================
-- RLS for new tables
-- ==========================================
ALTER TABLE public.events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_attendees    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer_upvotes     ENABLE ROW LEVEL SECURITY;

-- Events policies
CREATE POLICY "Events: anyone can read" ON public.events FOR SELECT USING (true);
CREATE POLICY "Events: authenticated can insert own" ON public.events FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Events: creator can update" ON public.events FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "Events: creator can delete" ON public.events FOR DELETE USING (auth.uid() = creator_id);

-- Event attendees policies
CREATE POLICY "Event attendees: anyone can read" ON public.event_attendees FOR SELECT USING (true);
CREATE POLICY "Event attendees: authenticated can join" ON public.event_attendees FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Event attendees: user can leave" ON public.event_attendees FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Event attendees: user can update own" ON public.event_attendees FOR UPDATE USING (auth.uid() = user_id);

-- Event messages policies
CREATE POLICY "Event messages: attendees can read" ON public.event_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.event_attendees ea WHERE ea.event_id = event_messages.event_id AND ea.user_id = auth.uid()));
CREATE POLICY "Event messages: attendees can insert" ON public.event_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.event_attendees ea WHERE ea.event_id = event_messages.event_id AND ea.user_id = auth.uid()));

-- Recommendation answers policies
CREATE POLICY "Rec answers: anyone can read" ON public.recommendation_answers FOR SELECT USING (true);
CREATE POLICY "Rec answers: authenticated can insert" ON public.recommendation_answers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Rec answers: user can update own" ON public.recommendation_answers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Rec answers: user can delete own" ON public.recommendation_answers FOR DELETE USING (auth.uid() = user_id);

-- Answer upvotes policies
CREATE POLICY "Answer upvotes: anyone can read" ON public.answer_upvotes FOR SELECT USING (true);
CREATE POLICY "Answer upvotes: authenticated can insert" ON public.answer_upvotes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Answer upvotes: user can delete own" ON public.answer_upvotes FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- Update posts_with_counts view to include post_type
-- ==========================================
CREATE OR REPLACE VIEW public.posts_with_counts AS
SELECT
  p.*,
  COALESCE(l.likes_count, 0) AS likes_count,
  COALESCE(c.comments_count, 0) AS comments_count
FROM public.posts p
LEFT JOIN (
  SELECT post_id, COUNT(*) AS likes_count FROM public.likes GROUP BY post_id
) l ON l.post_id = p.id
LEFT JOIN (
  SELECT post_id, COUNT(*) AS comments_count FROM public.comments GROUP BY post_id
) c ON c.post_id = p.id;

-- ==========================================
-- Seed new social badges
-- ==========================================
INSERT INTO public.badges (name, description, icon_name, condition_type, condition_value, color) VALUES
  ('Sosyal Kelebek',     'Attend 5 meetups',                  'people-outline',     'meetups_attended',  5,  '#06B6D4'),
  ('Bulusma Lideri',     'Organize 3 meetups',                'megaphone-outline',  'meetups_organized', 3,  '#8B5CF6'),
  ('Anlik Paylasimci',   'Share 10 moments',                  'flash-outline',      'moments_shared',   10, '#F97316'),
  ('Lezzet Rehberi',     'Get 20 upvotes on recommendations', 'star-outline',       'upvotes_received', 20, '#EAB308');
```

**Step 2: Push the migration**

Run: `npx supabase db push`
Expected: Migration applies successfully. If Supabase CLI is not linked, this can be run manually via the Supabase SQL editor.

**Step 3: Commit**

```bash
git add supabase/migrations/003_social_features.sql
git commit -m "feat(db): add post_type, events, recommendations tables for social features"
```

---

## Task 2: Update TypeScript Types

**Files:**
- Modify: `src/types/index.ts`

**Step 1: Add new types and update existing Post interface**

Add `post_type` and `expires_at` to the `Post` interface (after line 70):

```typescript
// In Post interface, add after venue_id line:
  post_type: 'discovery' | 'meetup' | 'question' | 'moment';
  expires_at: string | null;
```

Add these new interfaces after `UserBadge` (after line 133):

```typescript
export interface Event {
  id: string;
  creator_id: string;
  venue_id: string | null;
  post_id: string;
  title: string;
  description: string | null;
  location_name: string | null;
  latitude: number | null;
  longitude: number | null;
  event_date: string;
  max_attendees: number;
  is_public: boolean;
  status: 'upcoming' | 'active' | 'completed' | 'cancelled';
  created_at: string;
  // Joined
  creator?: User;
  venue?: Venue;
  attendees?: EventAttendee[];
  attendee_count?: number;
}

export interface EventAttendee {
  event_id: string;
  user_id: string;
  status: 'confirmed' | 'waitlisted' | 'cancelled';
  joined_at: string;
  // Joined
  user?: User;
}

export interface EventMessage {
  id: string;
  event_id: string;
  user_id: string;
  message: string;
  created_at: string;
  // Joined
  user?: User;
}

export interface RecommendationAnswer {
  id: string;
  post_id: string;
  user_id: string;
  venue_id: string | null;
  text: string;
  upvotes: number;
  created_at: string;
  // Joined
  user?: User;
  venue?: Venue;
}

export type PostType = 'discovery' | 'meetup' | 'question' | 'moment';
```

Update `FeedCategory` (line 164) to add post type filters:

```typescript
export type FeedCategory = 'all' | 'nearby' | 'top' | 'new' | 'meetups' | 'questions' | 'moments';
```

Update `Badge.condition_type` (line 123) to include new types:

```typescript
  condition_type: 'venues_added' | 'reviews_written' | 'posts_created' | 'likes_received' | 'streak_days' | 'meetups_attended' | 'meetups_organized' | 'moments_shared' | 'upvotes_received';
```

**Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): add Event, EventAttendee, RecommendationAnswer types and PostType"
```

---

## Task 3: Update Mock Data with Post Types

**Files:**
- Modify: `src/lib/mockData.ts`

**Step 1: Add post_type to existing MOCK_POSTS**

Update each existing mock post to include `post_type: 'discovery'` and `expires_at: null`.

**Step 2: Add mock meetup posts**

Add 3-4 mock meetup posts to MOCK_POSTS array. Example:

```typescript
{
  id: 'p-meet-001',
  user_id: 'u-001',
  venue_id: 'v-001',
  post_type: 'meetup',
  caption: 'Cuma aksam Kadikoy\'de kebap yiyelim! Kim gelir?',
  expires_at: null,
  created_at: '2026-03-07T19:00:00Z',
},
```

**Step 3: Add mock question posts**

Add 2-3 mock question posts:

```typescript
{
  id: 'p-ask-001',
  user_id: 'u-003',
  venue_id: null,
  post_type: 'question',
  caption: 'Besiktas\'ta en iyi hamburgerci neresi? Onerilerinizi bekliyorum!',
  expires_at: null,
  created_at: '2026-03-03T14:00:00Z',
},
```

**Step 4: Add mock moment posts**

Add 2-3 mock moment posts with expires_at set 24h from creation:

```typescript
{
  id: 'p-moment-001',
  user_id: 'u-002',
  venue_id: 'v-005',
  post_type: 'moment',
  caption: 'Su an buradayim, muhtesem lahmacun!',
  expires_at: '2026-03-05T10:00:00Z',
  created_at: '2026-03-04T10:00:00Z',
},
```

**Step 5: Add MOCK_EVENTS array**

```typescript
export const MOCK_EVENTS: Event[] = [
  {
    id: 'e-001',
    creator_id: 'u-001',
    venue_id: 'v-001',
    post_id: 'p-meet-001',
    title: 'Kadikoy Kebap Bulusmasi',
    description: 'Cuma aksam birlikte kebap yiyelim, yeni insanlar taniyalim!',
    location_name: null,
    latitude: null,
    longitude: null,
    event_date: '2026-03-07T19:00:00Z',
    max_attendees: 6,
    is_public: true,
    status: 'upcoming',
    created_at: '2026-03-03T12:00:00Z',
  },
  {
    id: 'e-002',
    creator_id: 'u-004',
    venue_id: 'v-008',
    post_id: 'p-meet-002',
    title: 'Ramen Deneme Gecesi',
    description: 'Yeni acilan ramen mekanini birlikte deneyelim',
    location_name: null,
    latitude: null,
    longitude: null,
    event_date: '2026-03-10T20:00:00Z',
    max_attendees: 8,
    is_public: true,
    status: 'upcoming',
    created_at: '2026-03-04T09:00:00Z',
  },
];

export const MOCK_EVENT_ATTENDEES: EventAttendee[] = [
  { event_id: 'e-001', user_id: 'u-001', status: 'confirmed', joined_at: '2026-03-03T12:00:00Z' },
  { event_id: 'e-001', user_id: 'u-002', status: 'confirmed', joined_at: '2026-03-03T14:00:00Z' },
  { event_id: 'e-001', user_id: 'u-005', status: 'confirmed', joined_at: '2026-03-04T08:00:00Z' },
  { event_id: 'e-002', user_id: 'u-004', status: 'confirmed', joined_at: '2026-03-04T09:00:00Z' },
  { event_id: 'e-002', user_id: 'u-003', status: 'confirmed', joined_at: '2026-03-04T10:00:00Z' },
];

export const MOCK_RECOMMENDATION_ANSWERS: RecommendationAnswer[] = [
  {
    id: 'ra-001',
    post_id: 'p-ask-001',
    user_id: 'u-005',
    venue_id: 'v-003',
    text: 'Kesinlikle buraya git, pismanlık yasamazsin!',
    upvotes: 8,
    created_at: '2026-03-03T15:00:00Z',
  },
  {
    id: 'ra-002',
    post_id: 'p-ask-001',
    user_id: 'u-007',
    venue_id: 'v-010',
    text: 'Fiyat performans olarak en iyisi burasi',
    upvotes: 5,
    created_at: '2026-03-03T16:30:00Z',
  },
];
```

**Step 6: Commit**

```bash
git add src/lib/mockData.ts
git commit -m "feat(mock): add meetup, question, moment mock data and events"
```

---

## Task 4: Create Event Store

**Files:**
- Create: `src/stores/eventStore.ts`

**Step 1: Create the store**

Create a Zustand store with:
- State: `events`, `selectedEvent`, `attendees`, `messages`, `loading`
- Actions: `fetchEventByPostId(postId)`, `createEvent(data)`, `joinEvent(eventId, userId)`, `leaveEvent(eventId, userId)`, `fetchAttendees(eventId)`, `fetchMessages(eventId)`, `sendMessage(eventId, userId, text)`
- Follow the exact same pattern as `feedStore.ts` — try Supabase first, fall back to MOCK_EVENTS

Key implementation notes:
- `createEvent` should also create the associated post with `post_type: 'meetup'`
- `joinEvent` should check if event is full and waitlist if needed
- `fetchEventByPostId` joins with creator (users), venue, and attendees
- All mock data fallbacks use MOCK_EVENTS, MOCK_EVENT_ATTENDEES from mockData.ts

**Step 2: Commit**

```bash
git add src/stores/eventStore.ts
git commit -m "feat(store): add eventStore with CRUD, join/leave, and mock fallback"
```

---

## Task 5: Update Feed Store for Mixed Post Types

**Files:**
- Modify: `src/stores/feedStore.ts`

**Step 1: Update FeedState interface**

Add to the state interface (around line 9-18):
- No new state fields needed — the `category` field already exists and will accept the new values

**Step 2: Update `buildCategoryQuery`**

Modify the `buildCategoryQuery` function (lines 92-117) to:
- For `'meetups'`: add `.eq('post_type', 'meetup')`
- For `'questions'`: add `.eq('post_type', 'question')`
- For `'moments'`: add `.eq('post_type', 'moment')` and `.gt('expires_at', new Date().toISOString())`
- For `'all'`: no post_type filter, but exclude expired moments: `.or('expires_at.is.null,expires_at.gt.${new Date().toISOString()}')`

**Step 3: Update `applyCategoryToMockPosts`**

Modify the function (lines 58-74) to filter mock posts by post_type when category is 'meetups', 'questions', or 'moments'. For 'moments', also check expires_at.

**Step 4: Update `buildMockPostsWithJoins`**

Add `post_type` and `expires_at` fields to the mock join builder (lines 35-53). Join event data for meetup posts from MOCK_EVENTS.

**Step 5: Commit**

```bash
git add src/stores/feedStore.ts
git commit -m "feat(feed): support mixed post types and category filtering"
```

---

## Task 6: Create EventCard Component

**Files:**
- Create: `src/components/feed/EventCard.tsx`

**Step 1: Build the component**

Create a card component for meetup posts that appears in the feed. It should:
- Show the event title, description
- Display venue photo (or placeholder) with a date/time badge overlay
- Show attendee avatars (up to 4) with "+N more" indicator
- Show "3/6 kisi" attendee count
- Have a prominent "Katil" (Join) button — primary red
- When full, show "Dolu" in gray with optional waitlist
- Show creator avatar + name + timestamp (same header pattern as PostCard)
- On press: navigate to event detail (for Phase 2, initially navigate to post/[id])

Design tokens to use:
- `Colors.primary` for Join button
- `Colors.accent` for date badge
- `BorderRadius.lg` for card
- `FontFamily.headingBold` for title
- Same shadow/elevation pattern as PostCard

Props interface:
```typescript
interface EventCardProps {
  post: Post;
  event: Event;
  onJoin: (eventId: string) => void;
  onUserPress: (userId: string) => void;
  onVenuePress?: (venueId: string) => void;
}
```

**Step 2: Commit**

```bash
git add src/components/feed/EventCard.tsx
git commit -m "feat(ui): add EventCard component for meetup posts in feed"
```

---

## Task 7: Create QuestionCard Component

**Files:**
- Create: `src/components/feed/QuestionCard.tsx`

**Step 1: Build the component**

A card for question posts (Oneri):
- Question icon + user header (avatar, name, time)
- Question text in larger font
- Area/location tag pill (if venue linked)
- Top 2 answers preview with venue link and upvote count
- "N yanit" (N answers) link to full view
- "Yanitla" (Answer) button

Props:
```typescript
interface QuestionCardProps {
  post: Post;
  topAnswers?: RecommendationAnswer[];
  onAnswer: (postId: string) => void;
  onUserPress: (userId: string) => void;
  onVenuePress?: (venueId: string) => void;
}
```

**Step 2: Commit**

```bash
git add src/components/feed/QuestionCard.tsx
git commit -m "feat(ui): add QuestionCard component for question posts in feed"
```

---

## Task 8: Create MomentCard Component

**Files:**
- Create: `src/components/feed/MomentCard.tsx`

**Step 1: Build the component**

A card for moment/anlik posts:
- Full-width image (similar to PostCard but more Instagram-story-like)
- "Su an burada" live badge with pulse animation (green dot + text)
- Venue name overlay on image
- User avatar + name overlay at bottom
- Casual/BeReal aesthetic — slightly more raw than discovery posts
- Time remaining indicator ("22 saat kaldi" before it expires)
- Like button + "Ben de geliyorum!" quick-action button

Props:
```typescript
interface MomentCardProps {
  post: Post;
  onLike: (postId: string) => void;
  onJoinMoment: (postId: string) => void;
  onUserPress: (userId: string) => void;
  onVenuePress?: (venueId: string) => void;
}
```

Use `Animated` pulse effect for the live badge (repeating scale animation).

**Step 2: Commit**

```bash
git add src/components/feed/MomentCard.tsx
git commit -m "feat(ui): add MomentCard component for moment/anlik posts in feed"
```

---

## Task 9: Update Feed Screen for Mixed Content

**Files:**
- Modify: `src/app/(tabs)/feed.tsx`

**Step 1: Update category chips**

Replace the current 4 chips (Tumu, Yakinda, En Begenilen, Yeni) with new social-focused chips:

```typescript
const CATEGORIES = [
  { key: 'all', label: 'Tumu', icon: 'apps-outline' },
  { key: 'meetups', label: 'Bulusmalar', icon: 'people-outline' },
  { key: 'moments', label: 'Anlik', icon: 'flash-outline' },
  { key: 'questions', label: 'Oneriler', icon: 'help-circle-outline' },
  { key: 'top', label: 'Populer', icon: 'trending-up-outline' },
  { key: 'new', label: 'Yeni', icon: 'time-outline' },
];
```

**Step 2: Update renderPost to switch on post_type**

In the `renderPost` callback, check `item.post_type` and render the appropriate card:
- `'discovery'` → existing `PostCard`
- `'meetup'` → new `EventCard`
- `'question'` → new `QuestionCard`
- `'moment'` → new `MomentCard`

Import all new card components.

**Step 3: Rename header from "Kesfet" to "Akis"**

The feed tab title becomes "Akis" (Timeline/Feed). The discovery tab will take the "Kesfet" name.

**Step 4: Commit**

```bash
git add src/app/(tabs)/feed.tsx
git commit -m "feat(feed): render mixed post types with EventCard, QuestionCard, MomentCard"
```

---

## Task 10: Update Tab Navigation — Add 5th Tab (Kesfet/Discovery)

**Files:**
- Create: `src/app/(tabs)/discover.tsx`
- Modify: `src/app/(tabs)/_layout.tsx`

**Step 1: Create the Discover screen**

Create `discover.tsx` — a discovery/explore screen with 3 sections:
1. **Trend Mekanlar** — horizontal scroll of top-rated venues this week (reuse VenueCard)
2. **Yaklasan Bulusmalar** — upcoming events cards (horizontal scroll)
3. **Populer Sorular** — popular question posts with most answers

This is a ScrollView with sections, each section has a header ("Trend Mekanlar", "Yaklasan Bulusmalar", etc.) and a horizontal FlatList.

Use data from venueStore (top venues), eventStore (upcoming events), feedStore (question posts sorted by comments_count).

**Step 2: Update tab layout**

In `_layout.tsx`, update the TABS array (line 36-41) to add the discover tab:

```typescript
const TABS: TabDef[] = [
  { name: 'map', title: 'Harita', iconFocused: 'map', iconOutline: 'map-outline' },
  { name: 'feed', title: 'Akis', iconFocused: 'chatbubbles', iconOutline: 'chatbubbles-outline' },
  { name: 'add', title: '', iconFocused: 'add', iconOutline: 'add', isAdd: true },
  { name: 'discover', title: 'Kesfet', iconFocused: 'compass', iconOutline: 'compass-outline' },
  { name: 'profile', title: 'Profil', iconFocused: 'person', iconOutline: 'person-outline' },
];
```

Add the new `<Tabs.Screen name="discover" />` in the JSX.

Update the glass tab bar's left/right split to handle 5 tabs (2 left, center add, 2 right).

**Step 3: Commit**

```bash
git add src/app/(tabs)/discover.tsx src/app/(tabs)/_layout.tsx
git commit -m "feat(nav): add Kesfet discovery tab with trending venues and upcoming events"
```

---

## Task 11: Update Add Screen — 4 Post Type Options

**Files:**
- Modify: `src/app/(tabs)/add.tsx`
- Create: `src/components/forms/EventForm.tsx`
- Create: `src/components/forms/QuestionForm.tsx`
- Create: `src/components/forms/MomentCapture.tsx`

**Step 1: Create EventForm**

A form component for creating meetups:
- Title input (required)
- Description textarea
- Venue picker (search existing venues — reuse pattern from PostForm venue selector)
- Date & time picker (use `@react-native-community/datetimepicker`)
- Max attendees number input (default 10)
- Public/Private toggle
- Submit button — calls `eventStore.createEvent()`

**Step 2: Create QuestionForm**

Simple form for asking questions:
- Question text input (large, multiline)
- Optional area/semt tag selector (Kadikoy, Besiktas, Taksim, etc.)
- Optional venue link
- Submit → calls `feedStore.createPost()` with `post_type: 'question'`

**Step 3: Create MomentCapture**

Streamlined "capture and post" for moments:
- Camera button → opens camera (use existing useImagePicker hook)
- OR gallery pick (single image only)
- Auto-detect current location
- Small caption input (optional, max 100 chars)
- Submit → calls `feedStore.createPost()` with `post_type: 'moment'` and `expires_at: 24h from now`

**Step 4: Update add.tsx segment control**

Replace the 2-option segment (venue/post) with a 4-option grid or scrollable segment:

```typescript
type TabMode = 'venue' | 'post' | 'meetup' | 'question' | 'moment';
```

Options:
- Mekan Ekle (restaurant icon)
- Kesif Paylas (camera icon) — renamed from "Gonderi Paylas"
- Bulusma Olustur (people icon)
- Soru Sor (help-circle icon)
- Anlik Paylas (flash icon)

Render the corresponding form based on activeTab.

**Step 5: Commit**

```bash
git add src/app/(tabs)/add.tsx src/components/forms/EventForm.tsx src/components/forms/QuestionForm.tsx src/components/forms/MomentCapture.tsx
git commit -m "feat(add): add EventForm, QuestionForm, MomentCapture with updated tab selector"
```

---

## Task 12: Wire Image Upload into Existing Forms

**Files:**
- Modify: `src/components/forms/VenueForm.tsx`
- Modify: `src/components/forms/PostForm.tsx`

**Step 1: Update VenueForm**

The VenueForm currently collects `images: string[]` (local URIs) but never calls `uploadImage()`. Before submitting to `venueStore.addVenue()`:
1. Call `uploadImages(images, 'venues')` to upload to Supabase Storage
2. Use the returned URLs in the venue creation payload
3. Show upload progress/loading state on the submit button

**Step 2: Update PostForm**

The PostForm is already handled — `feedStore.createPost` calls `uploadImages()`. Verify this path works. If images are passed as local URIs to `createPost`, the store already uploads them. No changes needed unless the form isn't passing image URIs correctly.

**Step 3: Commit**

```bash
git add src/components/forms/VenueForm.tsx src/components/forms/PostForm.tsx
git commit -m "fix(forms): wire image upload into VenueForm submission"
```

---

## Task 13: Add IG Share Card Generation

**Files:**
- Create: `src/components/share/ShareCard.tsx`
- Create: `src/lib/shareUtils.ts`

**Step 1: Install dependencies**

Run: `npx expo install react-native-view-shot expo-sharing`

**Step 2: Create ShareCard component**

A React component that renders a beautiful card optimized for IG stories (1080x1920 aspect ratio conceptually, rendered at a smaller size and scaled):

```typescript
interface ShareCardProps {
  venue?: Venue;
  post?: Post;
  event?: Event;
}
```

Card design:
- Venue photo as background (blurred) with gradient overlay
- Venue name in large white text
- Star rating display
- Price range pills
- "Ogrenci Nerede Yer" branding at bottom with logo
- QR-code-style placeholder (can add real QR later)

**Step 3: Create shareUtils.ts**

Utility functions:
- `captureAndShare(viewRef)` — uses `react-native-view-shot` to capture the ShareCard as an image, then `expo-sharing` to open the native share sheet
- This lets users share to IG stories, WhatsApp, etc.

**Step 4: Add share button to PostCard and VenueCard**

The share button already exists in PostCard. Wire it to render a ShareCard offscreen, capture it, and share.

**Step 5: Commit**

```bash
git add src/components/share/ShareCard.tsx src/lib/shareUtils.ts
git commit -m "feat(share): add IG-optimized share card with view-shot capture"
```

---

## Task 14: Activate Badge Earning Logic

**Files:**
- Modify: `src/stores/feedStore.ts`
- Modify: `src/stores/venueStore.ts`
- Create: `src/lib/badgeChecker.ts`

**Step 1: Create badgeChecker utility**

```typescript
// src/lib/badgeChecker.ts
import { supabase } from './supabase';

export async function checkAndAwardBadges(userId: string): Promise<void> {
  // Fetch all badges and user's current badges
  const [{ data: allBadges }, { data: userBadges }] = await Promise.all([
    supabase.from('badges').select('*'),
    supabase.from('user_badges').select('badge_id').eq('user_id', userId),
  ]);

  if (!allBadges) return;
  const earnedIds = new Set((userBadges || []).map((ub) => ub.badge_id));

  // Fetch user stats
  const [
    { count: venueCount },
    { count: reviewCount },
    { count: postCount },
    { count: meetupsAttended },
    { count: meetupsOrganized },
    { count: momentsCount },
  ] = await Promise.all([
    supabase.from('venues').select('*', { count: 'exact', head: true }).eq('created_by', userId),
    supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('event_attendees').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'confirmed'),
    supabase.from('events').select('*', { count: 'exact', head: true }).eq('creator_id', userId),
    supabase.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('post_type', 'moment'),
  ]);

  const statsMap: Record<string, number> = {
    venues_added: venueCount || 0,
    reviews_written: reviewCount || 0,
    posts_created: postCount || 0,
    meetups_attended: meetupsAttended || 0,
    meetups_organized: meetupsOrganized || 0,
    moments_shared: momentsCount || 0,
  };

  // Award any newly-earned badges
  for (const badge of allBadges) {
    if (earnedIds.has(badge.id)) continue;
    const stat = statsMap[badge.condition_type];
    if (stat !== undefined && stat >= badge.condition_value) {
      await supabase.from('user_badges').insert({ user_id: userId, badge_id: badge.id });
    }
  }
}

export async function addXP(userId: string, points: number): Promise<void> {
  await supabase.rpc('increment_xp', { user_id: userId, points });
  // Fallback if RPC doesn't exist: direct update
  // await supabase.from('users').update({ xp_points: supabase.raw(`xp_points + ${points}`) }).eq('id', userId);
}
```

**Step 2: Call badge checker after key actions**

In `feedStore.createPost` — after successful post creation:
```typescript
await checkAndAwardBadges(user_id);
await addXP(user_id, 10);
```

In `venueStore.addVenue` — after successful venue creation:
```typescript
await checkAndAwardBadges(userId);
await addXP(userId, 15);
```

In `venueStore.addReview` — after successful review:
```typescript
await checkAndAwardBadges(userId);
await addXP(userId, 10);
```

In `eventStore.createEvent` — after creating event:
```typescript
await checkAndAwardBadges(userId);
await addXP(userId, 30);
```

In `eventStore.joinEvent` — after joining event:
```typescript
await checkAndAwardBadges(userId);
await addXP(userId, 25);
```

**Step 3: Commit**

```bash
git add src/lib/badgeChecker.ts src/stores/feedStore.ts src/stores/venueStore.ts src/stores/eventStore.ts
git commit -m "feat(gamification): activate badge earning and XP system on user actions"
```

---

## Task 15: Update Constants with Social Feature Tokens

**Files:**
- Modify: `src/lib/constants.ts`

**Step 1: Add post type config**

Add after VENUE_TAGS (around line 220+):

```typescript
export const POST_TYPES = {
  discovery: { label: 'Kesif', icon: 'camera-outline', color: Colors.primary },
  meetup: { label: 'Bulusma', icon: 'people-outline', color: '#06B6D4' },
  question: { label: 'Soru', icon: 'help-circle-outline', color: '#8B5CF6' },
  moment: { label: 'Anlik', icon: 'flash-outline', color: '#F97316' },
} as const;

export const FEED_CATEGORIES = [
  { key: 'all', label: 'Tumu', icon: 'apps-outline' },
  { key: 'meetups', label: 'Bulusmalar', icon: 'people-outline' },
  { key: 'moments', label: 'Anlik', icon: 'flash-outline' },
  { key: 'questions', label: 'Oneriler', icon: 'help-circle-outline' },
  { key: 'top', label: 'Populer', icon: 'trending-up-outline' },
  { key: 'new', label: 'Yeni', icon: 'time-outline' },
] as const;

export const ISTANBUL_SEMTLER = [
  'Kadikoy', 'Besiktas', 'Taksim', 'Sisli', 'Uskudar',
  'Bakirkoy', 'Fatih', 'Beyoglu', 'Maltepe', 'Atasehir',
  'Sariyer', 'Kartal', 'Pendik', 'Umraniye', 'Beylikduzu',
] as const;
```

**Step 2: Commit**

```bash
git add src/lib/constants.ts
git commit -m "feat(constants): add POST_TYPES, FEED_CATEGORIES, ISTANBUL_SEMTLER tokens"
```

---

## Execution Order Summary

The tasks should be executed in this order due to dependencies:

1. **Task 1** — DB migration (no deps)
2. **Task 2** — Types (no deps)
3. **Task 3** — Mock data (depends on Task 2 for types)
4. **Task 15** — Constants (no deps, but good to do early)
5. **Task 4** — Event store (depends on Tasks 2, 3)
6. **Task 5** — Feed store update (depends on Tasks 2, 3)
7. **Task 6** — EventCard (depends on Tasks 2, 4)
8. **Task 7** — QuestionCard (depends on Task 2)
9. **Task 8** — MomentCard (depends on Task 2)
10. **Task 9** — Feed screen update (depends on Tasks 6, 7, 8)
11. **Task 10** — Tab navigation + discover screen (depends on Tasks 4, 5)
12. **Task 11** — Add screen update (depends on Tasks 4, 5)
13. **Task 12** — Image upload wiring (independent)
14. **Task 13** — Share cards (independent)
15. **Task 14** — Badge system (depends on Tasks 4, 5)

Tasks 12, 13, 14 can be done in parallel with the rest as they're independent integrations.
