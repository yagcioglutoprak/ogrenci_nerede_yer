# Message Status Indicators — Design Spec

## Goal

Replace the binary `is_read` field on direct messages with a proper status state machine (`sending` → `sent` → `seen`) so users see real-time delivery/read receipts like WhatsApp.

## Status States

| Status | Meaning | Icon | Color | Persisted? |
|--------|---------|------|-------|------------|
| `sending` | Optimistic local message, not yet persisted | Clock (`time-outline`) | Dimmed white (own) | Client-only |
| `sent` | Server confirmed (row exists in Supabase) | Single checkmark (`checkmark`) | Dimmed white (own) | Yes (DB default) |
| `seen` | Recipient opened the chat and viewed it | Double checkmark (`checkmark-done`) | Accent/blue tint | Yes |

**Note:** `delivered` is omitted for now — without background push receipt tracking, there's no reliable way to know the message reached the device vs. just the server. Can be added later without schema changes (it's just another enum value).

## Database Changes

### Migration 1: `012_message_status.sql`

1. Add `status` column as `text` with default `'sent'` and CHECK constraint for `('sent', 'seen')` — `'sending'` is client-only and never persisted.
2. Backfill: `UPDATE direct_messages SET status = 'seen' WHERE is_read = true`. Messages where `is_read = false` get the column default `'sent'` automatically.
3. Add `last_message_status` column to `conversations` table (default `'sent'`).
4. Backfill conversations: set `last_message_status` based on last message's new status.
5. Add index on `(conversation_id, status)` for efficient "mark as seen" queries.
6. Leave `is_read` in place for backwards compatibility during deploy.

### Migration 2: `013_drop_is_read.sql` (deployed after new app code is fully rolled out)

1. Drop `is_read` column from `direct_messages`.
2. Drop the existing partial index `idx_direct_messages_unread` (from `008_direct_messages.sql`).
3. Rename RLS policy `dm_update_read` to `dm_update_status` (cosmetic, existing policy logic is already correct — only recipient can update).

**RLS note:** The existing `dm_update_read` policy restricts UPDATE to `sender_id != auth.uid()`, which is correct for `markAsSeen` (recipient marks sender's messages). No policy changes needed for functionality.

## Type Changes

### `types/index.ts`

- Add: `export type MessageStatus = 'sending' | 'sent' | 'seen';`
- `DirectMessage`: replace `is_read: boolean` with `status: MessageStatus`
- `Conversation`: add `last_message_status?: MessageStatus`

## Store Changes (`messageStore.ts`)

### `sendMessage`

- Optimistic message created with `status: 'sending'`
- After Supabase insert succeeds, replace with persisted row (which has `status: 'sent'` from DB default)
- Update conversation's `last_message_status` to `'sent'` alongside `last_message_text`

### `markAsSeen` (renamed from `markAsRead`)

- Batch-update all messages in conversation where `sender_id !== myId` and `status !== 'seen'` to `status: 'seen'`
- Optimistic: update local state immediately
- Supabase: `UPDATE direct_messages SET status = 'seen' WHERE conversation_id = X AND sender_id != myId AND status != 'seen'`
- Call sites that need renaming: `chat/[id].tsx` line 90 (on mount) and line 420 (after accepting request)

### `subscribeToMessages`

- Listen for both `INSERT` (new messages) and `UPDATE` (status changes) events on `direct_messages`
- On `UPDATE`: merge only the `status` field into the existing message object to preserve the joined `user` profile data:
  ```ts
  set({
    messages: get().messages.map((m) =>
      m.id === payload.new.id ? { ...m, status: payload.new.status } : m
    ),
  });
  ```

### `fetchConversations` / `fetchUnreadCount`

- Both methods query with `.eq('is_read', false)` — replace with `.neq('status', 'seen')` in both:
  - `fetchConversations`: unread count subqueries (line ~76)
  - `fetchUnreadCount`: total unread count query (line ~394)

## UI Changes

### `MessageStatusIcon` — inline helper in `chat/[id].tsx`

Renders based on `status`:
- `sending`: `<Ionicons name="time-outline" size={13} />`
- `sent`: `<Ionicons name="checkmark" size={13} />`
- `seen`: `<Ionicons name="checkmark-done" size={13} />` with accent color

Only rendered when `isOwn === true`.

### `chat/[id].tsx` — Text bubble meta

Replace:
```tsx
{isOwn && item.is_read && (
  <Ionicons name="checkmark-done" ... />
)}
```
With: `{isOwn && <MessageStatusIcon status={item.status} />}`

### `ImageBubble.tsx` / `VenueBubble.tsx`

Replace `isRead?: boolean` prop with `status?: MessageStatus` prop, render `MessageStatusIcon`.

### `MessageBubble.tsx`

Not affected — this component is for event group chat (`EventMessage` type), not direct messages.

### Conversation list (`messages.tsx`)

- Show status icon next to last message timestamp when `last_message_sender_id === currentUser.id`, using `conv.last_message_status`
- Unread badge logic: count messages where `status !== 'seen'` (unchanged behavior, different field name)

## Real-time Flow

```
Sender types → [sending] optimistic insert
             → Supabase INSERT succeeds → [sent] replace optimistic
             → Recipient opens chat → batch UPDATE to [seen]
             → Supabase Realtime fires UPDATE event
             → Sender's subscription picks it up → ticks turn blue ✓✓
```

## Mock Data

- Update `MOCK_DIRECT_MESSAGES` in `mockData.ts`: replace `is_read` with `status` field
- Update `MOCK_CONVERSATIONS` unread_count logic if needed

## Edge Cases

- **Offline/failed send**: Message stays at `sending`. Could add retry UI later, but for now it just sits there (same as current behavior where optimistic message stays).
- **Multiple unseen messages**: `markAsSeen` batch-updates all at once when chat is opened.
- **Realtime subscription race**: If recipient opens chat before subscription is set up, the `markAsSeen` call on mount handles it. Subscription is just for live updates while both users are in the chat.
