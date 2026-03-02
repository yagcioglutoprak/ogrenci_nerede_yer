-- ==========================================
-- Ogrenci Nerede Yer? - Initial Database Schema
-- Supabase / PostgreSQL Migration
-- ==========================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- 1. USERS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email       TEXT NOT NULL,
  username    TEXT NOT NULL UNIQUE,
  full_name   TEXT NOT NULL,
  avatar_url  TEXT,
  university  TEXT,
  bio         TEXT,
  xp_points   INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 2. VENUES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.venues (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     TEXT NOT NULL,
  description              TEXT,
  latitude                 DOUBLE PRECISION NOT NULL,
  longitude                DOUBLE PRECISION NOT NULL,
  address                  TEXT NOT NULL,
  phone                    TEXT,
  price_range              INTEGER NOT NULL CHECK (price_range BETWEEN 1 AND 4),
  is_verified              BOOLEAN NOT NULL DEFAULT FALSE,
  youtube_video_url        TEXT,
  avg_taste_rating         NUMERIC(3,2) NOT NULL DEFAULT 0,
  avg_value_rating         NUMERIC(3,2) NOT NULL DEFAULT 0,
  avg_friendliness_rating  NUMERIC(3,2) NOT NULL DEFAULT 0,
  overall_rating           NUMERIC(3,2) NOT NULL DEFAULT 0,
  total_reviews            INTEGER NOT NULL DEFAULT 0,
  level                    INTEGER NOT NULL DEFAULT 1,
  cover_image_url          TEXT,
  tags                     TEXT[] NOT NULL DEFAULT '{}',
  created_by               UUID NOT NULL REFERENCES public.users(id),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 3. REVIEWS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.reviews (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id            UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES public.users(id),
  taste_rating        INTEGER NOT NULL CHECK (taste_rating BETWEEN 1 AND 5),
  value_rating        INTEGER NOT NULL CHECK (value_rating BETWEEN 1 AND 5),
  friendliness_rating INTEGER NOT NULL CHECK (friendliness_rating BETWEEN 1 AND 5),
  comment             TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (venue_id, user_id)
);

-- ==========================================
-- 4. POSTS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.posts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.users(id),
  venue_id   UUID REFERENCES public.venues(id),
  caption    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 5. POST_IMAGES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.post_images (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id   UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  "order"   INTEGER NOT NULL DEFAULT 0
);

-- ==========================================
-- 6. LIKES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.likes (
  user_id    UUID NOT NULL REFERENCES public.users(id),
  post_id    UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

-- ==========================================
-- 7. COMMENTS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.users(id),
  text       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==========================================
-- 8. FAVORITES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.favorites (
  user_id    UUID NOT NULL REFERENCES public.users(id),
  venue_id   UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, venue_id)
);

-- ==========================================
-- 9. FOLLOWS
-- ==========================================
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id  UUID NOT NULL REFERENCES public.users(id),
  following_id UUID NOT NULL REFERENCES public.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- ==========================================
-- 10. BADGES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.badges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT NOT NULL,
  icon_name       TEXT NOT NULL,
  condition_type  TEXT NOT NULL,
  condition_value INTEGER NOT NULL,
  color           TEXT NOT NULL
);

-- ==========================================
-- 11. USER_BADGES
-- ==========================================
CREATE TABLE IF NOT EXISTS public.user_badges (
  user_id   UUID NOT NULL REFERENCES public.users(id),
  badge_id  UUID NOT NULL REFERENCES public.badges(id),
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, badge_id)
);


-- ==========================================
-- INDEXES
-- ==========================================

-- Venues: geo queries, rating sort, creator lookup
CREATE INDEX idx_venues_lat_lng       ON public.venues (latitude, longitude);
CREATE INDEX idx_venues_overall_rating ON public.venues (overall_rating DESC);
CREATE INDEX idx_venues_created_by    ON public.venues (created_by);

-- Reviews: lookup by venue and by user
CREATE INDEX idx_reviews_venue_id ON public.reviews (venue_id);
CREATE INDEX idx_reviews_user_id  ON public.reviews (user_id);

-- Posts: user feed, venue posts, chronological listing
CREATE INDEX idx_posts_user_id    ON public.posts (user_id);
CREATE INDEX idx_posts_venue_id   ON public.posts (venue_id);
CREATE INDEX idx_posts_created_at ON public.posts (created_at DESC);

-- Likes: count per post
CREATE INDEX idx_likes_post_id ON public.likes (post_id);

-- Comments: per post
CREATE INDEX idx_comments_post_id ON public.comments (post_id);

-- Favorites: per user
CREATE INDEX idx_favorites_user_id ON public.favorites (user_id);

-- Follows: follower and following lookups
CREATE INDEX idx_follows_follower_id  ON public.follows (follower_id);
CREATE INDEX idx_follows_following_id ON public.follows (following_id);


-- ==========================================
-- ROW LEVEL SECURITY
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE public.users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venues      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------
-- USERS policies
-- ------------------------------------------
CREATE POLICY "Users: anyone can read"
  ON public.users FOR SELECT
  USING (true);

CREATE POLICY "Users: can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users: can insert own row"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ------------------------------------------
-- VENUES policies
-- ------------------------------------------
CREATE POLICY "Venues: anyone can read"
  ON public.venues FOR SELECT
  USING (true);

CREATE POLICY "Venues: authenticated can insert"
  ON public.venues FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Venues: creator can update"
  ON public.venues FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- ------------------------------------------
-- REVIEWS policies
-- ------------------------------------------
CREATE POLICY "Reviews: anyone can read"
  ON public.reviews FOR SELECT
  USING (true);

CREATE POLICY "Reviews: authenticated can insert own"
  ON public.reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Reviews: user can update own"
  ON public.reviews FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Reviews: user can delete own"
  ON public.reviews FOR DELETE
  USING (auth.uid() = user_id);

-- ------------------------------------------
-- POSTS policies
-- ------------------------------------------
CREATE POLICY "Posts: anyone can read"
  ON public.posts FOR SELECT
  USING (true);

CREATE POLICY "Posts: authenticated can insert own"
  ON public.posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Posts: user can delete own"
  ON public.posts FOR DELETE
  USING (auth.uid() = user_id);

-- ------------------------------------------
-- POST_IMAGES policies
-- ------------------------------------------
CREATE POLICY "Post images: anyone can read"
  ON public.post_images FOR SELECT
  USING (true);

CREATE POLICY "Post images: post owner can insert"
  ON public.post_images FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.posts
      WHERE posts.id = post_id AND posts.user_id = auth.uid()
    )
  );

-- ------------------------------------------
-- LIKES policies
-- ------------------------------------------
CREATE POLICY "Likes: anyone can read"
  ON public.likes FOR SELECT
  USING (true);

CREATE POLICY "Likes: authenticated can insert own"
  ON public.likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Likes: user can delete own"
  ON public.likes FOR DELETE
  USING (auth.uid() = user_id);

-- ------------------------------------------
-- COMMENTS policies
-- ------------------------------------------
CREATE POLICY "Comments: anyone can read"
  ON public.comments FOR SELECT
  USING (true);

CREATE POLICY "Comments: authenticated can insert own"
  ON public.comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Comments: user can delete own"
  ON public.comments FOR DELETE
  USING (auth.uid() = user_id);

-- ------------------------------------------
-- FAVORITES policies
-- ------------------------------------------
CREATE POLICY "Favorites: user can read own"
  ON public.favorites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Favorites: user can insert own"
  ON public.favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Favorites: user can delete own"
  ON public.favorites FOR DELETE
  USING (auth.uid() = user_id);

-- ------------------------------------------
-- FOLLOWS policies
-- ------------------------------------------
CREATE POLICY "Follows: anyone can read"
  ON public.follows FOR SELECT
  USING (true);

CREATE POLICY "Follows: authenticated can insert own"
  ON public.follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Follows: user can delete own"
  ON public.follows FOR DELETE
  USING (auth.uid() = follower_id);

-- ------------------------------------------
-- BADGES policies (read-only for all)
-- ------------------------------------------
CREATE POLICY "Badges: anyone can read"
  ON public.badges FOR SELECT
  USING (true);

-- ------------------------------------------
-- USER_BADGES policies
-- ------------------------------------------
CREATE POLICY "User badges: anyone can read"
  ON public.user_badges FOR SELECT
  USING (true);

CREATE POLICY "User badges: system can insert"
  ON public.user_badges FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- ==========================================
-- SEED: BADGES
-- ==========================================
INSERT INTO public.badges (name, description, icon_name, condition_type, condition_value, color) VALUES
  ('Ilk Adim',          'Ilk mekanini ekledin!',                         'footsteps-outline',   'venues_added',     1,   '#22C55E'),
  ('Kasif',             '10 mekan ekleyerek kasif oldun!',               'compass-outline',     'venues_added',     10,  '#3B82F6'),
  ('Gurme Ogrenci',     '20+ mekan ekledin, gercek bir gurmesin!',       'restaurant-outline',  'venues_added',     20,  '#FBBF24'),
  ('Sozcu',             '30+ degerlendirme yazdin!',                     'chatbubbles-outline', 'reviews_written',  30,  '#8B5CF6'),
  ('Fotografci',        '50+ gonderi paylastin!',                        'camera-outline',      'posts_created',    50,  '#EC4899'),
  ('Trend Belirleyici', '100+ begeni aldin, trend belirleyicisin!',      'trending-up-outline', 'likes_received',   100, '#EF4444'),
  ('Sadik Gurme',       '30 gun ust uste aktif kaldin!',                 'flame-outline',       'streak_days',      30,  '#F59E0B');
