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

ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public lists visible to all" ON lists FOR SELECT USING (is_public = true OR auth.uid() = user_id);
CREATE POLICY "Users manage own lists" ON lists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own lists" ON lists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own lists" ON lists FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "List venues visible with list" ON list_venues FOR SELECT USING (true);
CREATE POLICY "List owner manages venues" ON list_venues FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM lists WHERE lists.id = list_venues.list_id AND lists.user_id = auth.uid())
);
CREATE POLICY "List owner updates venues" ON list_venues FOR UPDATE USING (
  EXISTS (SELECT 1 FROM lists WHERE lists.id = list_venues.list_id AND lists.user_id = auth.uid())
);
CREATE POLICY "List owner deletes venues" ON list_venues FOR DELETE USING (
  EXISTS (SELECT 1 FROM lists WHERE lists.id = list_venues.list_id AND lists.user_id = auth.uid())
);

CREATE POLICY "Users manage own follows" ON list_follows FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own likes" ON list_likes FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_lists_user ON lists(user_id);
CREATE INDEX idx_lists_slug ON lists(slug);
CREATE INDEX idx_list_venues_list ON list_venues(list_id, position);

-- Seed badge
INSERT INTO badges (name, description, icon_name, condition_type, condition_value, color)
VALUES ('Liste Ustasi', '3 liste olustur', 'list', 'lists_created', 3, '#F97316')
ON CONFLICT DO NOTHING;
