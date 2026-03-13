-- ============================================
-- Migration 012: Message Status Indicators
-- Replace boolean is_read with status enum
-- ============================================

-- Step 1: Add status column with default 'sent'
ALTER TABLE direct_messages
  ADD COLUMN status text NOT NULL DEFAULT 'sent'
  CONSTRAINT dm_status_check CHECK (status IN ('sent', 'seen'));

-- Step 2: Backfill — messages already read become 'seen'
UPDATE direct_messages SET status = 'seen' WHERE is_read = true;

-- Step 3: Add last_message_status to conversations
ALTER TABLE conversations
  ADD COLUMN last_message_status text NOT NULL DEFAULT 'sent'
  CONSTRAINT conv_last_msg_status_check CHECK (last_message_status IN ('sent', 'seen'));

-- Step 4: Backfill conversations based on latest message status
UPDATE conversations c
SET last_message_status = COALESCE(
  (SELECT dm.status
   FROM direct_messages dm
   WHERE dm.conversation_id = c.id
   ORDER BY dm.created_at DESC
   LIMIT 1),
  'sent'
);

-- Step 5: Index for efficient "mark as seen" queries
CREATE INDEX idx_dm_conversation_status
  ON direct_messages (conversation_id, status)
  WHERE status = 'sent';

-- Note: is_read column is intentionally kept for backwards compatibility.
-- It will be dropped in migration 013 after the new app code is fully deployed.
