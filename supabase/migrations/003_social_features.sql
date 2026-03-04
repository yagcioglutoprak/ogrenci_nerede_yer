-- ==========================================
-- Social Platform Features Migration
-- ==========================================

-- Add post_type and expires_at to posts
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS post_type TEXT NOT NULL DEFAULT 'discovery'
    CHECK (post_type IN ('discovery', 'meetup', 'question', 'moment')),
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_posts_post_type ON public.posts (post_type);
CREATE INDEX IF NOT EXISTS idx_posts_expires_at ON public.posts (expires_at)
  WHERE expires_at IS NOT NULL;

-- ==========================================
-- EVENTS
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
-- EVENT MESSAGES
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
-- RECOMMENDATION ANSWERS
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
-- RLS
-- ==========================================
ALTER TABLE public.events             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_attendees    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendation_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer_upvotes     ENABLE ROW LEVEL SECURITY;

-- Events
CREATE POLICY "Events: anyone can read" ON public.events FOR SELECT USING (true);
CREATE POLICY "Events: authenticated can insert own" ON public.events FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Events: creator can update" ON public.events FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "Events: creator can delete" ON public.events FOR DELETE USING (auth.uid() = creator_id);

-- Event attendees
CREATE POLICY "Event attendees: anyone can read" ON public.event_attendees FOR SELECT USING (true);
CREATE POLICY "Event attendees: authenticated can join" ON public.event_attendees FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Event attendees: user can leave" ON public.event_attendees FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Event attendees: user can update own" ON public.event_attendees FOR UPDATE USING (auth.uid() = user_id);

-- Event messages (only attendees can read/write)
CREATE POLICY "Event messages: attendees can read" ON public.event_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.event_attendees ea WHERE ea.event_id = event_messages.event_id AND ea.user_id = auth.uid()));
CREATE POLICY "Event messages: attendees can insert" ON public.event_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.event_attendees ea WHERE ea.event_id = event_messages.event_id AND ea.user_id = auth.uid()));

-- Recommendation answers
CREATE POLICY "Rec answers: anyone can read" ON public.recommendation_answers FOR SELECT USING (true);
CREATE POLICY "Rec answers: authenticated can insert" ON public.recommendation_answers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Rec answers: user can update own" ON public.recommendation_answers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Rec answers: user can delete own" ON public.recommendation_answers FOR DELETE USING (auth.uid() = user_id);

-- Answer upvotes
CREATE POLICY "Answer upvotes: anyone can read" ON public.answer_upvotes FOR SELECT USING (true);
CREATE POLICY "Answer upvotes: authenticated can insert" ON public.answer_upvotes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Answer upvotes: user can delete own" ON public.answer_upvotes FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- Update posts_with_counts view
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
  ('Sosyal Kelebek',     '5 bulusmaya katildin!',               'people-outline',     'meetups_attended',  5,  '#06B6D4'),
  ('Bulusma Lideri',     '3 bulusma organize ettin!',           'megaphone-outline',  'meetups_organized', 3,  '#8B5CF6'),
  ('Anlik Paylasimci',   '10 anlik paylasim yaptin!',           'flash-outline',      'moments_shared',   10, '#F97316'),
  ('Lezzet Rehberi',     '20 oneri oylamasi aldin!',            'star-outline',       'upvotes_received', 20, '#EAB308');
