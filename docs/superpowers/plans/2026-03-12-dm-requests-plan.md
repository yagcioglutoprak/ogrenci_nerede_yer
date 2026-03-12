# DM Request & Block System — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Instagram-style DM requests for non-mutual-followers and platform-wide user blocking.

**Architecture:** Extend the existing `conversations` table with `status` + `initiated_by` columns, add a `user_blocks` table and `dm_privacy` user setting. New `blockStore` for cross-platform block state. Messages page gets a request inbox, chat screen gets accept/delete/block actions.

**Tech Stack:** React Native, Expo Router, Zustand, Supabase (PostgreSQL + RLS + Realtime), react-native-reanimated

**Spec:** `docs/superpowers/specs/2026-03-12-dm-requests-design.md`

---

## Chunk 1: Database & Types Foundation

### Task 1: Create migration file

**Files:**
- Create: `supabase/migrations/011_message_requests.sql`

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/011_message_requests.sql
git commit -m "feat: add migration for DM requests, user blocks, and dm_privacy"
```

---

### Task 2: Update TypeScript types

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add status and initiated_by to Conversation type**

In `src/types/index.ts`, find the `Conversation` interface (around line 308) and add:
```ts
export interface Conversation {
  id: string;
  participant_1: string;
  participant_2: string;
  last_message_text: string | null;
  last_message_at: string;
  last_message_sender_id: string | null;
  status?: 'accepted' | 'pending' | 'rejected';
  initiated_by?: string;
  created_at: string;
  // Joined
  other_user?: User;
  unread_count?: number;
}
```

- [ ] **Step 2: Add dm_privacy to User type**

In the `User` interface (around line 5), add after `created_at`:
```ts
  dm_privacy?: 'followers_only' | 'everyone';
```

- [ ] **Step 3: Add UserBlock interface**

After the `Conversation` interface, add:
```ts
export interface UserBlock {
  blocker_id: string;
  blocked_id: string;
  created_at: string;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add DM request and block types to Conversation, User, UserBlock"
```

---

### Task 3: Update mock data

**Files:**
- Modify: `src/lib/mockData.ts`

- [ ] **Step 1: Add status and initiated_by to existing MOCK_CONVERSATIONS**

Add `status: 'accepted' as const` and `initiated_by: 'u-001'` to each of the 4 existing conversation objects in `MOCK_CONVERSATIONS`.

- [ ] **Step 2: Add MOCK_MESSAGE_REQUESTS**

After `MOCK_CONVERSATIONS`, add:
```ts
// ==========================================
// MOCK MESSAGE REQUESTS (pending conversations for u-001)
// ==========================================
export const MOCK_MESSAGE_REQUESTS: Conversation[] = [
  {
    id: 'conv-req-001',
    participant_1: 'u-001',
    participant_2: 'u-006',
    last_message_text: 'Selam! Besiktas\'taki o mekani biliyor musun?',
    last_message_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    last_message_sender_id: 'u-006',
    status: 'pending',
    initiated_by: 'u-006',
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    other_user: {
      id: 'u-006',
      email: 'deniz.celik@gsu.edu.tr',
      username: 'deniz_celik',
      full_name: 'Deniz Çelik',
      avatar_url: 'https://i.pravatar.cc/150?u=deniz',
      university: 'Galatasaray Üniversitesi',
      bio: 'Sokak lezzetleri avcısı',
      xp_points: 430,
      created_at: '2025-10-20T16:00:00Z',
    },
    unread_count: 1,
  },
  {
    id: 'conv-req-002',
    participant_1: 'u-001',
    participant_2: 'u-007',
    last_message_text: 'Merhaba, senin paylastigin o doner mekanina gitmek istiyorum',
    last_message_at: new Date(Date.now() - 8 * 3600000).toISOString(),
    last_message_sender_id: 'u-007',
    status: 'pending',
    initiated_by: 'u-007',
    created_at: new Date(Date.now() - 8 * 3600000).toISOString(),
    other_user: {
      id: 'u-007',
      email: 'berk.sahin@medeniyet.edu.tr',
      username: 'berk_sahin',
      full_name: 'Berk Şahin',
      avatar_url: 'https://i.pravatar.cc/150?u=berk',
      university: 'İstanbul Medeniyet Üniversitesi',
      bio: 'Ucuz ve doyurucu mekan arayan',
      xp_points: 320,
      created_at: '2025-11-01T10:00:00Z',
    },
    unread_count: 1,
  },
  {
    id: 'conv-req-003',
    participant_1: 'u-001',
    participant_2: 'u-008',
    last_message_text: 'Heyy kahvalti icin bir yer onerir misin?',
    last_message_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    last_message_sender_id: 'u-008',
    status: 'pending',
    initiated_by: 'u-008',
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    other_user: {
      id: 'u-008',
      email: 'yagmur.dogan@bau.edu.tr',
      username: 'yagmur_dogan',
      full_name: 'Yağmur Doğan',
      avatar_url: 'https://i.pravatar.cc/150?u=yagmur',
      university: 'Bahçeşehir Üniversitesi',
      bio: 'Tatlı tutkunu, her pastaneyi denerim',
      xp_points: 290,
      created_at: '2025-11-15T13:00:00Z',
    },
    unread_count: 1,
  },
];

export const MOCK_BLOCKED_USERS: string[] = [];
```

- [ ] **Step 3: Add mock direct messages for request conversations**

Append to `MOCK_DIRECT_MESSAGES`:
```ts
  // conv-req-001: u-006 -> u-001 (pending request)
  {
    id: 'dm-req-001',
    conversation_id: 'conv-req-001',
    sender_id: 'u-006',
    content: 'Selam! Besiktas\'taki o mekani biliyor musun?',
    is_read: false,
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
  },
  // conv-req-002: u-007 -> u-001 (pending request)
  {
    id: 'dm-req-002',
    conversation_id: 'conv-req-002',
    sender_id: 'u-007',
    content: 'Merhaba, senin paylastigin o doner mekanina gitmek istiyorum',
    is_read: false,
    created_at: new Date(Date.now() - 8 * 3600000).toISOString(),
  },
  // conv-req-003: u-008 -> u-001 (pending request)
  {
    id: 'dm-req-003',
    conversation_id: 'conv-req-003',
    sender_id: 'u-008',
    content: 'Heyy kahvalti icin bir yer onerir misin?',
    is_read: false,
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/mockData.ts
git commit -m "feat: add mock message requests and blocked users data"
```

---

## Chunk 2: Stores

### Task 4: Create blockStore

**Files:**
- Create: `src/stores/blockStore.ts`

- [ ] **Step 1: Write the store**

```ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';

function isMockId(id: string): boolean {
  return id.startsWith('local-') || id.startsWith('mock-') || id.startsWith('u-');
}

interface BlockState {
  blockedUsers: string[];
  loading: boolean;

  fetchBlockedUsers: (userId: string) => Promise<void>;
  blockUser: (blockerId: string, blockedId: string) => Promise<void>;
  unblockUser: (blockerId: string, blockedId: string) => Promise<void>;
  isBlocked: (userId: string) => boolean;
  checkBlockedBetween: (userA: string, userB: string) => Promise<boolean>;
}

export const useBlockStore = create<BlockState>((set, get) => ({
  blockedUsers: [],
  loading: false,

  fetchBlockedUsers: async (userId) => {
    if (isMockId(userId)) {
      try {
        const { MOCK_BLOCKED_USERS } = await import('../lib/mockData');
        set({ blockedUsers: MOCK_BLOCKED_USERS });
      } catch {
        set({ blockedUsers: [] });
      }
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_blocks')
        .select('blocked_id')
        .eq('blocker_id', userId);

      if (error) throw error;
      set({ blockedUsers: (data || []).map((b) => b.blocked_id) });
    } catch {
      set({ blockedUsers: [] });
    }
  },

  blockUser: async (blockerId, blockedId) => {
    // Optimistic update
    set({ blockedUsers: [...get().blockedUsers, blockedId] });

    if (isMockId(blockerId)) return;

    try {
      // Insert block
      await supabase
        .from('user_blocks')
        .insert({ blocker_id: blockerId, blocked_id: blockedId });

      // Remove mutual follows
      await supabase
        .from('follows')
        .delete()
        .or(`and(follower_id.eq.${blockerId},following_id.eq.${blockedId}),and(follower_id.eq.${blockedId},following_id.eq.${blockerId})`);

      // Reject any conversation between the two
      const [p1, p2] = blockerId < blockedId ? [blockerId, blockedId] : [blockedId, blockerId];
      await supabase
        .from('conversations')
        .update({ status: 'rejected' })
        .eq('participant_1', p1)
        .eq('participant_2', p2);
    } catch {
      // Rollback optimistic update
      set({ blockedUsers: get().blockedUsers.filter((id) => id !== blockedId) });
    }
  },

  unblockUser: async (blockerId, blockedId) => {
    // Optimistic update
    set({ blockedUsers: get().blockedUsers.filter((id) => id !== blockedId) });

    if (isMockId(blockerId)) return;

    try {
      await supabase
        .from('user_blocks')
        .delete()
        .eq('blocker_id', blockerId)
        .eq('blocked_id', blockedId);
    } catch {
      // Rollback
      set({ blockedUsers: [...get().blockedUsers, blockedId] });
    }
  },

  isBlocked: (userId) => {
    return get().blockedUsers.includes(userId);
  },

  checkBlockedBetween: async (userA, userB) => {
    if (isMockId(userA) || isMockId(userB)) {
      return get().blockedUsers.includes(userB);
    }

    try {
      const { data, error } = await supabase.rpc('is_blocked_between', {
        user_a: userA,
        user_b: userB,
      });
      if (error) throw error;
      return data as boolean;
    } catch {
      return false;
    }
  },
}));
```

- [ ] **Step 2: Commit**

```bash
git add src/stores/blockStore.ts
git commit -m "feat: add blockStore with block/unblock, follow removal, conversation rejection"
```

---

### Task 5: Update messageStore with request support

**Files:**
- Modify: `src/stores/messageStore.ts`

- [ ] **Step 1: Add new state fields**

Add to the `MessageState` interface:
```ts
  messageRequests: Conversation[];
  requestCount: number;
```

Add to the initial state in `create<MessageState>`:
```ts
  messageRequests: [],
  requestCount: 0,
```

- [ ] **Step 2: Add fetchMessageRequests action**

Add to the interface:
```ts
  fetchMessageRequests: (userId: string) => Promise<void>;
```

Add to the store:
```ts
  fetchMessageRequests: async (userId) => {
    if (isMockId(userId)) {
      try {
        const { MOCK_MESSAGE_REQUESTS } = await import('../lib/mockData');
        const requests = MOCK_MESSAGE_REQUESTS.filter(
          (c) => c.initiated_by !== userId &&
            (c.participant_1 === userId || c.participant_2 === userId)
        );
        set({ messageRequests: requests, requestCount: requests.length });
      } catch {
        set({ messageRequests: [], requestCount: 0 });
      }
      return;
    }

    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*, user1:users!conversations_participant_1_fkey(*), user2:users!conversations_participant_2_fkey(*)')
        .eq('status', 'pending')
        .neq('initiated_by', userId)
        .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      const mapped: Conversation[] = (data || []).map((c: any) => ({
        id: c.id,
        participant_1: c.participant_1,
        participant_2: c.participant_2,
        last_message_text: c.last_message_text,
        last_message_at: c.last_message_at,
        last_message_sender_id: c.last_message_sender_id,
        status: c.status,
        initiated_by: c.initiated_by,
        created_at: c.created_at,
        other_user: c.participant_1 === userId ? c.user2 : c.user1,
        unread_count: 0,
      }));

      set({ messageRequests: mapped, requestCount: mapped.length });
    } catch {
      // Keep current state on error
    }
  },
```

- [ ] **Step 3: Add acceptRequest, deleteRequest, blockFromRequest actions**

Add to the interface:
```ts
  acceptRequest: (convId: string) => Promise<void>;
  deleteRequest: (convId: string) => Promise<void>;
  blockFromRequest: (convId: string, blockedUserId: string) => Promise<void>;
```

Add to the store:
```ts
  acceptRequest: async (convId) => {
    // Optimistic: move from requests to conversations
    const { messageRequests, conversations } = get();
    const request = messageRequests.find((r) => r.id === convId);
    if (request) {
      const accepted = { ...request, status: 'accepted' as const };
      set({
        messageRequests: messageRequests.filter((r) => r.id !== convId),
        requestCount: Math.max(0, get().requestCount - 1),
        conversations: [accepted, ...conversations],
      });
    }

    if (isMockId(convId)) return;

    try {
      await supabase
        .from('conversations')
        .update({ status: 'accepted' })
        .eq('id', convId);
    } catch {
      // Rollback on error — refetch both lists
      const userId = request?.participant_1 === request?.initiated_by
        ? request?.participant_2 : request?.participant_1;
      if (userId) {
        get().fetchConversations(userId);
        get().fetchMessageRequests(userId);
      }
    }
  },

  deleteRequest: async (convId) => {
    // Optimistic: remove from requests
    const { messageRequests } = get();
    set({
      messageRequests: messageRequests.filter((r) => r.id !== convId),
      requestCount: Math.max(0, get().requestCount - 1),
    });

    if (isMockId(convId)) return;

    try {
      await supabase
        .from('conversations')
        .update({ status: 'rejected' })
        .eq('id', convId);
    } catch {
      // Non-critical — will be hidden on next fetch anyway
    }
  },

  blockFromRequest: async (convId, blockedUserId) => {
    // Remove from requests first
    const { messageRequests } = get();
    set({
      messageRequests: messageRequests.filter((r) => r.id !== convId),
      requestCount: Math.max(0, get().requestCount - 1),
    });

    // Delegate block to blockStore (handles follows + conversation status)
    const { useBlockStore } = await import('./blockStore');
    const blockStore = useBlockStore.getState();
    // Determine blocker (current user) from the request
    const request = messageRequests.find((r) => r.id === convId);
    const blockerId = request
      ? (request.initiated_by === request.participant_1 ? request.participant_2 : request.participant_1)
      : '';
    if (blockerId) {
      await blockStore.blockUser(blockerId, blockedUserId);
    }
  },
```

- [ ] **Step 4: Update fetchConversations to filter by status=accepted**

In the Supabase query inside `fetchConversations`, add `.eq('status', 'accepted')` filter:

Change the query from:
```ts
      const { data, error } = await supabase
        .from('conversations')
        .select('*, user1:users!conversations_participant_1_fkey(*), user2:users!conversations_participant_2_fkey(*)')
        .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
        .order('last_message_at', { ascending: false });
```

To:
```ts
      const { data, error } = await supabase
        .from('conversations')
        .select('*, user1:users!conversations_participant_1_fkey(*), user2:users!conversations_participant_2_fkey(*)')
        .eq('status', 'accepted')
        .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
        .order('last_message_at', { ascending: false });
```

Also update the mapping to include `status` and `initiated_by`:
```ts
      const mapped: Conversation[] = (data || []).map((c: any) => ({
        id: c.id,
        participant_1: c.participant_1,
        participant_2: c.participant_2,
        last_message_text: c.last_message_text,
        last_message_at: c.last_message_at,
        last_message_sender_id: c.last_message_sender_id,
        status: c.status,
        initiated_by: c.initiated_by,
        created_at: c.created_at,
        other_user: c.participant_1 === userId ? c.user2 : c.user1,
        unread_count: 0,
      }));
```

For mock fallback, filter to only accepted:
```ts
      const { MOCK_CONVERSATIONS } = await import('../lib/mockData');
      const filtered = MOCK_CONVERSATIONS.filter(
        (c) => (c.participant_1 === userId || c.participant_2 === userId)
          && (c.status === 'accepted' || !c.status),
      );
```

- [ ] **Step 5: Update fetchOrCreateConversation to handle BLOCKED/REJECTED**

Change the Supabase RPC call in `fetchOrCreateConversation` from:
```ts
    try {
      const { data, error } = await supabase.rpc('get_or_create_conversation', {
        user_a: myId,
        user_b: otherId,
      });
      if (error) throw error;
      return data as string;
    } catch {
      return null;
    }
```

To:
```ts
    try {
      const { data, error } = await supabase.rpc('get_or_create_conversation', {
        user_a: myId,
        user_b: otherId,
      });
      if (error) {
        if (error.message?.includes('BLOCKED') || error.message?.includes('REJECTED')) {
          return null;
        }
        throw error;
      }
      return data as string;
    } catch {
      return null;
    }
```

- [ ] **Step 6: Update sendMessage to skip push notification for pending conversations**

In `sendMessage`, before the `sendPushNotification` call (around line 232), add a status check:
```ts
      // Skip push notification for pending conversations (silent request)
      const conv = get().conversations.find((c) => c.id === convId)
        || get().messageRequests.find((c) => c.id === convId);
      if (conv?.status !== 'pending') {
        sendPushNotification(
          otherUserId,
          'Yeni Mesaj',
          previewText.length > 80 ? previewText.substring(0, 80) + '...' : previewText,
          { route: `/chat/${convId}` },
        ).catch(() => {});
      }
```

Replace the existing unconditional `sendPushNotification` call with the above guarded version.

- [ ] **Step 7: Update fetchUnreadCount to filter by status=accepted**

In `fetchUnreadCount`, add `.eq('status', 'accepted')` to the conversations query:
```ts
      const { data: userConversations } = await supabase
        .from('conversations')
        .select('id')
        .eq('status', 'accepted')
        .or(`participant_1.eq.${userId},participant_2.eq.${userId}`);
```

- [ ] **Step 8: Update searchUsers to exclude blocked users**

In `searchUsers`, after the Supabase query returns results, filter out blocked users:
```ts
      const { useBlockStore } = await import('./blockStore');
      const blockedUsers = useBlockStore.getState().blockedUsers;
      return (data as User[])
        .filter((u) => !blockedUsers.includes(u.id))
        .map((u) => ({ ...u, mutual_followers: 0 }));
```

Do the same for the mock fallback path.

- [ ] **Step 9: Update subscribeToConversations to also listen for INSERT**

Add INSERT handlers after the existing UPDATE handlers:
```ts
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'conversations', filter: `participant_1=eq.${userId}` },
          () => { get().fetchMessageRequests(userId); get().fetchConversations(userId); },
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'conversations', filter: `participant_2=eq.${userId}` },
          () => { get().fetchMessageRequests(userId); get().fetchConversations(userId); },
        )
```

- [ ] **Step 10: Commit**

```bash
git add src/stores/messageStore.ts
git commit -m "feat: add DM request actions and status filtering to messageStore"
```

---

## Chunk 3: UI — Messages & Requests

### Task 6: Add "İstekler" button to Messages header

**Files:**
- Modify: `src/app/(tabs)/messages.tsx`

- [ ] **Step 1: Import and wire up request state**

Add to imports:
```ts
import { useMessageStore } from '../../stores/messageStore';
```

Inside `MessagesScreen`, add:
```ts
  const requestCount = useMessageStore((s) => s.requestCount);
  const fetchMessageRequests = useMessageStore((s) => s.fetchMessageRequests);
```

In the `useEffect` that calls `fetchConversations`, add:
```ts
    fetchMessageRequests(user.id);
```

In `handleRefresh`, add:
```ts
      fetchMessageRequests(user.id);
```

- [ ] **Step 2: Add İstekler button to header**

In the header section, between the header title `<View>` and the compose button, add:
```tsx
        <View style={styles.headerRight}>
          {requestCount > 0 && (
            <TouchableOpacity
              onPress={() => { haptic.light(); router.push('/messages/requests'); }}
              style={styles.requestsButton}
              activeOpacity={0.7}
            >
              <Text style={[styles.requestsButtonText, { color: Colors.primary }]}>
                İstekler
              </Text>
              <LinearGradient
                colors={[Colors.primary, Colors.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.requestsBadge}
              >
                <Text style={styles.requestsBadgeText}>
                  {requestCount > 99 ? '99+' : requestCount}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => router.push('/chat/new')}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={[Colors.primary, Colors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.composeButton}
            >
              <Ionicons name="create-outline" size={20} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
```

Replace the existing compose button `TouchableOpacity` in the header with the above `headerRight` wrapper.

- [ ] **Step 3: Add styles**

```ts
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  requestsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  requestsButtonText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
  },
  requestsBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  requestsBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontFamily: FontFamily.headingBold,
  },
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(tabs\)/messages.tsx
git commit -m "feat: add İstekler button with badge to Messages header"
```

---

### Task 7: Create requests page

**Files:**
- Create: `src/app/messages/requests.tsx`

- [ ] **Step 1: Write the requests screen**

```tsx
import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { useMessageStore } from '../../stores/messageStore';
import { useAuthStore } from '../../stores/authStore';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily, AnimationConfig } from '../../lib/constants';
import { haptic } from '../../lib/haptics';
import { getRelativeTime } from '../../lib/utils';
import { useThemeColors, useIsDarkMode } from '../../hooks/useThemeColors';
import Avatar from '../../components/ui/Avatar';
import ScreenHeader from '../../components/ui/ScreenHeader';
import type { Conversation } from '../../types';

export default function MessageRequestsScreen() {
  const colors = useThemeColors();
  const isDark = useIsDarkMode();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const messageRequests = useMessageStore((s) => s.messageRequests);
  const loading = useMessageStore((s) => s.loading);
  const fetchMessageRequests = useMessageStore((s) => s.fetchMessageRequests);

  useEffect(() => {
    if (user) fetchMessageRequests(user.id);
  }, [user?.id]);

  const handleRefresh = useCallback(() => {
    if (user) fetchMessageRequests(user.id);
  }, [user?.id]);

  const renderRequest = useCallback(({ item, index }: { item: Conversation; index: number }) => {
    const staggerDelay = Math.min(index * AnimationConfig.staggerInterval, AnimationConfig.maxStaggerDelay);

    return (
      <Animated.View entering={FadeInDown.delay(staggerDelay).springify().damping(16)} exiting={FadeOut.duration(150)}>
        <TouchableOpacity
          style={[styles.requestCard, {
            backgroundColor: colors.background,
            borderColor: colors.borderLight,
          }]}
          onPress={() => { haptic.light(); router.push(`/chat/${item.id}`); }}
          activeOpacity={0.65}
        >
          <View style={styles.avatarContainer}>
            <Avatar
              uri={item.other_user?.avatar_url}
              name={item.other_user?.full_name || item.other_user?.username || '?'}
              size={52}
            />
          </View>

          <View style={styles.requestBody}>
            <View style={styles.requestTop}>
              <Text
                style={[styles.requestName, { color: colors.text }]}
                numberOfLines={1}
              >
                {item.other_user?.full_name || item.other_user?.username || 'Kullanıcı'}
              </Text>
              <Text style={[styles.requestTime, { color: colors.textTertiary }]}>
                {getRelativeTime(item.last_message_at)}
              </Text>
            </View>

            {item.other_user?.university && (
              <Text style={[styles.requestUniversity, { color: colors.textTertiary }]} numberOfLines={1}>
                {item.other_user.university}
              </Text>
            )}

            <Text
              style={[styles.requestPreview, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {item.last_message_text || 'Mesaj isteği'}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }, [colors, router]);

  if (!user) {
    router.replace('/auth/login');
    return null;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScreenHeader
        title="Mesaj İstekleri"
        compact
        leftAction={{ icon: 'chevron-back', onPress: () => router.back() }}
      />

      {/* Info banner */}
      <View style={[styles.infoBanner, { backgroundColor: isDark ? colors.surface : colors.backgroundSecondary }]}>
        <Ionicons name="information-circle-outline" size={18} color={colors.textTertiary} />
        <Text style={[styles.infoBannerText, { color: colors.textSecondary }]}>
          Takipleşmediğin kişilerden gelen mesaj istekleri
        </Text>
      </View>

      <FlatList
        data={messageRequests}
        keyExtractor={(item) => item.id}
        renderItem={renderRequest}
        contentContainerStyle={messageRequests.length === 0 ? styles.emptyList : styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={[styles.emptyCircle, { backgroundColor: isDark ? colors.surface : colors.backgroundSecondary }]}>
              <Ionicons name="mail-open-outline" size={36} color={colors.textTertiary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Mesaj isteği yok
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Takipleşmediğin kişilerden gelen mesajlar burada görünür
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  infoBannerText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    lineHeight: 18,
  },
  listContent: {
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xxxl * 3,
  },
  emptyList: {
    flexGrow: 1,
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md + 2,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    gap: Spacing.md,
  },
  avatarContainer: {
    position: 'relative',
  },
  requestBody: {
    flex: 1,
    gap: 2,
  },
  requestTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  requestName: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
    flex: 1,
    marginRight: Spacing.sm,
  },
  requestTime: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
  },
  requestUniversity: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
  },
  requestPreview: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    lineHeight: 18,
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxxl,
    gap: Spacing.md,
  },
  emptyCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.headingBold,
  },
  emptySubtitle: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    textAlign: 'center',
    lineHeight: 20,
  },
});
```

- [ ] **Step 2: Register route in _layout.tsx**

In `src/app/_layout.tsx`, add a `<Stack.Screen>` entry for the new route inside the `<Stack>` component:
```tsx
<Stack.Screen name="messages/requests" options={{ headerShown: false, animation: 'slide_from_right' }} />
```

- [ ] **Step 3: Commit**

```bash
git add src/app/messages/requests.tsx src/app/_layout.tsx
git commit -m "feat: add message requests list page with route registration"
```

---

### Task 8: Add accept/delete/block bar to chat screen

**Files:**
- Modify: `src/app/chat/[id].tsx`

- [ ] **Step 1: Import new dependencies**

Add to imports:
```ts
import { Alert } from 'react-native';
import { useBlockStore } from '../../stores/blockStore';
```

- [ ] **Step 2: Fix conversation lookup to include pending requests**

The existing code looks up `conversation` only from `conversations`. Pending requests are in `messageRequests`, so we need to search both. Replace the existing lookup (around line 58-66 in `chat/[id].tsx`):

```ts
  const conversations = useMessageStore((s) => s.conversations);
  const messageRequests = useMessageStore((s) => s.messageRequests);
  // Look up in both accepted conversations AND pending requests
  const conversation = conversations.find((c) => c.id === conversationId)
    || messageRequests.find((c) => c.id === conversationId);
```

Remove the old `const conversations = useMessageStore((s) => s.conversations);` line and the old `const conversation = conversations.find(...)` line.

- [ ] **Step 3: Add pending state detection**

After the `conversation` and `otherUser` declarations, add:
```ts
  const isPending = conversation?.status === 'pending';
  const isRecipient = isPending && conversation?.initiated_by !== user?.id;
  const isSender = isPending && conversation?.initiated_by === user?.id;

  const acceptRequest = useMessageStore((s) => s.acceptRequest);
  const deleteRequest = useMessageStore((s) => s.deleteRequest);
  const blockFromRequest = useMessageStore((s) => s.blockFromRequest);
```

- [ ] **Step 4: Conditionally skip markAsRead for pending conversations**

Change:
```ts
    if (user) markAsRead(conversationId, user.id);
```
To:
```ts
    if (user && !isPending) markAsRead(conversationId, user.id);
```

Note: Since `isPending` depends on `conversation` which loads asynchronously, an alternative is to wrap `markAsRead` in the realtime callback or after conversations are loaded. For simplicity, the initial call can be guarded, and `markAsRead` will be called after `acceptRequest`.

- [ ] **Step 5: Add sender info banner**

Before the `{/* Chat body */}` comment, after the header `</View>`, add:
```tsx
      {/* Pending request banner */}
      {isSender && (
        <Animated.View entering={FadeIn.duration(300)} style={[styles.pendingBanner, {
          backgroundColor: isDark ? 'rgba(245,166,35,0.1)' : 'rgba(245,166,35,0.08)',
        }]}>
          <Ionicons name="time-outline" size={18} color={Colors.accent} />
          <Text style={[styles.pendingBannerText, { color: colors.textSecondary }]}>
            Mesaj isteği gönderildi. Onay bekleniyor.
          </Text>
        </Animated.View>
      )}
```

- [ ] **Step 6: Add recipient action bar**

Replace the `{/* Input Bar */}` section. If `isRecipient`, show the action bar instead of the input bar:

Wrap the existing input bar in a condition:
```tsx
        {isRecipient ? (
          /* Request action bar */
          <Animated.View entering={SlideInUp.springify().damping(16)} style={[
            styles.requestActionBar,
            {
              backgroundColor: colors.background,
              borderTopColor: isDark ? colors.border : colors.borderLight,
              paddingBottom: Math.max(insets.bottom, Spacing.sm),
            },
          ]}>
            <TouchableOpacity
              style={[styles.requestActionButton, styles.acceptButton]}
              onPress={async () => {
                haptic.success();
                await acceptRequest(conversationId!);
                if (user) markAsRead(conversationId!, user.id);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle" size={20} color="#FFF" />
              <Text style={styles.requestActionTextLight}>Kabul Et</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.requestActionButton, { backgroundColor: isDark ? colors.surface : colors.backgroundSecondary }]}
              onPress={() => {
                haptic.light();
                deleteRequest(conversationId!);
                router.back();
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.requestActionText, { color: colors.textSecondary }]}>Sil</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.requestActionButton, styles.blockButton]}
              onPress={() => {
                Alert.alert(
                  'Engelle',
                  `${otherUser?.full_name || 'Bu kullanıcıyı'} engellemek istediğine emin misin? Engellenen kişi sana mesaj atamaz, profilini göremez ve takip edemez.`,
                  [
                    { text: 'İptal', style: 'cancel' },
                    {
                      text: 'Engelle',
                      style: 'destructive',
                      onPress: async () => {
                        haptic.error();
                        await blockFromRequest(conversationId!, otherUserId);
                        router.back();
                      },
                    },
                  ],
                );
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="ban" size={20} color="#FFF" />
              <Text style={styles.requestActionTextLight}>Engelle</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          /* Normal input bar — existing code */
          <View style={[
            styles.inputBar,
            // ... existing inputBar code
          ]}>
            {/* ... existing input bar content */}
          </View>
        )}
```

- [ ] **Step 7: Add styles**

```ts
  // Pending banner
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  pendingBannerText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    lineHeight: 18,
  },

  // Request action bar
  requestActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  requestActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  acceptButton: {
    backgroundColor: Colors.success,
  },
  blockButton: {
    backgroundColor: Colors.error,
  },
  requestActionText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.headingBold,
  },
  requestActionTextLight: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.headingBold,
    color: '#FFF',
  },
```

- [ ] **Step 8: Commit**

```bash
git add src/app/chat/\[id\].tsx
git commit -m "feat: add accept/delete/block action bar for pending requests in chat"
```

---

## Chunk 4: Settings & Platform-wide Block Effects

### Task 9: Add DM privacy setting to Settings

**Files:**
- Modify: `src/app/settings.tsx`

- [ ] **Step 1: Add dm_privacy state and handler**

After the `notifPrefs` state, add:
```ts
  const [dmPrivacy, setDmPrivacy] = useState<'followers_only' | 'everyone'>('followers_only');

  // Load dm_privacy
  useEffect(() => {
    if (user) {
      supabase.from('users').select('dm_privacy').eq('id', user.id).single()
        .then(({ data }) => {
          if (data?.dm_privacy) setDmPrivacy(data.dm_privacy);
        });
    }
  }, [user]);

  const updateDmPrivacy = async (value: 'followers_only' | 'everyone') => {
    setDmPrivacy(value);
    if (user) {
      await supabase.from('users')
        .update({ dm_privacy: value })
        .eq('id', user.id);
    }
  };
```

- [ ] **Step 2: Add Gizlilik section to the UI**

After the Bildirimler section `</View>`, add:
```tsx
        <View style={[styles.section, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Gizlilik</Text>
          <Text style={[styles.privacyDescription, { color: colors.textTertiary }]}>
            Kimler sana doğrudan mesaj atabilsin?
          </Text>
          {[
            { key: 'followers_only' as const, label: 'Sadece takipleştiğim kişiler' },
            { key: 'everyone' as const, label: 'Herkes' },
          ].map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              style={styles.radioRow}
              onPress={() => updateDmPrivacy(key)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={dmPrivacy === key ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={dmPrivacy === key ? Colors.primary : colors.textTertiary}
              />
              <Text style={[styles.radioLabel, { color: colors.text }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
```

- [ ] **Step 3: Add styles**

```ts
  privacyDescription: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  radioLabel: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
  },
```

- [ ] **Step 4: Commit**

```bash
git add src/app/settings.tsx
git commit -m "feat: add DM privacy setting (followers_only / everyone) to settings"
```

---

### Task 10: Add block check to user profile screen

**Files:**
- Modify: `src/app/user/[id].tsx`

- [ ] **Step 1: Import blockStore and add block state**

Add to imports:
```ts
import { useBlockStore } from '../../stores/blockStore';
import { Alert } from 'react-native';
import { Colors } from '../../lib/constants';
```

Inside the component, add:
```ts
  const isBlockedByMe = useBlockStore((s) => s.isBlocked(id || ''));
  const blockUser = useBlockStore((s) => s.blockUser);
  const unblockUser = useBlockStore((s) => s.unblockUser);
  const [isBlockedBetween, setIsBlockedBetween] = useState(false);
```

In `loadUserProfile`, after the follow check, add:
```ts
      // Check block status
      const blocked = await useBlockStore.getState().checkBlockedBetween(currentUser.id, userId);
      setIsBlockedBetween(blocked);
```

- [ ] **Step 2: Add blocked screen**

After the not-found state block and before the main return, add:
```tsx
  // Blocked state
  if (isBlockedByMe && profileUser) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundSecondary }]} edges={['top']}>
        <View style={[styles.headerBar, { backgroundColor: colors.background, borderBottomColor: colors.borderLight }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{profileUser.username}</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.notFoundContent}>
          <Ionicons name="ban" size={48} color={colors.textTertiary} />
          <Text style={[styles.notFoundText, { color: colors.textSecondary }]}>Bu kullanıcıyı engelledin</Text>
          <TouchableOpacity
            style={[styles.notFoundBackButton, { backgroundColor: colors.textTertiary }]}
            onPress={() => {
              Alert.alert(
                'Engeli Kaldır',
                `${profileUser.full_name || profileUser.username} kullanıcısının engelini kaldırmak istiyor musun?`,
                [
                  { text: 'İptal', style: 'cancel' },
                  {
                    text: 'Engeli Kaldır',
                    onPress: async () => {
                      if (currentUser) {
                        await unblockUser(currentUser.id, id!);
                        setIsBlockedBetween(false);
                        loadUserProfile(id!);
                      }
                    },
                  },
                ],
              );
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.notFoundBackButtonText}>Engeli Kaldır</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }
```

- [ ] **Step 3: Add block button to action row**

In the `!isOwnProfile` action row, after the message button, add a block/menu button:
```tsx
              <TouchableOpacity
                style={[styles.messageButton, { borderColor: Colors.error }]}
                onPress={() => {
                  if (!currentUser || !id) return;
                  Alert.alert(
                    'Engelle',
                    `${profileUser.full_name || profileUser.username} kullanıcısını engellemek istediğine emin misin?`,
                    [
                      { text: 'İptal', style: 'cancel' },
                      {
                        text: 'Engelle',
                        style: 'destructive',
                        onPress: async () => {
                          await blockUser(currentUser.id, id);
                          setIsBlockedBetween(true);
                        },
                      },
                    ],
                  );
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="ban" size={16} color={Colors.error} />
              </TouchableOpacity>
```

- [ ] **Step 4: Guard follow and message actions against block**

Wrap `handleFollowToggle` with a block check:
```ts
  const handleFollowToggle = async () => {
    if (!currentUser || !id) { router.push('/auth/login'); return; }
    if (isBlockedBetween) return;
    // ... existing follow logic
```

Wrap `handleMessage` with a block check:
```ts
  const handleMessage = async () => {
    if (!currentUser || !id) { router.push('/auth/login'); return; }
    if (isBlockedBetween) {
      Alert.alert('Engellendi', 'Bu kullanıcıyla iletişim kuramazsın.');
      return;
    }
    // ... existing message logic
```

- [ ] **Step 5: Commit**

```bash
git add src/app/user/\[id\].tsx
git commit -m "feat: add block/unblock to user profile with blocked state screen"
```

---

### Task 11: Initialize blockStore at app startup

**Files:**
- Modify: `src/app/_layout.tsx`

- [ ] **Step 1: Import and initialize blockStore**

Add to imports:
```ts
import { useBlockStore } from '../stores/blockStore';
```

In the root layout component, where `authStore.initialize()` is called, add after the user is loaded:
```ts
  useEffect(() => {
    const user = useAuthStore.getState().user;
    if (user) {
      useBlockStore.getState().fetchBlockedUsers(user.id);
    }
  }, []);
```

Or if there's an existing effect that watches user state, add the `fetchBlockedUsers` call there.

- [ ] **Step 2: Commit**

```bash
git add src/app/_layout.tsx
git commit -m "feat: initialize blockStore on app startup"
```

---

### Task 12: Add block filter to feedStore

**Files:**
- Modify: `src/stores/feedStore.ts`

- [ ] **Step 1: Filter blocked users from feed posts**

In `fetchPosts`, after posts are set from Supabase, add filtering:

After `set({ posts: data as Post[], ... })`, add a post-filter:
```ts
      if (!error && data) {
        const { useBlockStore } = await import('./blockStore');
        const blockedUsers = useBlockStore.getState().blockedUsers;
        const filtered = (data as Post[]).filter(
          (p) => !blockedUsers.includes(p.user_id)
        );
        set({
          posts: filtered,
          hasMore: data.length >= PAGE_SIZE,
        });
      }
```

Do the same for the mock data path: filter `buildMockPostsWithJoins()` results through `blockedUsers`.

- [ ] **Step 2: Commit**

```bash
git add src/stores/feedStore.ts
git commit -m "feat: filter blocked users from feed posts"
```

---

### Task 13: Final verification and commit

- [ ] **Step 1: Run TypeScript type check**

```bash
cd /Users/toprakyagcioglu/Documents/Projects/Memet-Kebab/ogrenci_nerede_yer && npx tsc --noEmit
```

Fix any type errors that arise.

- [ ] **Step 2: Start Expo and verify no crash**

```bash
npx expo start --port 8090
```

Check:
1. Messages tab loads without crash
2. İstekler button appears (with mock data showing 3 requests)
3. Tapping İstekler navigates to request list
4. Tapping a request opens chat with action bar
5. Settings shows DM privacy radio buttons
6. User profile shows block button

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address type errors and runtime issues in DM request feature"
```
