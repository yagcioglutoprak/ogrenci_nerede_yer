# Messages Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a New DM flow (FAB + user search modal) to Mesajlar screen, and inline photo/venue sharing to the chat input bar.

**Architecture:** Extend the existing message system with a new route (`chat/new.tsx`) for the search modal, add attachment UI components to the chat screen, and extend `DirectMessage` with `message_type` and `metadata` fields. Mock fallback pattern preserved for all new features.

**Tech Stack:** React Native, Expo Router, Zustand, Supabase, expo-image-picker, react-native-reanimated

---

### Task 1: Extend DirectMessage type + migration

**Files:**
- Modify: `src/types/index.ts:308-317`
- Create: `supabase/migrations/009_message_types.sql`

**Step 1: Update DirectMessage interface**

In `src/types/index.ts`, replace the `DirectMessage` interface:

```ts
export interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type?: 'text' | 'image' | 'venue';
  metadata?: {
    image_url?: string;
    venue_id?: string;
    venue_name?: string;
    venue_cover_url?: string;
    venue_rating?: number;
    venue_price_range?: number;
  };
  is_read: boolean;
  created_at: string;
  user?: User;
}
```

**Step 2: Create migration**

Create `supabase/migrations/009_message_types.sql`:

```sql
-- 009: Add message type and metadata to direct_messages
ALTER TABLE direct_messages
  ADD COLUMN IF NOT EXISTS message_type TEXT DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
```

**Step 3: Commit**

```bash
git add src/types/index.ts supabase/migrations/009_message_types.sql
git commit -m "feat: extend DirectMessage with message_type and metadata"
```

---

### Task 2: Update messageStore to support typed messages

**Files:**
- Modify: `src/stores/messageStore.ts:17-19` (interface), `src/stores/messageStore.ts:174-226` (sendMessage)

**Step 1: Update MessageState interface**

Change `sendMessage` signature:

```ts
sendMessage: (convId: string, senderId: string, content: string, otherUserId: string, messageType?: 'text' | 'image' | 'venue', metadata?: DirectMessage['metadata']) => Promise<void>;
```

**Step 2: Update sendMessage implementation**

Modify `sendMessage` to accept and persist `messageType` and `metadata`:

- Add `messageType = 'text'` and `metadata` to params
- Include them in the optimistic message
- Include them in the Supabase insert
- For image messages, set `content` to `'📷 Fotograf'`; for venue messages, set `content` to venue name from metadata — these are used as conversation preview text

**Step 3: Commit**

```bash
git add src/stores/messageStore.ts
git commit -m "feat: messageStore supports typed messages with metadata"
```

---

### Task 3: Add searchUsers to messageStore

**Files:**
- Modify: `src/stores/messageStore.ts` (add `searchUsers` method)
- Modify: `src/lib/mockData.ts` (no changes needed — MOCK_USERS already exists)

**Step 1: Add searchUsers to MessageState interface**

```ts
searchUsers: (query: string, currentUserId: string) => Promise<Array<User & { mutual_followers: number }>>;
```

**Step 2: Implement searchUsers**

```ts
searchUsers: async (query, currentUserId) => {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  if (isMockId(currentUserId)) {
    const { MOCK_USERS } = await import('../lib/mockData');
    return MOCK_USERS
      .filter((u) => u.id !== currentUserId && (
        u.full_name.toLowerCase().includes(trimmed) ||
        u.username.toLowerCase().includes(trimmed)
      ))
      .map((u) => ({ ...u, mutual_followers: Math.floor(Math.random() * 8) }));
  }

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .neq('id', currentUserId)
    .or(`username.ilike.%${trimmed}%,full_name.ilike.%${trimmed}%`)
    .limit(20);

  if (error || !data) return [];

  // Get mutual followers count for each result
  const results = await Promise.all(
    data.map(async (u) => {
      const { count } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', u.id)
        .in('follower_id', [
          // Users who follow the target AND are followed by current user
        ]);
      // Simpler approach: count followers of target who are also followed by current user
      const { data: mutualData } = await supabase.rpc('count_mutual_followers', {
        user_a: currentUserId,
        user_b: u.id,
      });
      return { ...u, mutual_followers: (mutualData as number) ?? 0 };
    })
  );

  return results;
},
```

Note: For simplicity, use a mock random number for mutual followers until a proper RPC is created. The mock fallback already handles this.

**Step 3: Commit**

```bash
git add src/stores/messageStore.ts
git commit -m "feat: add searchUsers to messageStore"
```

---

### Task 4: Create New DM search modal (`chat/new.tsx`)

**Files:**
- Create: `src/app/chat/new.tsx`
- Modify: `src/app/_layout.tsx` (add route)

**Step 1: Add route to root layout**

In `src/app/_layout.tsx`, add after the `chat/[id]` screen:

```tsx
<Stack.Screen name="chat/new" options={{ presentation: 'modal', animation: 'slide_from_bottom', headerShown: false }} />
```

**Step 2: Create `src/app/chat/new.tsx`**

Full-screen modal with:
- Header: "Yeni Mesaj" title + X close button
- Search bar: auto-focused TextInput, debounced 300ms
- Results FlatList: Avatar (44px) | full_name (bold) + @username | university + mutual follower count
- States: initial prompt ("Bir kullanici ara..."), no results ("Sonuc bulunamadi"), loading (skeleton)
- On tap: `fetchOrCreateConversation(myId, userId)` → `router.replace(\`/chat/${convId}\`)` → close modal

Key patterns to follow:
- Use `useThemeColors()` for all colors
- Use `Colors`, `Spacing`, `BorderRadius`, `FontSize`, `FontFamily` from constants
- Use `Avatar` component for user avatars
- Use `SafeAreaView` with edges={['top']}
- Use `Animated` from `react-native-reanimated` for entrance animations
- Debounce with `useRef` + `setTimeout` pattern (no lodash)

**Step 3: Commit**

```bash
git add src/app/chat/new.tsx src/app/_layout.tsx
git commit -m "feat: new DM search modal screen"
```

---

### Task 5: Add FAB to Mesajlar screen

**Files:**
- Modify: `src/app/(tabs)/messages.tsx`

**Step 1: Add FAB button**

After the `FlatList` (inside the main return, before closing `</SafeAreaView>`), add a floating action button:

```tsx
<Animated.View entering={FadeInDown.delay(200).springify().damping(14)} style={styles.fabContainer}>
  <TouchableOpacity
    style={styles.fab}
    onPress={() => router.push('/chat/new')}
    activeOpacity={0.8}
  >
    <Ionicons name="create-outline" size={24} color="#FFF" />
  </TouchableOpacity>
</Animated.View>
```

**Step 2: Add FAB styles**

```ts
fabContainer: {
  position: 'absolute',
  bottom: Spacing.xxxl * 3,
  right: Spacing.xl,
},
fab: {
  width: 56,
  height: 56,
  borderRadius: 28,
  backgroundColor: Colors.primary,
  alignItems: 'center',
  justifyContent: 'center',
  shadowColor: Colors.shadow,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.25,
  shadowRadius: 8,
  elevation: 6,
},
```

**Step 3: Commit**

```bash
git add src/app/(tabs)/messages.tsx
git commit -m "feat: add FAB to Mesajlar screen for new DM"
```

---

### Task 6: Create AttachmentSheet component

**Files:**
- Create: `src/components/chat/AttachmentSheet.tsx`

**Step 1: Build AttachmentSheet**

A simple bottom-appearing animated view with two option rows:
- **Fotograf Gonder** with `camera-outline` icon
- **Mekan Paylas** with `location-outline` icon

Props:
```ts
interface AttachmentSheetProps {
  visible: boolean;
  onClose: () => void;
  onPickPhoto: () => void;
  onPickVenue: () => void;
}
```

Use `react-native-reanimated` for slide-up animation. Overlay backdrop with `TouchableOpacity` to close. Each option is a row: icon (in colored circle) + label text.

**Step 2: Commit**

```bash
git add src/components/chat/AttachmentSheet.tsx
git commit -m "feat: create AttachmentSheet component for chat"
```

---

### Task 7: Create VenuePickerModal component

**Files:**
- Create: `src/components/chat/VenuePickerModal.tsx`

**Step 1: Build VenuePickerModal**

Modal with:
- Header: "Mekan Sec" + X close
- Search TextInput
- FlatList of venues from `venueStore` (search or all)
- Each row: cover image thumbnail (48px square, rounded) + name + rating + price range
- On tap: calls `onSelect(venue)` callback with venue data

Props:
```ts
interface VenuePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (venue: { venue_id: string; venue_name: string; venue_cover_url: string | null; venue_rating: number; venue_price_range: number }) => void;
}
```

Uses `useVenueStore` to fetch/search venues.

**Step 2: Commit**

```bash
git add src/components/chat/VenuePickerModal.tsx
git commit -m "feat: create VenuePickerModal for sharing venues in chat"
```

---

### Task 8: Create ImageBubble and VenueBubble components

**Files:**
- Create: `src/components/chat/ImageBubble.tsx`
- Create: `src/components/chat/VenueBubble.tsx`

**Step 1: Build ImageBubble**

Renders a rounded image inside a chat bubble. Props: `imageUrl`, `isOwn`, `time`, `isRead`. Image is max 240px wide, aspect ratio preserved, tappable (logs to console for now — full-screen viewer is future scope).

**Step 2: Build VenueBubble**

Mini venue card bubble. Props: `venueId`, `venueName`, `venueCoverUrl`, `venueRating`, `venuePriceRange`, `isOwn`, `time`, `isRead`. Shows cover image (full-width, 120px tall, rounded top), below: venue name, star rating, price. Tappable → navigates to `/venue/[venueId]`.

**Step 3: Commit**

```bash
git add src/components/chat/ImageBubble.tsx src/components/chat/VenueBubble.tsx
git commit -m "feat: create ImageBubble and VenueBubble chat components"
```

---

### Task 9: Integrate attachments into chat screen

**Files:**
- Modify: `src/app/chat/[id].tsx`

**Step 1: Add attachment button to input bar**

Add a `+` circle button (32px, `colors.backgroundSecondary` bg) to the left of the TextInput in the input bar. Tapping toggles `AttachmentSheet` visibility.

**Step 2: Wire up photo picking**

Import `useImagePicker` hook. On "Fotograf Gonder":
- Call `pickFromGallery()` (single image, `maxImages: 1`)
- On selection, call `sendMessage(convId, user.id, '📷 Fotograf', otherUserId, 'image', { image_url: uri })`

**Step 3: Wire up venue picking**

Show `VenuePickerModal`. On select:
- Call `sendMessage(convId, user.id, venue.venue_name, otherUserId, 'venue', { venue_id, venue_name, venue_cover_url, venue_rating, venue_price_range })`

**Step 4: Update renderMessage to handle bubble types**

In `renderMessage`, check `item.message_type`:
- `'image'` → render `<ImageBubble>`
- `'venue'` → render `<VenueBubble>`
- default (`'text'` or undefined) → existing text bubble

**Step 5: Commit**

```bash
git add src/app/chat/[id].tsx
git commit -m "feat: integrate photo and venue sharing into chat screen"
```

---

### Task 10: Add mock data for typed messages

**Files:**
- Modify: `src/lib/mockData.ts`

**Step 1: Add image and venue mock messages to MOCK_DIRECT_MESSAGES**

Add 2-3 mock messages with `message_type: 'image'` and `message_type: 'venue'` to existing conversations so the feature is visible in mock mode.

**Step 2: Commit**

```bash
git add src/lib/mockData.ts
git commit -m "feat: add mock image and venue messages"
```

---

### Task 11: Visual polish and test

**Step 1: Run the app**

```bash
npx expo start --ios
```

**Step 2: Test all flows**

- Mesajlar screen: FAB visible, tapping opens New DM modal
- New DM modal: search works, user rows show avatar + name + university + mutual followers
- Tapping a user: creates/finds conversation, navigates to chat
- Chat screen: + button visible, tapping shows attachment sheet
- Photo flow: picking image sends image bubble
- Venue flow: picking venue sends venue card bubble
- Text messages: still work as before

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: messages enhancements — new DM flow + photo/venue sharing"
```
