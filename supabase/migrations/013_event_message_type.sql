-- Add message_type column to event_messages for system messages (e.g., join notifications)
ALTER TABLE public.event_messages
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'system'));
