# Feature Bundle Design — Ogrenci Nerede Yer?

**Date:** 2026-03-04
**Status:** Approved

## Scope

5 feature areas, implemented in 5 phases:

1. Quick Wins + Q&A Fix
2. Real-Time Event Chat
3. Push Notifications
4. Lezzet Listesi (Taste Lists)
5. Yemek Buddy Matching

---

## Phase 1: Quick Wins + Q&A Fix

### 1A. Fix Q&A System

**Problem:** Answer submission in `post/[id].tsx` writes to `comments` instead of `recommendation_answers`. Upvote button renders but has no handler.

**Changes:**
- `feedStore.ts` or new `qaStore.ts`: add `submitAnswer(postId, userId, text, venueIds[])` → writes to `recommendation_answers`
- `feedStore.ts` or `qaStore.ts`: add `upvoteAnswer(answerId, userId)` → writes to `answer_upvotes`, optimistic toggle
- `feedStore.ts` or `qaStore.ts`: add `fetchAnswers(postId)` → queries `recommendation_answers` with user join + upvote count
- `post/[id].tsx`: wire answer input to `submitAnswer()` when `post_type === 'question'`
- `post/[id].tsx`: wire upvote button `onPress` to `upvoteAnswer()`
- Keep `addComment()` for regular posts unchanged

### 1B. Profile Edit Screen

**New route:** `app/profile/edit.tsx`

**Fields:**
- Avatar (image picker → Supabase Storage upload)
- Full name (TextInput)
- Username (TextInput)
- Bio (TextInput, multiline)
- University (picker/dropdown of Istanbul universities)

**Backend:** Uses existing `authStore.updateProfile()` which writes to `users` table.

**Navigation:** Profile screen gear icon → Settings, Settings has "Profili Düzenle" row → `profile/edit`.

### 1C. Settings Screen

**New route:** `app/settings.tsx`

**Sections:**
- Profili Düzenle → navigates to `profile/edit`
- Tema (Light / Dark / Auto toggle) → uses `themeStore.setMode()`
- Bildirim Tercihleri → toggles per notification type (stored in AsyncStorage until Phase 3)
- Hakkında / Versiyon
- Çıkış Yap → sign out with confirmation

**Navigation:** Profile screen gear icon → `settings` (replaces current direct sign-out alert).

### 1D. Date Picker for Events

**Change:** Replace `TextInput` in `EventForm.tsx` with `@react-native-community/datetimepicker`.

**UX:** Tap field → opens native date+time picker → formatted string shown (e.g. "15 Mart 2026, 14:30").

### 1E. Bug Fixes

| Bug | Fix |
|-----|-----|
| Profile post grid not tappable | Add `onPress={() => router.push(`/post/${post.id}`)}` |
| `badgeChecker.ts` `likes_received` wrong query | Change filter to join through `posts` where `posts.user_id = userId` |
| `streak_days` badge never awarded | Add `last_active_date` column to `users`, update on any action, calculate streak in `badgeChecker` |
| Bookmark button empty handler | Wire to new `bookmarks` table or reuse `favorites` with a `type` discriminator |

### 1F. Database Migration (Phase 1)

```sql
-- 004_quick_wins.sql

-- Add last_active_date for streak tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_date date;

-- Bookmarks table (separate from venue favorites)
CREATE TABLE IF NOT EXISTS bookmarks (
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own bookmarks" ON bookmarks FOR ALL USING (auth.uid() = user_id);
```

---

## Phase 2: Real-Time Event Chat

**Current state:** `event/[id].tsx` calls `fetchMessages()` once on mount, no live updates.

**Changes:**
- `eventStore.ts`: add `subscribeToMessages(eventId)` → returns Supabase channel
  ```ts
  const channel = supabase.channel(`event-${eventId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'event_messages',
      filter: `event_id=eq.${eventId}`
    }, (payload) => {
      // append to messages state
    })
    .subscribe()
  ```
- `eventStore.ts`: add `unsubscribeFromMessages()` → removes channel
- `event/[id].tsx`: call `subscribeToMessages` in `useEffect`, cleanup on unmount
- Auto-scroll to bottom on new incoming message
- Optional: typing indicator via Supabase Realtime Presence (broadcast "typing" state)

**No migration needed** — uses existing `event_messages` table.

---

## Phase 3: Push Notifications

### Database

```sql
-- 005_push_notifications.sql

CREATE TABLE IF NOT EXISTS push_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  expo_push_token text NOT NULL,
  platform text CHECK (platform IN ('ios', 'android')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, expo_push_token)
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own tokens" ON push_tokens FOR ALL USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id uuid REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
  new_follower boolean DEFAULT true,
  post_comment boolean DEFAULT true,
  post_like boolean DEFAULT true,
  answer_received boolean DEFAULT true,
  answer_upvote boolean DEFAULT true,
  event_reminder boolean DEFAULT true,
  badge_earned boolean DEFAULT true,
  buddy_match boolean DEFAULT true
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own prefs" ON notification_preferences FOR ALL USING (auth.uid() = user_id);
```

### Client

**New files:**
- `src/lib/notifications.ts` — `registerForPushNotifications()`, `handleNotificationReceived()`, `handleNotificationResponse()` (navigation on tap)
- `src/hooks/useNotifications.ts` — called in `_layout.tsx` on app launch, registers token, sets up listeners

**Token flow:**
1. App launch → `useNotifications()` → requests permission
2. Gets Expo push token → upserts into `push_tokens` table
3. Listens for incoming notifications → shows in-app or navigates

### Server (Supabase Edge Function)

**`supabase/functions/send-push/index.ts`:**
- Receives: `{ user_id, title, body, data }` via HTTP POST
- Looks up user's push token(s) from `push_tokens`
- Checks `notification_preferences` for that notification type
- Sends via Expo Push API (`https://exp.host/--/api/v2/push/send`)

**Triggers:** Database webhooks or called from client after actions:
- `follows` INSERT → notify followed user
- `comments` INSERT → notify post owner
- `likes` INSERT → notify post owner
- `recommendation_answers` INSERT → notify question poster
- `answer_upvotes` INSERT → notify answer author
- `user_badges` INSERT → notify badge earner
- Cron for event reminders (30 min before `event.date`)

### Settings Integration

Wire the notification preference toggles in `settings.tsx` to read/write `notification_preferences` table.

---

## Phase 4: Lezzet Listesi (Taste Lists)

### Database

```sql
-- 006_taste_lists.sql

CREATE TABLE IF NOT EXISTS lists (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  cover_image_url text,
  is_public boolean DEFAULT true,
  slug text UNIQUE,
  likes_count int DEFAULT 0,
  followers_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS list_venues (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id uuid REFERENCES lists(id) ON DELETE CASCADE,
  venue_id uuid REFERENCES venues(id) ON DELETE CASCADE,
  position int NOT NULL,
  note text,
  added_at timestamptz DEFAULT now(),
  UNIQUE(list_id, venue_id)
);

CREATE TABLE IF NOT EXISTS list_follows (
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  list_id uuid REFERENCES lists(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, list_id)
);

CREATE TABLE IF NOT EXISTS list_likes (
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  list_id uuid REFERENCES lists(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, list_id)
);

-- RLS
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public lists visible to all" ON lists FOR SELECT USING (is_public = true OR auth.uid() = user_id);
CREATE POLICY "Users manage own lists" ON lists FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "List venues visible with list" ON list_venues FOR SELECT USING (true);
CREATE POLICY "List owner manages venues" ON list_venues FOR ALL USING (
  EXISTS (SELECT 1 FROM lists WHERE lists.id = list_venues.list_id AND lists.user_id = auth.uid())
);
CREATE POLICY "Users manage own follows" ON list_follows FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own likes" ON list_likes FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_lists_user ON lists(user_id);
CREATE INDEX idx_lists_slug ON lists(slug);
CREATE INDEX idx_list_venues_list ON list_venues(list_id, position);
```

### Store

**New file:** `src/stores/listStore.ts`

**State:** `lists[]`, `selectedList`, `loading`, `hasMore`

**Actions:**
- `fetchUserLists(userId)` — user's lists
- `fetchPopularLists()` — for discover screen
- `fetchListById(id)` — with venues joined
- `createList(title, description, coverImage)` — +10 XP
- `updateList(id, updates)`
- `deleteList(id)`
- `addVenueToList(listId, venueId, note)`
- `removeVenueFromList(listId, venueId)`
- `reorderListVenues(listId, venueIds[])`
- `toggleListLike(listId)`
- `toggleListFollow(listId)`

### UI

**New routes:**
- `app/list/[id].tsx` — list detail: cover image, title, description, ordered venue cards with notes, like/follow/share actions
- `app/list/create.tsx` — creation form: title, description, cover image picker, venue search + add

**Modifications:**
- `profile.tsx`: add third tab "Listelerim" showing user's lists
- `venue/[id].tsx`: add "Listeye Ekle" button → bottom sheet with user's lists to pick from
- `discover.tsx`: add "Populer Listeler" horizontal section

**Share:** Generate a card view (venue thumbnails collage + list title + author) → native share to Instagram/WhatsApp. Deep link: `ony.app/list/{slug}`.

### Gamification

- New badge: "Liste Ustasi" — create 3 lists
- Add condition to `badgeChecker.ts`: count user's lists

---

## Phase 5: Yemek Buddy Matching

### Database

```sql
-- 007_buddy_matching.sql

CREATE TABLE IF NOT EXISTS meal_buddies (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  status text CHECK (status IN ('available', 'matched', 'expired')) DEFAULT 'available',
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  radius_km double precision DEFAULT 2.0,
  available_from timestamptz NOT NULL,
  available_until timestamptz NOT NULL,
  note text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS buddy_matches (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_buddy_id uuid REFERENCES meal_buddies(id) ON DELETE CASCADE,
  target_buddy_id uuid REFERENCES meal_buddies(id) ON DELETE CASCADE,
  status text CHECK (status IN ('pending', 'accepted', 'declined', 'expired')) DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS buddy_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid REFERENCES buddy_matches(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS buddy_ratings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid REFERENCES buddy_matches(id) ON DELETE CASCADE,
  rater_id uuid REFERENCES users(id) ON DELETE CASCADE,
  rating boolean NOT NULL, -- true = thumbs up, false = thumbs down
  created_at timestamptz DEFAULT now(),
  UNIQUE(match_id, rater_id)
);

-- RLS
ALTER TABLE meal_buddies ENABLE ROW LEVEL SECURITY;
ALTER TABLE buddy_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE buddy_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE buddy_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Available buddies visible to auth users" ON meal_buddies FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users manage own buddy status" ON meal_buddies FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Match participants see matches" ON buddy_matches FOR SELECT USING (
  EXISTS (SELECT 1 FROM meal_buddies WHERE meal_buddies.id IN (buddy_matches.requester_buddy_id, buddy_matches.target_buddy_id) AND meal_buddies.user_id = auth.uid())
);
CREATE POLICY "Auth users create matches" ON buddy_matches FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Match participants update" ON buddy_matches FOR UPDATE USING (
  EXISTS (SELECT 1 FROM meal_buddies WHERE meal_buddies.id = buddy_matches.target_buddy_id AND meal_buddies.user_id = auth.uid())
);
CREATE POLICY "Match participants see messages" ON buddy_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM buddy_matches bm JOIN meal_buddies mb ON mb.id IN (bm.requester_buddy_id, bm.target_buddy_id) WHERE bm.id = buddy_messages.match_id AND mb.user_id = auth.uid())
);
CREATE POLICY "Match participants send messages" ON buddy_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users manage own ratings" ON buddy_ratings FOR ALL USING (auth.uid() = rater_id);

-- Indexes
CREATE INDEX idx_meal_buddies_active ON meal_buddies(status, available_until) WHERE status = 'available';
CREATE INDEX idx_meal_buddies_location ON meal_buddies USING gist (
  ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
);
CREATE INDEX idx_buddy_matches_status ON buddy_matches(status);
CREATE INDEX idx_buddy_messages_match ON buddy_messages(match_id, created_at);

-- Auto-expire function
CREATE OR REPLACE FUNCTION expire_old_buddies()
RETURNS void AS $$
  UPDATE meal_buddies SET status = 'expired' WHERE status = 'available' AND available_until < now();
  UPDATE buddy_matches SET status = 'expired' WHERE status = 'pending' AND created_at < now() - interval '30 minutes';
$$ LANGUAGE sql;
```

### Store

**New file:** `src/stores/buddyStore.ts`

**State:** `myBuddy`, `nearbyBuddies[]`, `activeMatch`, `messages[]`, `loading`

**Actions:**
- `goAvailable(location, timeWindow, note)` — insert into `meal_buddies`
- `goUnavailable()` — set status to 'expired'
- `fetchNearbyBuddies(lat, lng, radiusKm)` — query available buddies within radius
- `sendMatchRequest(targetBuddyId)` — insert into `buddy_matches`
- `respondToMatch(matchId, accept: boolean)` — update status
- `fetchMessages(matchId)` — buddy chat messages
- `sendMessage(matchId, content)` — insert message
- `subscribeToMessages(matchId)` — Supabase Realtime (reuse pattern from Phase 2)
- `rateBuddy(matchId, thumbsUp: boolean)` — +20 XP if rating given
- `subscribeToMatchUpdates()` — listen for incoming match requests

### UI

**New routes:**
- `app/buddy.tsx` — main buddy screen
  - If not available: "Yemek Arkadasi Ara" form (location auto-filled, time window picker, note input)
  - If available: mini-map showing nearby available buddies as pins, each with avatar + note
  - Tap a buddy → profile preview bottom sheet + "Bulusma Iste" button
  - If matched: chat interface (reuse event chat MessageBubble component)
- `app/buddy/[id].tsx` — buddy chat room (if needed as separate route)

**Entry points:**
- Map screen: floating "Buddy" FAB button (fork/spoon people icon)
- Feed header: "Yalniz yemek yeme!" banner when no active buddy session

**Match flow UI:**
1. Incoming match request → push notification + in-app alert
2. Accept → both users enter buddy chat
3. After time window expires → "Nasil gecti?" rating prompt
4. Thumbs up/down → XP awarded → session closed

### Gamification

- New badge: "Sosyal Kelebek" — match with 5 different buddies
- +20 XP per completed buddy meetup (both users rate)
- Add conditions to `badgeChecker.ts`

---

## New Badge Summary

| Badge | Condition | Threshold |
|-------|-----------|-----------|
| Liste Ustasi | lists_created | 3 |
| Sosyal Kelebek | buddy_matches_completed | 5 |

---

## Migration Order

1. `004_quick_wins.sql` — last_active_date, bookmarks
2. `005_push_notifications.sql` — push_tokens, notification_preferences
3. `006_taste_lists.sql` — lists, list_venues, list_follows, list_likes
4. `007_buddy_matching.sql` — meal_buddies, buddy_matches, buddy_messages, buddy_ratings
