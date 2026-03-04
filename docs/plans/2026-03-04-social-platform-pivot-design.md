# Social Platform Pivot — Design Document

**Date**: 2026-03-04
**Status**: Approved

## Vision

Transform from "restaurant review app" to "student social platform where food & places bring people together." Restaurants/cafes are the hook — the real product is meeting people and sharing authentic experiences.

**Vibe**: BeReal meets food. Authentic, casual, community-driven.
**Target**: All university students in Istanbul.
**Revenue**: Restaurant partnerships (later phase).

---

## Core Feature: Mixed-Content Feed

The feed becomes the social hub with 4 post types:

| Type | Turkish | Description |
|------|---------|-------------|
| Discovery | Kesif | "I found this place" — current food posts |
| Meetup | Bulusma | "Friday 8pm Kadikoy kebab, who's in?" — event in feed |
| Question | Oneri | "Best cigkofte near Besiktas?" — community Q&A |
| Moment | Anlik | BeReal-style "eating here right now" with live location |

All show in the same feed. Filter chips toggle between types. Events have special cards with date/time, attendee avatars, and "Katil" (Join) button.

### Post Type Schema

Extend existing `posts` table with a `post_type` field:
- `discovery` (default — existing behavior)
- `meetup`
- `question`
- `moment`

---

## Feature: Bulusma (Meetups)

### Creating
- Pick venue (from map/search) or custom location
- Set date, time, max attendees
- Description ("Yeni acilan ramen mekanini deneyelim!")
- Public (anyone) or followers-only

### Feed Card
- Venue photo + date/time badge + attendee count ("3/6 kisi") + avatars
- One-tap "Katil" button
- When full: "Dolu" with waitlist

### After Joining
- Mini group chat for logistics
- Day-of reminder notification
- Post-meetup prompt to share group photo

### Database

```sql
-- Events table
CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  location_name TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  event_date TIMESTAMPTZ NOT NULL,
  max_attendees INTEGER DEFAULT 10,
  is_public BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'upcoming' CHECK (status IN ('upcoming','active','completed','cancelled')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Event attendees
CREATE TABLE event_attendees (
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed','waitlisted','cancelled')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

-- Event chat messages
CREATE TABLE event_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Feature: Anlik (Moments)

- Quick photo of what you're eating RIGHT NOW
- Auto-tags location
- "su an burada" live badge in feed
- Disappears from main feed after 24h (stays on profile)
- Nearby users see it, can say "Ben de geliyorum!"

### Implementation
- Uses existing `posts` table with `post_type = 'moment'`
- Add `expires_at TIMESTAMPTZ` column to posts
- Feed query filters out expired moments
- Profile query shows all moments (no expiry filter)

---

## Feature: Oneri (Questions)

- "Taksim'de en iyi hamburgerci?" — community answers with venue links
- "Vegan mekan bilen var mi Kadikoy?" — tagged by area
- Best answers upvoted, top answer venue gets "Topluluk Onerisi" badge

### Database

```sql
-- Answers to question posts (extends comments with venue links + upvotes)
CREATE TABLE recommendation_answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  upvotes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE answer_upvotes (
  answer_id UUID REFERENCES recommendation_answers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (answer_id, user_id)
);
```

---

## Profile Evolution

| Current | New |
|---------|-----|
| Stats: venues, reviews | Stats: bulusmalar, kesifler, arkadaslar |
| Badge section | Active auto-earning badges |
| Favorites grid | Kesif Haritam (personal map of visited places) |
| Posts tab | Tabs: Kesifler / Bulusmalar / Anlik |

### New Profile Features
- **Kesif Haritam**: Personal map showing pins of everywhere visited
- **Ortak Mekanlar**: When viewing someone's profile, see venues both visited
- **Bulusma Gecmisi**: Past meetups attended

---

## Gamification (Activate Existing System)

| Badge | Condition | Key |
|-------|-----------|-----|
| Sosyal Kelebek | Attend 5 meetups | meetups_attended |
| Kesfici | Visit 10 different venues | venues_visited |
| Lezzet Rehberi | Get 20 upvotes on answers | upvotes_received |
| Bulusma Lideri | Organize 3 meetups | meetups_organized |
| Anlik Paylasimci | Share 10 moments | moments_shared |
| Semt Uzmani | Visit 5+ venues in one neighborhood | neighborhood_expert |

XP earned from: posting (+10), attending meetups (+25), getting likes (+5), answering questions (+15), organizing events (+30).

---

## IG/YouTube Integration

| Direction | Feature |
|-----------|---------|
| IG -> App | Deep links in bio/stories to venue pages |
| App -> IG | Share cards: venue card with rating + branding |
| YouTube -> App | Venue links in video descriptions |
| App -> Content | Weekly "Trend Mekanlar" list -> IG carousel |
| UGC -> IG | Best user posts reposted to your IG |

### Share Card Design
- Venue photo + name + rating + "Ogrenci Nerede Yer'de kesfet"
- Optimized for IG story dimensions (1080x1920)
- Auto-generated via `react-native-view-shot`

---

## Navigation Changes

**Current**: Harita / Kesfet / [+] / Profil (4 tabs)

**New**: Harita / Akis / [+] / Kesfet / Profil (5 tabs)

- **Harita** — map with venue pins + meetup pins
- **Akis** — mixed-content social feed (renamed from Kesfet)
- **[+]** — create: Kesif / Bulusma / Oneri / Anlik
- **Kesfet** — discovery: trending venues, upcoming meetups, popular questions
- **Profil** — enhanced social profile

---

## Implementation Phases

### Phase 1: Social Feed Foundation
1. Add `post_type` and `expires_at` columns to posts table
2. Create events, event_attendees tables
3. Update feed to support mixed post types with filter chips
4. Create EventCard component for meetup posts in feed
5. Create QuestionCard component for question posts in feed
6. Create MomentCard component for moment posts in feed
7. Update [+] screen with post type selector (Kesif/Bulusma/Oneri/Anlik)
8. Create EventForm component
9. Create QuestionForm component
10. Create MomentCapture component (camera + quick post)
11. Wire image upload into all form submissions
12. Add IG share card generation (react-native-view-shot)
13. Activate badge earning logic (Supabase triggers)
14. Activate XP increment on user actions

### Phase 2: Meetup Experience
1. Event detail screen (event/[id].tsx)
2. Attendee list + join/leave flow
3. Event group chat (real-time with Supabase Realtime)
4. Meetup pins on map (different marker style)
5. Post-meetup group photo prompt
6. Event reminders (local notifications)
7. Event status management (upcoming -> active -> completed)

### Phase 3: Discovery & Profile
1. New Kesfet (Discovery) tab — trending, upcoming, popular
2. Recommendation answers system with upvotes
3. Kesif Haritam (personal visited-places map on profile)
4. Profile tabs: Kesifler / Bulusmalar / Anlik
5. Ortak Mekanlar (mutual venues on other user profiles)
6. 24h moment expiry in feed (keep on profile)
7. "Nearby right now" moment discovery

### Phase 4: Growth & Polish
1. Deep links (expo-linking) for IG/YouTube
2. Referral system with invite codes
3. University leaderboards (optional)
4. Push notification system
5. Restaurant partner dashboard (web)
6. Trend algorithm refinement

---

## Technical Notes

- All new tables need RLS policies matching existing patterns
- Events use Supabase Realtime for group chat
- Moments use `expires_at` filter in feed query, no actual deletion
- Share cards rendered with react-native-view-shot, shared via expo-sharing
- Badge triggers: Supabase database functions on INSERT to relevant tables
- Deep links: expo-linking with universal links config
