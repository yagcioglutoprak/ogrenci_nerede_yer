-- ============================================================
-- 011: Message Requests & User Blocks
-- ============================================================

-- 1. Conversations: add status + initiated_by
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'accepted',
  ADD COLUMN IF NOT EXISTS initiated_by UUID REFERENCES users(id);

-- Add check constraint separately (safer for ALTER)
ALTER TABLE conversations
  ADD CONSTRAINT conversations_status_check
  CHECK (status IN ('accepted', 'pending', 'rejected'));

-- Backfill existing
UPDATE conversations SET status = 'accepted' WHERE status IS NULL;

-- 2. User blocks table
CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id != blocked_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_id);

ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_blocks_select" ON user_blocks
  FOR SELECT USING (auth.uid() = blocker_id);

CREATE POLICY "user_blocks_insert" ON user_blocks
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "user_blocks_delete" ON user_blocks
  FOR DELETE USING (auth.uid() = blocker_id);

-- 3. Users: dm_privacy setting
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS dm_privacy TEXT DEFAULT 'followers_only';

ALTER TABLE users
  ADD CONSTRAINT users_dm_privacy_check
  CHECK (dm_privacy IN ('followers_only', 'everyone'));

-- 4. Conversations: add DELETE policy (scoped to pending/rejected)
CREATE POLICY "conversations_delete" ON conversations
  FOR DELETE USING (
    auth.uid() IN (participant_1, participant_2)
    AND status IN ('pending', 'rejected')
  );

-- 5. Replace conversations_select to exclude rejected
DROP POLICY IF EXISTS "conversations_select" ON conversations;
CREATE POLICY "conversations_select" ON conversations
  FOR SELECT USING (
    (auth.uid() = participant_1 OR auth.uid() = participant_2)
    AND status != 'rejected'
  );

-- 6. Update dm_insert to block inserts into rejected conversations
DROP POLICY IF EXISTS "dm_insert" ON direct_messages;
CREATE POLICY "dm_insert" ON direct_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = direct_messages.conversation_id
        AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
        AND c.status != 'rejected'
    )
  );

-- 7. Index for status queries
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);

-- 8. Replace get_or_create_conversation RPC
CREATE OR REPLACE FUNCTION get_or_create_conversation(user_a UUID, user_b UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  p1 UUID;
  p2 UUID;
  conv_id UUID;
  conv_status TEXT;
  is_blocked BOOLEAN;
  is_mutual_follow BOOLEAN;
  target_privacy TEXT;
BEGIN
  -- Order participants
  IF user_a < user_b THEN
    p1 := user_a; p2 := user_b;
  ELSE
    p1 := user_b; p2 := user_a;
  END IF;

  -- Block check (bidirectional)
  SELECT EXISTS(
    SELECT 1 FROM user_blocks
    WHERE (blocker_id = user_a AND blocked_id = user_b)
       OR (blocker_id = user_b AND blocked_id = user_a)
  ) INTO is_blocked;

  IF is_blocked THEN
    RAISE EXCEPTION 'BLOCKED';
  END IF;

  -- Try to find existing (including rejected — prevents re-creation)
  SELECT id, status INTO conv_id, conv_status FROM conversations
    WHERE participant_1 = p1 AND participant_2 = p2;

  IF conv_id IS NOT NULL THEN
    IF conv_status = 'rejected' THEN
      RAISE EXCEPTION 'REJECTED';
    END IF;
    RETURN conv_id;
  END IF;

  -- Check mutual follow
  SELECT EXISTS(
    SELECT 1 FROM follows WHERE follower_id = user_a AND following_id = user_b
  ) AND EXISTS(
    SELECT 1 FROM follows WHERE follower_id = user_b AND following_id = user_a
  ) INTO is_mutual_follow;

  -- Check receiver's privacy setting
  SELECT COALESCE(dm_privacy, 'followers_only') INTO target_privacy
    FROM users WHERE id = user_b;

  -- Create conversation with appropriate status
  INSERT INTO conversations (participant_1, participant_2, initiated_by, status)
    VALUES (p1, p2, user_a,
      CASE
        WHEN is_mutual_follow THEN 'accepted'
        WHEN target_privacy = 'everyone' THEN 'accepted'
        ELSE 'pending'
      END
    )
    ON CONFLICT (participant_1, participant_2) DO NOTHING
    RETURNING id INTO conv_id;

  -- Handle race condition
  IF conv_id IS NULL THEN
    SELECT id INTO conv_id FROM conversations
      WHERE participant_1 = p1 AND participant_2 = p2;
  END IF;

  RETURN conv_id;
END;
$$;

-- 9. Bidirectional block check RPC
CREATE OR REPLACE FUNCTION is_blocked_between(user_a UUID, user_b UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS(
    SELECT 1 FROM user_blocks
    WHERE (blocker_id = user_a AND blocked_id = user_b)
       OR (blocker_id = user_b AND blocked_id = user_a)
  );
$$;
