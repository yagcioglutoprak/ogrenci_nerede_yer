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

CREATE POLICY "Users manage own tokens"
  ON push_tokens FOR ALL
  USING (auth.uid() = user_id);

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

CREATE POLICY "Users manage own preferences"
  ON notification_preferences FOR ALL
  USING (auth.uid() = user_id);
