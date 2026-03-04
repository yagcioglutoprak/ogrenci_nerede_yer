-- ============================================================
-- 009: Message Types (image, venue sharing in DMs)
-- ============================================================

ALTER TABLE direct_messages
  ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
