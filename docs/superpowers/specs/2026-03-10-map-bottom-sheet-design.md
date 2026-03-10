# Map Venue Bottom Sheet — Design Spec

## Summary

Replace the current map callout popups with an Apple Maps-style bottom sheet that slides up from the bottom when a user taps any venue marker. The sheet shows a compact venue preview at ~40% screen height. Swiping up navigates to the existing venue detail page. The map remains visible behind the sheet.

## Interaction Flow

1. **Tap any marker** → bottom sheet slides up to ~40% screen height showing compact venue card
2. **Swipe up past threshold** → `router.push('/venue/[id]')` to existing detail page
3. **Tap empty map** → sheet dismisses with slide-down animation
4. **Tap another marker** → sheet content swaps to new venue (crossfade, no close/reopen flicker)
5. **Swipe down** → sheet dismisses

## Collapsed State (~40% height)

### Layout (top to bottom)
- Drag handle bar (centered, 40x4px)
- Close button (X) positioned top-right
- Row: Venue thumbnail (64x64, rounded 12px) + name + address/neighborhood
- Ratings row: ONY editorial badge (e.g. 9.0) + user stars (e.g. ★ 4.2) + price range (₺₺)
- 3 horizontal action buttons: Puan Ver (primary red), Yol Tarifi (cyan), Kaydet (outline)

### Content Adapts by Marker Tier

**Tier 3 — Reviewed ONY venue:**
- Full compact card as described above
- All ratings visible (ONY + user + price)
- All 3 action buttons

**Tier 2 — Unreviewed ONY venue:**
- Name + address (no ratings to show)
- "Degerlendir" button replaces "Puan Ver"
- Yol Tarifi + Kaydet buttons remain
- No thumbnail (or placeholder)

**Tier 1 — Google Places:**
- Name + Google rating (with Google icon)
- "Ilk degerlendirmeyi yap!" CTA button
- Yol Tarifi button
- No ONY rating, no Kaydet

## Technical Approach

### Library
`@gorhom/react-native-bottom-sheet` — the standard React Native bottom sheet library. Depends on `react-native-reanimated` (v4.2.1, already installed) and `react-native-gesture-handler` (~2.30.0, already installed).

### New Component
`src/components/venue/VenueBottomSheet.tsx`
- Receives `venue: Venue | null` and `onDismiss: () => void` props
- Uses `BottomSheet` with snap points `['40%']` and index `-1` (initially hidden)
- When `venue` changes to non-null, sheet animates to index 0
- When venue is null, sheet animates to index -1
- `onSwipeUp` callback triggers `router.push('/venue/${venue.id}')`
- Renders tier-appropriate content based on `venue.source` and `venue.total_reviews`

### Map Screen Changes (`src/app/(tabs)/map.tsx`)
- Add `selectedVenue` state (`Venue | null`)
- All marker `onPress` handlers set `selectedVenue` instead of animating callout
- Remove all `<Callout>` components and related styles
- Add `<VenueBottomSheet>` at the bottom of the component tree
- Adjust `mapPadding.bottom` when sheet is visible
- `onPress` on MapView (empty area) sets `selectedVenue` to null

### Dismissal Behavior
- Tap empty map → `selectedVenue = null` → sheet closes
- Tap another marker → `selectedVenue = newVenue` → sheet content swaps (no close/reopen)
- Swipe down → `onDismiss` fires → `selectedVenue = null`
- Close (X) button → same as swipe down

### What Stays the Same
- `venue/[id].tsx` detail page — completely untouched
- Marker rendering (native logo images, grey dots, tags) — untouched
- Clustering logic — untouched
- Search bar, filters, location button, buddy FAB — untouched

## Dependencies to Install
- `@gorhom/react-native-bottom-sheet` (latest v5)

## Files to Create
- `src/components/venue/VenueBottomSheet.tsx`

## Files to Modify
- `src/app/(tabs)/map.tsx` — remove Callouts, add sheet, add selectedVenue state
