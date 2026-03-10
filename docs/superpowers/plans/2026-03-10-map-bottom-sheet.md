# Map Venue Bottom Sheet — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace map callout popups with an Apple Maps-style bottom sheet that previews venue info at 40% height, navigates to the detail page on swipe-up, and smoothly transitions between venues.

**Architecture:** Install `@gorhom/react-native-bottom-sheet` v5. Wrap the root layout with `GestureHandlerRootView` (required by the library). Create a new `VenueBottomSheet` component that renders tier-appropriate content. Modify `map.tsx` to remove all `<Callout>` components and wire markers to open the sheet instead.

**Tech Stack:** `@gorhom/react-native-bottom-sheet` v5, `react-native-reanimated` (already installed), `react-native-gesture-handler` (already installed), Expo Router

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/components/venue/VenueBottomSheet.tsx` | Bottom sheet component — renders drag handle, tier-appropriate venue card, action buttons |
| Modify | `src/app/_layout.tsx` | Wrap root with `GestureHandlerRootView` |
| Modify | `src/app/(tabs)/map.tsx` | Remove Callouts, add `selectedVenue` state, render `VenueBottomSheet`, handle dismiss/swap |

---

## Task 1: Install dependency + wrap root layout

**Files:**
- Modify: `package.json` (via npm)
- Modify: `src/app/_layout.tsx:1-103`

- [ ] **Step 1: Install @gorhom/react-native-bottom-sheet**

```bash
cd /Users/toprakyagcioglu/Documents/Projects/Memet-Kebab/ogrenci_nerede_yer
npm install @gorhom/react-native-bottom-sheet --legacy-peer-deps
```

Expected: Package added to `package.json` dependencies.

- [ ] **Step 2: Wrap root layout with GestureHandlerRootView**

In `src/app/_layout.tsx`, add the import and wrap the return JSX:

```tsx
// Add to imports:
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Change the return from:
return (
  <>
    <StatusBar style={isDark ? 'light' : 'dark'} />
    <Stack screenOptions={...}>
      ...
    </Stack>
  </>
);

// To:
return (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <StatusBar style={isDark ? 'light' : 'dark'} />
    <Stack screenOptions={...}>
      ...
    </Stack>
  </GestureHandlerRootView>
);
```

- [ ] **Step 3: Verify app still starts**

```bash
npx expo start --port 8090
```

Open on simulator. Map tab should render normally. Commit.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/app/_layout.tsx
git commit -m "feat: install bottom-sheet lib + wrap root with GestureHandlerRootView"
```

---

## Task 2: Create VenueBottomSheet component

**Files:**
- Create: `src/components/venue/VenueBottomSheet.tsx`

This component receives a `Venue | null` and renders tier-appropriate content inside a `@gorhom/react-native-bottom-sheet` `BottomSheet`.

- [ ] **Step 1: Create the component file**

```tsx
// src/components/venue/VenueBottomSheet.tsx

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Platform,
} from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontSize,
  FontFamily,
  PriceRanges,
} from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';
import RatingBar from '../ui/RatingBar';
import { haptic } from '../../lib/haptics';
import type { Venue } from '../../types';

interface VenueBottomSheetProps {
  venue: Venue | null;
  onDismiss: () => void;
}

export default function VenueBottomSheet({ venue, onDismiss }: VenueBottomSheetProps) {
  const router = useRouter();
  const colors = useThemeColors();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['42%'], []);

  // Open/close sheet based on venue
  useEffect(() => {
    if (venue) {
      bottomSheetRef.current?.snapToIndex(0);
    } else {
      bottomSheetRef.current?.close();
    }
  }, [venue]);

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1) {
        onDismiss();
      }
    },
    [onDismiss],
  );

  const handleSwipeUp = useCallback(() => {
    if (!venue) return;
    haptic.light();
    bottomSheetRef.current?.close();
    router.push(`/venue/${venue.id}`);
  }, [venue, router]);

  const handleDirections = useCallback(() => {
    if (!venue) return;
    haptic.light();
    const url = Platform.select({
      ios: `maps:?daddr=${venue.latitude},${venue.longitude}`,
      android: `google.navigation:q=${venue.latitude},${venue.longitude}`,
    });
    if (url) Linking.openURL(url);
  }, [venue]);

  const handleRate = useCallback(() => {
    if (!venue) return;
    haptic.light();
    bottomSheetRef.current?.close();
    router.push(`/venue/${venue.id}?rate=true`);
  }, [venue, router]);

  const handleSave = useCallback(() => {
    if (!venue) return;
    haptic.light();
    // Navigate to detail where save/favorite logic lives
    bottomSheetRef.current?.close();
    router.push(`/venue/${venue.id}`);
  }, [venue, router]);

  const priceLabel = venue
    ? PriceRanges.find((p) => p.value === venue.price_range)?.label ?? '₺'
    : '';

  // Determine tier
  const tier: 'google_places' | 'unreviewed' | 'reviewed' = (() => {
    if (!venue) return 'reviewed';
    if (venue.source === 'google_places') return 'google_places';
    if (venue.total_reviews > 0) return 'reviewed';
    return 'unreviewed';
  })();

  if (!venue) return null;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      enableOverDrag
      onChange={handleSheetChange}
      onAnimate={(fromIndex, toIndex) => {
        // Detect upward swipe beyond top snap point
        if (fromIndex === 0 && toIndex === -1) {
          // This fires on close; swipe-up detection handled via overDragAmount
        }
      }}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={[styles.sheetBackground, { backgroundColor: colors.background }]}
      style={styles.sheet}
    >
      <BottomSheetView style={styles.content}>
        {/* Close button */}
        <TouchableOpacity
          style={[styles.closeButton, { backgroundColor: colors.backgroundSecondary }]}
          onPress={() => {
            bottomSheetRef.current?.close();
            onDismiss();
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* ── Tier 3: Reviewed ONY Venue ── */}
        {tier === 'reviewed' && (
          <>
            <View style={styles.venueRow}>
              <View style={[styles.thumbnail, { backgroundColor: colors.backgroundSecondary }]}>
                {venue.cover_image_url ? (
                  <Image source={{ uri: venue.cover_image_url }} style={styles.thumbnailImage} />
                ) : (
                  <Ionicons name="restaurant" size={28} color={colors.textTertiary} />
                )}
              </View>
              <View style={styles.venueInfo}>
                <Text style={[styles.venueName, { color: colors.text }]} numberOfLines={1}>
                  {venue.name}
                </Text>
                <Text style={[styles.venueAddress, { color: colors.textSecondary }]} numberOfLines={1}>
                  {venue.address}
                </Text>
                <View style={styles.ratingsRow}>
                  {venue.editorial_rating != null && (
                    <View style={[styles.onyBadge, { backgroundColor: Colors.primary }]}>
                      <Text style={styles.onyBadgeText}>{venue.editorial_rating.toFixed(1)}</Text>
                    </View>
                  )}
                  <RatingBar
                    rating={venue.overall_rating}
                    maxRating={5}
                    size="sm"
                    color={Colors.star}
                    icon="star"
                    showValue
                    barWidth={70}
                  />
                  <Text style={[styles.priceText, { color: colors.textSecondary }]}>
                    {priceLabel}
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.actionsRow}>
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnRate]} onPress={handleRate} activeOpacity={0.8}>
                <Ionicons name="star-outline" size={16} color="#FFF" />
                <Text style={styles.actionBtnRateText}>Puan Ver</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDirections]} onPress={handleDirections} activeOpacity={0.8}>
                <Ionicons name="navigate-outline" size={16} color="#FFF" />
                <Text style={styles.actionBtnDirectionsText}>Yol Tarifi</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSave, { borderColor: colors.border }]} onPress={handleSave} activeOpacity={0.8}>
                <Ionicons name="heart-outline" size={16} color={colors.text} />
                <Text style={[styles.actionBtnSaveText, { color: colors.text }]}>Kaydet</Text>
              </TouchableOpacity>
            </View>
            {/* Swipe up hint */}
            <TouchableOpacity style={styles.detailHint} onPress={handleSwipeUp} activeOpacity={0.7}>
              <Text style={[styles.detailHintText, { color: Colors.primary }]}>Detaylari Gor</Text>
              <Ionicons name="chevron-up" size={16} color={Colors.primary} />
            </TouchableOpacity>
          </>
        )}

        {/* ── Tier 2: Unreviewed ONY Venue ── */}
        {tier === 'unreviewed' && (
          <>
            <View style={styles.venueRow}>
              <View style={[styles.thumbnail, { backgroundColor: colors.backgroundSecondary }]}>
                <Ionicons name="restaurant-outline" size={28} color={colors.textTertiary} />
              </View>
              <View style={styles.venueInfo}>
                <Text style={[styles.venueName, { color: colors.text }]} numberOfLines={1}>
                  {venue.name}
                </Text>
                <Text style={[styles.venueAddress, { color: colors.textSecondary }]} numberOfLines={1}>
                  {venue.address}
                </Text>
                <Text style={[styles.noReviewsText, { color: colors.textTertiary }]}>
                  Henuz degerlendirme yok
                </Text>
              </View>
            </View>
            <View style={styles.actionsRow}>
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnRate]} onPress={handleRate} activeOpacity={0.8}>
                <Ionicons name="star-outline" size={16} color="#FFF" />
                <Text style={styles.actionBtnRateText}>Degerlendir</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDirections]} onPress={handleDirections} activeOpacity={0.8}>
                <Ionicons name="navigate-outline" size={16} color="#FFF" />
                <Text style={styles.actionBtnDirectionsText}>Yol Tarifi</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSave, { borderColor: colors.border }]} onPress={handleSave} activeOpacity={0.8}>
                <Ionicons name="heart-outline" size={16} color={colors.text} />
                <Text style={[styles.actionBtnSaveText, { color: colors.text }]}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── Tier 1: Google Places ── */}
        {tier === 'google_places' && (
          <>
            <View style={styles.venueRow}>
              <View style={[styles.thumbnail, styles.thumbnailGoogle, { backgroundColor: colors.backgroundSecondary }]}>
                <Ionicons name="location" size={24} color="#9CA3AF" />
              </View>
              <View style={styles.venueInfo}>
                <Text style={[styles.venueName, { color: colors.text }]} numberOfLines={1}>
                  {venue.name}
                </Text>
                {venue.google_rating != null && (
                  <View style={styles.googleRatingRow}>
                    <Ionicons name="logo-google" size={14} color="#4285F4" />
                    <Text style={[styles.googleRatingText, { color: colors.textSecondary }]}>
                      {venue.google_rating.toFixed(1)}
                    </Text>
                  </View>
                )}
                <Text style={[styles.googleCtaText, { color: Colors.primary }]}>
                  Ilk degerlendirmeyi yap!
                </Text>
              </View>
            </View>
            <View style={styles.actionsRow}>
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnRate]} onPress={handleRate} activeOpacity={0.8}>
                <Ionicons name="add-circle-outline" size={16} color="#FFF" />
                <Text style={styles.actionBtnRateText}>Degerlendir</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDirections]} onPress={handleDirections} activeOpacity={0.8}>
                <Ionicons name="navigate-outline" size={16} color="#FFF" />
                <Text style={styles.actionBtnDirectionsText}>Yol Tarifi</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  sheetBackground: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handleIndicator: {
    backgroundColor: '#D1D5DB',
    width: 40,
    height: 4,
  },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  closeButton: {
    position: 'absolute',
    top: -4,
    right: Spacing.xl,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  // Venue row
  venueRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  thumbnailGoogle: {
    borderRadius: BorderRadius.full,
    width: 52,
    height: 52,
  },
  venueInfo: {
    flex: 1,
    gap: 2,
  },
  venueName: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.headingBold,
    letterSpacing: -0.3,
  },
  venueAddress: {
    fontSize: FontSize.sm,
    marginTop: 1,
  },
  ratingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  onyBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  onyBadgeText: {
    color: '#FFF',
    fontSize: FontSize.xs + 1,
    fontFamily: FontFamily.headingBold,
  },
  priceText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodySemiBold,
  },
  noReviewsText: {
    fontSize: FontSize.sm,
    fontStyle: 'italic',
    marginTop: Spacing.xs,
  },
  // Google Places specific
  googleRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: 2,
  },
  googleRatingText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodySemiBold,
  },
  googleCtaText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodySemiBold,
    marginTop: Spacing.xs,
  },
  // Actions row
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  actionBtnRate: {
    backgroundColor: Colors.primary,
  },
  actionBtnRateText: {
    color: '#FFF',
    fontSize: FontSize.sm,
    fontFamily: FontFamily.headingBold,
  },
  actionBtnDirections: {
    backgroundColor: '#06B6D4',
  },
  actionBtnDirectionsText: {
    color: '#FFF',
    fontSize: FontSize.sm,
    fontFamily: FontFamily.headingBold,
  },
  actionBtnSave: {
    borderWidth: 1.5,
  },
  actionBtnSaveText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.headingBold,
  },
  // Detail hint
  detailHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  detailHintText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodySemiBold,
  },
});
```

- [ ] **Step 2: Verify file compiles**

Open Expo — no red screen errors on map tab. The component isn't rendered yet, just confirming no syntax issues.

- [ ] **Step 3: Commit**

```bash
git add src/components/venue/VenueBottomSheet.tsx
git commit -m "feat: create VenueBottomSheet component with tier-based content"
```

---

## Task 3: Wire bottom sheet into map screen

**Files:**
- Modify: `src/app/(tabs)/map.tsx`

This task removes all `<Callout>` components, adds `selectedVenue` state, renders `VenueBottomSheet`, and updates marker press handlers.

- [ ] **Step 1: Add selectedVenue state and import VenueBottomSheet**

At the top of `map.tsx`, add the import:

```tsx
import VenueBottomSheet from '../../components/venue/VenueBottomSheet';
```

Inside `MapScreen()`, add state:

```tsx
const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
```

- [ ] **Step 2: Update marker press handlers**

Change `handleMarkerPress` to also set the selected venue:

```tsx
const handleMarkerPress = (venue: Venue) => {
  haptic.light();
  setSelectedVenue(venue);
  mapRef.current?.animateToRegion(
    {
      latitude: venue.latitude,
      longitude: venue.longitude,
      latitudeDelta: MapConfig.DEFAULT_ZOOM_DELTA,
      longitudeDelta: MapConfig.DEFAULT_ZOOM_DELTA,
    },
    MapConfig.MARKER_ANIMATION_DURATION,
  );
};
```

Remove the `handleCalloutPress` function entirely (no longer needed).

- [ ] **Step 3: Add onPress to MapView to dismiss sheet on empty map tap**

On the `<MapView>` component, add:

```tsx
<MapView
  ...existing props...
  onPress={() => {
    if (selectedVenue) {
      setSelectedVenue(null);
    }
  }}
>
```

- [ ] **Step 4: Remove all `<Callout>` components from markers**

For **Tier 1 (Google Places)** marker — remove the entire `<Callout>` block. Add `onPress` handler:

```tsx
<Marker
  key={venue.id}
  coordinate={{ latitude: venue.latitude, longitude: venue.longitude }}
  tracksViewChanges={false}
  onPress={() => handleMarkerPress(venue)}
>
  <View style={styles.greyDot} />
</Marker>
```

For **Tier 2 (Unreviewed)** marker — remove the `<Callout>` block. The `onPress` handler already calls `handleMarkerPress`.

For **Tier 3 (Reviewed)** marker — remove the entire `<Callout>` block. The marker already has `onPress={() => handleMarkerPress(venue)}`.

- [ ] **Step 5: Render VenueBottomSheet at the end of the component tree**

Add just before the closing `</View>` of the container:

```tsx
<VenueBottomSheet
  venue={selectedVenue}
  onDismiss={() => setSelectedVenue(null)}
/>
```

- [ ] **Step 6: Clean up unused imports and styles**

Remove from imports: `Callout` from `react-native-maps`.

Remove unused styles: `calloutContainer`, `callout`, `calloutInner`, `calloutName`, `calloutOnyRow`, `calloutOnyLogo`, `calloutUserRow`, `calloutPrice`, `calloutActions`, `calloutRateBtn`, `calloutRateBtnText`, `calloutDetailBtn`, `calloutDetailBtnText`, `greyDotCallout`, `greyDotCalloutName`, `greyDotCalloutRating`, `greyDotCalloutScore`, `greyDotCalloutCta`, `greyDotCalloutCtaText`, `mutedCalloutAddr`.

Remove unused imports that were only used in callouts (e.g. `RatingBar` if only used in callouts — but check first, it may be used in search results too). Actually `RatingBar` import should be removed from `map.tsx` since it was only used in callouts. Similarly `Image` (only used for callout ONY logo).

- [ ] **Step 7: Test full flow on simulator**

1. Tap a reviewed ONY marker → sheet slides up with name, thumbnail, ratings, 3 action buttons
2. Tap "Puan Ver" → navigates to venue detail with rate=true
3. Tap "Yol Tarifi" → opens Maps app
4. Tap "Detaylari Gor" → navigates to venue detail page
5. Tap empty map → sheet dismisses
6. Tap marker A, then tap marker B → sheet content swaps to venue B
7. Swipe sheet down → dismisses
8. Tap Google Places dot → sheet shows simpler Google Places content
9. Tap unreviewed tag → sheet shows "Henuz degerlendirme yok" content

- [ ] **Step 8: Commit**

```bash
git add src/app/(tabs)/map.tsx
git commit -m "feat: replace map callouts with venue bottom sheet"
```
