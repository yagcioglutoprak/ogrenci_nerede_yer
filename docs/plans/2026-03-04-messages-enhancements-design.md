# Messages Screen Enhancements Design

## Summary

Two enhancements to the messaging system:
1. **New DM flow** — FAB on Mesajlar screen opens a full-screen user search modal to start new conversations
2. **Inline attachments in chat** — Attachment button in chat input bar for sending photos and venue cards

---

## 1. New DM Flow (Mesajlar Screen)

### FAB Button
- Position: bottom-right, 24px from edges, above tab bar safe area
- Style: 56px circle, `Colors.primary` background, white `create-outline` icon
- Animation: spring scale on press, `FadeIn` on mount
- Shadow: subtle elevation matching iOS conventions

### New DM Modal (`src/app/chat/new.tsx`)
- Full-screen modal via Expo Router (`presentation: 'modal'`)
- **Header**: "Yeni Mesaj" title + X close button (top-right)
- **Search bar**: Auto-focused, debounced 300ms, placeholder "Kullanici ara..."
- **Results list**: Each row shows:
  - Avatar (44px)
  - Full name (bold) + @username (secondary)
  - University name + mutual follower count ("3 ortak takipci")
- **States**:
  - Initial: "Aramaya basla" prompt with search icon
  - No results: "Sonuc bulunamadi"
  - Loading: Skeleton rows
- **Action**: Tap user → `fetchOrCreateConversation(myId, userId)` → navigate to `/chat/{convId}` → dismiss modal

### Search Implementation
- Query `users` table with `ilike` on `username` and `full_name`
- For mutual followers: count from `follows` table where both current user and target user follow
- Mock fallback: filter `MOCK_USERS` by name/username substring match, show fake mutual count

---

## 2. Chat Attachments (Chat Screen)

### Input Bar Changes
- Add `+` circle button (32px) to the LEFT of the text input
- Tapping opens a bottom sheet with two options:
  - **Fotograf Gonder** (`camera-outline` icon) — opens `expo-image-picker`
  - **Mekan Paylas** (`location-outline` icon) — opens venue picker

### Message Type Extension
Extend `DirectMessage` type:
```ts
interface DirectMessage {
  // ... existing fields
  message_type?: 'text' | 'image' | 'venue';  // default 'text'
  metadata?: {
    image_url?: string;
    venue_id?: string;
    venue_name?: string;
    venue_cover_url?: string;
    venue_rating?: number;
    venue_price_range?: number;
  };
}
```

### Image Messages
- Pick image via `useImagePicker` hook (already exists)
- For mock: store the local URI directly in metadata
- Bubble renders: rounded image (max 240px wide, aspect ratio preserved), tappable for full-screen `Image` viewer
- Time stamp below image

### Venue Messages
- **Venue Picker Modal** (`VenuePickerModal` component):
  - Search bar + list of venues (favorites first, then search results)
  - Each row: cover thumbnail (48px square) + name + rating stars + price range
  - Tap to select → sends venue as message
- **Venue bubble**: Mini card with cover image (full-width, 120px tall), venue name, overall rating, price range
- Tappable → navigates to `/venue/[id]`

### Store Changes (`messageStore.ts`)
- `sendMessage` signature gains optional `messageType` and `metadata` params
- Optimistic message includes type + metadata
- Supabase insert includes new columns (requires migration)

### Database Migration
- Add `message_type TEXT DEFAULT 'text'` to `direct_messages` table
- Add `metadata JSONB DEFAULT '{}'` to `direct_messages` table

---

## Files to Create/Modify

### New Files
- `src/app/chat/new.tsx` — New DM search modal
- `src/components/chat/AttachmentSheet.tsx` — Bottom sheet for photo/venue options
- `src/components/chat/VenuePickerModal.tsx` — Venue selection modal
- `src/components/chat/ImageBubble.tsx` — Image message bubble renderer
- `src/components/chat/VenueBubble.tsx` — Venue card message bubble renderer
- `supabase/migrations/009_message_types.sql` — Add message_type + metadata columns

### Modified Files
- `src/app/(tabs)/messages.tsx` — Add FAB button
- `src/app/chat/[id].tsx` — Add attachment button in input bar, render new bubble types
- `src/stores/messageStore.ts` — Extend sendMessage with type/metadata
- `src/types/index.ts` — Extend DirectMessage interface
- `src/lib/mockData.ts` — Add mock image/venue messages
