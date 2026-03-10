# ONY Reels / Stories Feature Design

## Overview

Add Instagram Reels-style stories to the Feed (Akis) screen. Each ONY video appears as a circular story bubble at the top of the feed. Tapping opens a fullscreen vertical video viewer with swipe-to-next and a "Videoyu Izle" button linking to the original URL.

## Data Layer

New `Story` interface in `types/index.ts`:

```ts
interface Story {
  id: string;
  title: string;           // "Cigkofte Turu", "En Ucuz Kahvalti"
  thumbnail_url: string;   // Circle thumbnail
  video_url: string;       // expo-av playback URL
  external_url: string;    // "Videoyu Izle" -> YouTube/TikTok link
  venue_id?: string;       // Optional venue link
}
```

5-6 hardcoded entries in `MOCK_STORIES` array in `mockData.ts`. No store needed — imported directly.

## Stories Bar (Feed Screen)

- Horizontal FlatList at the top of feed, above category chips
- Each item: 68px circular thumbnail with `LinearGradient` border (#E23744 -> #F5A623)
- Single-line title below (FontSize.xs, truncated)
- Watched stories: gradient border opacity drops to 0.4
- Layout order: ScreenHeader > Stories Bar > Search Bar > Buddy Banner > Category Chips > Posts

## Reels Viewer (Fullscreen Modal)

- New route: `src/app/reels.tsx`, registered as `presentation: 'fullScreenModal'` in root `_layout.tsx`
- Vertical FlatList with `pagingEnabled` + `snapToInterval={screenHeight}` for Reels-style swipe
- Each item: fullscreen `Video` component (expo-av), `resizeMode="cover"`
- Active video autoplays, others pause via `viewabilityConfig`
- Top: close button (X) + story title
- Bottom: gradient overlay + title + "Videoyu Izle" button (`Linking.openURL(external_url)`)
- If venue linked: small venue chip, tappable to `venue/[id]`
- Swipe down dismisses modal

## New Dependency

- `expo-av` — video playback

## File Structure

```
src/
  app/
    reels.tsx              # Fullscreen Reels viewer modal
    _layout.tsx            # Add reels route as modal
  components/
    feed/StoriesBar.tsx    # Horizontal story circles
  types/index.ts           # Story interface
  lib/mockData.ts          # MOCK_STORIES data
```

## Approach

Native video playback via expo-av for smooth Reels experience. "Videoyu Izle" opens original URL via Linking. Mock data only — no backend/store needed.
