# DM Request & Block System — Design Spec

## Overview

Instagram-style message request system for the Mesajlar page. Non-mutual-followers' messages go to a separate request inbox. Users can accept, delete, or block. Full platform-wide block system included.

## Requirements

1. **DM Requests:** When a non-mutual-follower sends a DM, the conversation is created with `status = 'pending'` and lands in the recipient's request inbox — not their main messages.
2. **Request Actions:** Accept (moves to normal DMs), Delete (removes conversation), Block (platform-wide block + removes conversation).
3. **Content Visibility:** Recipient can see message content in the request view, but no read receipts are sent until accepted.
4. **Privacy Setting:** Default `followers_only` — only mutual followers get direct DMs. Users can change to `everyone` in settings to skip the request flow.
5. **Request UI:** "İstekler (N)" button in the Messages header, navigates to a dedicated requests list page.
6. **Block Scope:** Full platform block — DM, follow, profile viewing, feed visibility, search results all affected.

## Database Schema

### 1. `conversations` table — new columns

```sql
ALTER TABLE conversations
  ADD COLUMN status TEXT DEFAULT 'accepted'
    CHECK (status IN ('accepted', 'pending', 'blocked')),
  ADD COLUMN initiated_by UUID REFERENCES users(id);

-- Backfill existing conversations
UPDATE conversations SET status = 'accepted' WHERE status IS NULL;
```

- `status = 'accepted'`: Normal conversation (mutual followers or accepted request)
- `status = 'pending'`: Awaiting recipient approval
- `initiated_by`: The user who started the conversation (needed to determine recipient)

### 2. `user_blocks` table — new

```sql
CREATE TABLE user_blocks (
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id != blocked_id)
);

CREATE INDEX idx_user_blocks_blocker ON user_blocks(blocker_id);
CREATE INDEX idx_user_blocks_blocked ON user_blocks(blocked_id);

ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

-- Only blocker can see their own blocks
CREATE POLICY "user_blocks_select" ON user_blocks
  FOR SELECT USING (auth.uid() = blocker_id);

CREATE POLICY "user_blocks_insert" ON user_blocks
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "user_blocks_delete" ON user_blocks
  FOR DELETE USING (auth.uid() = blocker_id);
```

### 3. `users` table — new column

```sql
ALTER TABLE users
  ADD COLUMN dm_privacy TEXT DEFAULT 'followers_only'
    CHECK (dm_privacy IN ('followers_only', 'everyone'));
```

### 4. `get_or_create_conversation` RPC — updated

```sql
CREATE OR REPLACE FUNCTION get_or_create_conversation(user_a UUID, user_b UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  p1 UUID;
  p2 UUID;
  conv_id UUID;
  is_blocked BOOLEAN;
  is_mutual_follow BOOLEAN;
  target_privacy TEXT;
  initiator UUID;
  receiver UUID;
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
    RETURN NULL;
  END IF;

  -- Try to find existing
  SELECT id INTO conv_id FROM conversations
    WHERE participant_1 = p1 AND participant_2 = p2;

  IF conv_id IS NOT NULL THEN
    RETURN conv_id;
  END IF;

  -- Determine initiator/receiver
  initiator := user_a;
  receiver := user_b;

  -- Check mutual follow
  SELECT EXISTS(
    SELECT 1 FROM follows WHERE follower_id = user_a AND following_id = user_b
  ) AND EXISTS(
    SELECT 1 FROM follows WHERE follower_id = user_b AND following_id = user_a
  ) INTO is_mutual_follow;

  -- Check receiver's privacy setting
  SELECT COALESCE(dm_privacy, 'followers_only') INTO target_privacy
    FROM users WHERE id = receiver;

  -- Create conversation with appropriate status
  INSERT INTO conversations (participant_1, participant_2, initiated_by, status)
    VALUES (p1, p2, initiator,
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
```

## Store Changes

### messageStore — modifications

**New state:**
```ts
messageRequests: Conversation[]  // pending conversations
requestCount: number             // total pending request count
```

**New actions:**
```ts
fetchMessageRequests(userId: string): Promise<void>
  // SELECT from conversations WHERE status='pending' AND recipient is me

acceptRequest(convId: string): Promise<void>
  // UPDATE conversations SET status='accepted' WHERE id=convId

deleteRequest(convId: string): Promise<void>
  // DELETE from conversations WHERE id=convId

blockFromRequest(convId: string, blockedUserId: string): Promise<void>
  // INSERT into user_blocks + DELETE conversation
```

**Modified actions:**
- `fetchConversations`: adds `status = 'accepted'` filter + excludes blocked users
- `fetchOrCreateConversation`: block check before creation, returns null if blocked
- `sendMessage`: skips push notification if conversation is pending
- `subscribeToConversations`: also listens for INSERT events (new requests)

### New blockStore

```ts
interface BlockState {
  blockedUsers: string[]
  fetchBlockedUsers(userId: string): Promise<void>
  blockUser(blockerId: string, blockedId: string): Promise<void>
  unblockUser(blockerId: string, blockedId: string): Promise<void>
  isBlocked(userId: string): boolean
}
```

Loaded at app init. Used across the platform:
- `feedStore.fetchPosts` — filter out posts from blocked users
- `user/[id].tsx` — show "blocked" screen
- `venueStore` — filter reviews from blocked users
- Follow actions — prevent follow if blocked, remove existing follow on block
- Search — exclude blocked users from results

## UI Changes

### Messages Header (`messages.tsx`)

Add "İstekler (N)" button to the left of the compose button:
- Only visible when `requestCount > 0`
- Tapping navigates to `/messages/requests`
- Styled as text link with gradient badge count

### New Page: `app/messages/requests.tsx`

- Info banner at top: "Takipleşmediğin kişilerden gelen mesaj istekleri"
- FlatList of pending conversations (same card style as main messages but muted)
- Tapping a request opens `/chat/[id]` with the request action bar

### Chat Screen (`chat/[id].tsx`) Modifications

When conversation `status = 'pending'`:
- **If I am the recipient:** Bottom action bar with 3 buttons:
  - "Kabul Et" (green/primary) → `acceptRequest()`
  - "Sil" (gray) → `deleteRequest()` + navigate back
  - "Engelle" (red) → confirmation alert → `blockFromRequest()` + navigate back
  - Messages are visible but `markAsRead` is not called
- **If I am the sender:** Info banner at top: "Mesaj isteği gönderildi. Onay bekleniyor."

### Settings (`settings.tsx`) Modifications

New "Gizlilik" section after "Bildirimler":
```
Mesaj Gizliliği
  ○ Sadece takipleştiğim kişiler (varsayılan)
  ○ Herkes
```
Updates `users.dm_privacy` via Supabase.

### Platform-wide Block Effects

| Area | Effect |
|------|--------|
| Feed | Posts from blocked users hidden |
| Profile (`user/[id]`) | "Bu kullanıcıyı engelledin" screen with unblock option |
| Follow | Block removes existing mutual follows, prevents new follows |
| Search | Blocked users excluded from all search results |
| Venue reviews | Reviews from blocked users hidden |
| Buddy matching | Blocked users never matched |

## Mock Data

### New mock data additions in `mockData.ts`

- `MOCK_MESSAGE_REQUESTS`: 2-3 pending conversations from non-followed mock users
- `MOCK_BLOCKED_USERS`: Empty array (default state)
- Existing `MOCK_CONVERSATIONS` updated with `status: 'accepted'` and `initiated_by` fields

### Mutual follow simulation for mock mode

Helper function `checkMutualFollow(userA, userB)`:
- Mock mode: simulates based on a predefined follow graph in mock data
- Real mode: queries `follows` table for bidirectional relationship

## Realtime

- `subscribeToConversations` updated to listen for `INSERT` events (new pending requests bump `requestCount`)
- Accept/block actions trigger conversation status change, reflected via existing `UPDATE` subscription

## Migration File

Single migration: `010_message_requests.sql`
1. Add `status` and `initiated_by` columns to `conversations`
2. Backfill existing rows with `status = 'accepted'`
3. Create `user_blocks` table with RLS
4. Add `dm_privacy` column to `users`
5. Update `get_or_create_conversation` RPC
6. Update RLS policies on `conversations` to account for status

## New Files

- `supabase/migrations/010_message_requests.sql`
- `src/stores/blockStore.ts`
- `src/app/messages/requests.tsx`

## Modified Files

- `src/types/index.ts` — `Conversation` type + new `UserBlock` type
- `src/stores/messageStore.ts` — request state + actions + filters
- `src/app/(tabs)/messages.tsx` — header request button
- `src/app/chat/[id].tsx` — pending action bar + info banner
- `src/app/settings.tsx` — privacy setting section
- `src/lib/mockData.ts` — mock requests + updated conversations
- `src/app/user/[id].tsx` — block check + blocked screen
- `src/stores/feedStore.ts` — block filter on posts
