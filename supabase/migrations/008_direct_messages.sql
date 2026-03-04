-- ============================================================
-- 008: Direct Messages
-- ============================================================

-- Conversations: one row per user pair
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  participant_2 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_message_text TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_sender_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT participants_ordered CHECK (participant_1 < participant_2),
  CONSTRAINT unique_conversation UNIQUE (participant_1, participant_2)
);

-- Direct messages within a conversation
CREATE TABLE IF NOT EXISTS direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_conversations_participant_1 ON conversations(participant_1);
CREATE INDEX idx_conversations_participant_2 ON conversations(participant_2);
CREATE INDEX idx_conversations_last_message_at ON conversations(last_message_at DESC);
CREATE INDEX idx_direct_messages_conversation_created ON direct_messages(conversation_id, created_at);
CREATE INDEX idx_direct_messages_unread ON direct_messages(conversation_id, is_read) WHERE is_read = FALSE;

-- RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- Conversations: participants only
CREATE POLICY "conversations_select" ON conversations
  FOR SELECT USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

CREATE POLICY "conversations_insert" ON conversations
  FOR INSERT WITH CHECK (auth.uid() = participant_1 OR auth.uid() = participant_2);

CREATE POLICY "conversations_update" ON conversations
  FOR UPDATE USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

-- Direct messages: participants of the conversation only
CREATE POLICY "dm_select" ON direct_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = direct_messages.conversation_id
        AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
    )
  );

CREATE POLICY "dm_insert" ON direct_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = direct_messages.conversation_id
        AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
    )
  );

-- Recipients can mark messages as read
CREATE POLICY "dm_update_read" ON direct_messages
  FOR UPDATE USING (
    sender_id != auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = direct_messages.conversation_id
        AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
    )
  );

-- RPC: get or create conversation atomically
CREATE OR REPLACE FUNCTION get_or_create_conversation(user_a UUID, user_b UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  p1 UUID;
  p2 UUID;
  conv_id UUID;
BEGIN
  -- Order participants
  IF user_a < user_b THEN
    p1 := user_a; p2 := user_b;
  ELSE
    p1 := user_b; p2 := user_a;
  END IF;

  -- Try to find existing
  SELECT id INTO conv_id FROM conversations
    WHERE participant_1 = p1 AND participant_2 = p2;

  IF conv_id IS NOT NULL THEN
    RETURN conv_id;
  END IF;

  -- Create new
  INSERT INTO conversations (participant_1, participant_2)
    VALUES (p1, p2)
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
