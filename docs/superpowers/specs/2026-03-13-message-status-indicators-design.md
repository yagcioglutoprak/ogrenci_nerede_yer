# Message Status Indicators — Design Spec

## Goal

Replace the binary `is_read` field on direct messages with a proper status state machine (`sending` → `sent` → `seen`) so users see real-time delivery/read receipts like WhatsApp.

## Status States

| Status | Meaning | Icon | Color |
|--------|---------|------|-------|
| `sending` | Optimistic local message, not yet persisted | Clock (`time-outline`) | Dimmed white (own) |
| `sent` | Server confirmed (row exists in Supabase) | Single checkmark (`checkmark`) | Dimmed white (own) |
| `seen` | Recipient opened the chat and viewed it | Double checkmark (`checkmark-done`) | Accent/blue tint |

**Note:** `delivered` is omitted for now — without background push receipt tracking, there's no reliable way to know the message reached the device vs. just the server. Can be added later without schema changes (it's just another enum value).

## Database Changes

### Migration: `010_message_status.sql`

1. Add `status` column as `text` with default `'sent'` and CHECK constraint for `('sending', 'sent', 'seen')`.
2. Backfill: `UPDATE direct_messages SET status = 'seen' WHERE is_read = true`.
3. Drop `is_read` column.
4. Add index on `(conversation_id, status)` for efficient "mark as seen" queries.

## Type Changes

### `types/index.ts`

- Add: `export type MessageStatus = 'sending' | 'sent' | 'seen';`
- `DirectMessage`: replace `is_read: boolean` with `status: MessageStatus`

## Store Changes (`messageStore.ts`)

### `sendMessage`

- Optimistic message created with `status: 'sending'`
- After Supabase insert succeeds, replace with persisted row (which has `status: 'sent'` from DB default)

### `markAsSeen` (renamed from `markAsRead`)

- Batch-update all messages in conversation where `sender_id !== myId` and `status !== 'seen'` to `status: 'seen'`
- Optimistic: update local state immediately
- Supabase: `UPDATE direct_messages SET status = 'seen' WHERE conversation_id = X AND sender_id != myId AND status != 'seen'`

### `subscribeToMessages`

- Listen for both `INSERT` (new messages) and `UPDATE` (status changes) events on `direct_messages`
- On `UPDATE`: merge the status change into local messages array so sender sees ticks update in real-time

### `fetchConversations` / `fetchUnreadCount`

- Replace `is_read = false` checks with `status != 'seen'`

## UI Changes

### `chat/[id].tsx` — Text bubble meta

Replace current logic:
```tsx
{isOwn && item.is_read && (
  <Ionicons name="checkmark-done" ... />
)}
```

With a `MessageStatusIcon` component that renders based on `item.status`:
- `sending`: `<Ionicons name="time-outline" size={13} />`
- `sent`: `<Ionicons name="checkmark" size={13} />`
- `seen`: `<Ionicons name="checkmark-done" size={13} />` with accent color

### `ImageBubble.tsx` / `VenueBubble.tsx`

Same pattern — replace `isRead` prop with `status: MessageStatus` prop, render the appropriate icon.

### Conversation list (`messages.tsx`)

- Last message in conversation list: show status icon next to timestamp if `last_message_sender_id === currentUser.id`
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
