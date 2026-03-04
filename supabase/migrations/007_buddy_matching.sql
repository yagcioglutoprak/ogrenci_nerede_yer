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
  rating boolean NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(match_id, rater_id)
);

-- RLS
ALTER TABLE meal_buddies ENABLE ROW LEVEL SECURITY;
ALTER TABLE buddy_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE buddy_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE buddy_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Available buddies visible to auth users" ON meal_buddies
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users manage own buddy status" ON meal_buddies
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Match participants see matches" ON buddy_matches
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM meal_buddies
      WHERE meal_buddies.id IN (buddy_matches.requester_buddy_id, buddy_matches.target_buddy_id)
      AND meal_buddies.user_id = auth.uid()
    )
  );
CREATE POLICY "Auth users create matches" ON buddy_matches
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Match participants update" ON buddy_matches
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM meal_buddies
      WHERE meal_buddies.id = buddy_matches.target_buddy_id
      AND meal_buddies.user_id = auth.uid()
    )
  );

CREATE POLICY "Match participants see messages" ON buddy_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM buddy_matches bm
      JOIN meal_buddies mb ON mb.id IN (bm.requester_buddy_id, bm.target_buddy_id)
      WHERE bm.id = buddy_messages.match_id AND mb.user_id = auth.uid()
    )
  );
CREATE POLICY "Match participants send messages" ON buddy_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users manage own ratings" ON buddy_ratings
  FOR ALL USING (auth.uid() = rater_id);

-- Indexes
CREATE INDEX idx_meal_buddies_active ON meal_buddies(status, available_until) WHERE status = 'available';
CREATE INDEX idx_buddy_matches_status ON buddy_matches(status);
CREATE INDEX idx_buddy_messages_match ON buddy_messages(match_id, created_at);

-- Seed badge
INSERT INTO badges (name, description, icon_name, condition_type, condition_value, color)
VALUES ('Sosyal Kelebek', '5 farkli kisiyle yemek ye', 'people', 'buddy_matches_completed', 5, '#06B6D4')
ON CONFLICT DO NOTHING;

-- Unique constraint to prevent duplicate match requests
CREATE UNIQUE INDEX IF NOT EXISTS idx_buddy_matches_unique_pair
  ON buddy_matches(requester_buddy_id, target_buddy_id)
  WHERE status IN ('pending', 'accepted');

-- Allow requester to withdraw/expire their own match requests
CREATE POLICY "Requester can update own matches" ON buddy_matches
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM meal_buddies
      WHERE meal_buddies.id = buddy_matches.requester_buddy_id
      AND meal_buddies.user_id = auth.uid()
    )
  );
