# ONY Reels / Stories Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Instagram Reels-style story bubbles to the feed screen that open a fullscreen vertical video viewer with swipe navigation.

**Architecture:** New `Story` type + mock data -> `StoriesBar` horizontal component in feed -> `reels.tsx` fullscreen modal with expo-av Video + vertical paging FlatList. No new store needed.

**Tech Stack:** expo-av (new), react-native-reanimated (existing), expo-linear-gradient (existing), expo-linking (existing)

---

### Task 1: Install expo-av

**Step 1: Install dependency**

Run: `npx expo install expo-av`

**Step 2: Verify installation**

Run: `cat package.json | grep expo-av`
Expected: `"expo-av"` appears in dependencies

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add expo-av for video playback"
```

---

### Task 2: Add Story type and mock data

**Files:**
- Modify: `src/types/index.ts` (after `SocialVideo` interface, line ~55)
- Modify: `src/lib/mockData.ts` (after `MOCK_SOCIAL_VIDEOS` array, line ~2657)

**Step 1: Add Story interface to types**

In `src/types/index.ts`, after the `SocialVideo` interface (line 55), add:

```ts
export interface Story {
  id: string;
  title: string;
  thumbnail_url: string;
  video_url: string;
  external_url: string;
  venue_id?: string;
}
```

**Step 2: Add MOCK_STORIES to mockData.ts**

In `src/lib/mockData.ts`, add `Story` to the import from `../types`, then after `MOCK_SOCIAL_VIDEOS` (line ~2657), add:

```ts
// ==========================================
// MOCK STORIES (ONY Reels)
// ==========================================
export const MOCK_STORIES: Story[] = [
  {
    id: 'story-001',
    title: 'Cigkofte Turu',
    thumbnail_url: 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=400&h=400&fit=crop',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    external_url: 'https://youtube.com/shorts/example1',
    venue_id: 'v-004',
  },
  {
    id: 'story-002',
    title: 'Ucuz Kahvalti',
    thumbnail_url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=400&fit=crop',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    external_url: 'https://youtube.com/shorts/example2',
    venue_id: 'v-003',
  },
  {
    id: 'story-003',
    title: 'Doner Kapismasi',
    thumbnail_url: 'https://images.unsplash.com/photo-1565299507177-b0ac66763828?w=400&h=400&fit=crop',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    external_url: 'https://tiktok.com/@ony/video/example3',
    venue_id: 'v-004',
  },
  {
    id: 'story-004',
    title: 'Balik Ekmek',
    thumbnail_url: 'https://images.unsplash.com/photo-1534604973900-c43ab4c2e0ab?w=400&h=400&fit=crop',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    external_url: 'https://youtube.com/shorts/example4',
    venue_id: 'v-006',
  },
  {
    id: 'story-005',
    title: 'Tost Rehberi',
    thumbnail_url: 'https://images.unsplash.com/photo-1553909489-cd47e0907980?w=400&h=400&fit=crop',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    external_url: 'https://instagram.com/reel/example5',
    venue_id: 'v-002',
  },
  {
    id: 'story-006',
    title: 'Kofte Dunyasi',
    thumbnail_url: 'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?w=400&h=400&fit=crop',
    video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    external_url: 'https://youtube.com/shorts/example6',
  },
];
```

Note: Video URLs use Google's public sample videos for development. Replace with real ONY videos later.

**Step 3: Commit**

```bash
git add src/types/index.ts src/lib/mockData.ts
git commit -m "feat: add Story type and MOCK_STORIES data for ONY Reels"
```

---

### Task 3: Create StoriesBar component

**Files:**
- Create: `src/components/feed/StoriesBar.tsx`

**Step 1: Create the component**

```tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Colors, Spacing, FontSize, FontFamily } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';
import { MOCK_STORIES } from '../../lib/mockData';
import type { Story } from '../../types';

const CIRCLE_SIZE = 68;
const BORDER_WIDTH = 2.5;

export default function StoriesBar() {
  const colors = useThemeColors();
  const router = useRouter();
  const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set());

  const handleStoryPress = useCallback((index: number) => {
    const story = MOCK_STORIES[index];
    setWatchedIds((prev) => new Set(prev).add(story.id));
    router.push({ pathname: '/reels', params: { startIndex: index.toString() } });
  }, []);

  const renderStory = useCallback(
    ({ item, index }: { item: Story; index: number }) => {
      const isWatched = watchedIds.has(item.id);

      return (
        <TouchableOpacity
          style={styles.storyItem}
          onPress={() => handleStoryPress(index)}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[Colors.primary, Colors.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.gradientBorder, isWatched && { opacity: 0.4 }]}
          >
            <View style={[styles.imageWrapper, { backgroundColor: colors.background }]}>
              <Image source={{ uri: item.thumbnail_url }} style={styles.thumbnail} />
            </View>
          </LinearGradient>
          <Text
            style={[styles.title, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
        </TouchableOpacity>
      );
    },
    [watchedIds, colors],
  );

  if (MOCK_STORIES.length === 0) return null;

  return (
    <View style={styles.container}>
      <FlatList
        data={MOCK_STORIES}
        keyExtractor={(item) => item.id}
        renderItem={renderStory}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: Spacing.md,
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  storyItem: {
    alignItems: 'center',
    width: CIRCLE_SIZE + 8,
  },
  gradientBorder: {
    width: CIRCLE_SIZE + BORDER_WIDTH * 2,
    height: CIRCLE_SIZE + BORDER_WIDTH * 2,
    borderRadius: (CIRCLE_SIZE + BORDER_WIDTH * 2) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrapper: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemiBold,
    marginTop: Spacing.xs,
    textAlign: 'center',
    maxWidth: CIRCLE_SIZE + 8,
  },
});
```

**Step 2: Commit**

```bash
git add src/components/feed/StoriesBar.tsx
git commit -m "feat: create StoriesBar component with gradient circles"
```

---

### Task 4: Create Reels viewer screen

**Files:**
- Create: `src/app/reels.tsx`

**Step 1: Create the fullscreen Reels viewer**

```tsx
import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Linking,
  ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Video, ResizeMode } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, Spacing, FontSize, FontFamily, BorderRadius } from '../lib/constants';
import { MOCK_STORIES } from '../lib/mockData';
import { MOCK_VENUES } from '../lib/mockData';
import type { Story } from '../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function ReelsScreen() {
  const router = useRouter();
  const { startIndex } = useLocalSearchParams<{ startIndex: string }>();
  const initialIndex = parseInt(startIndex || '0', 10);

  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const videoRefs = useRef<Record<number, Video | null>>({});

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        const newIndex = viewableItems[0].index ?? 0;
        setActiveIndex(newIndex);
      }
    },
    [],
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const handleOpenExternal = useCallback((url: string) => {
    Linking.openURL(url);
  }, []);

  const handleVenuePress = useCallback((venueId: string) => {
    router.back();
    setTimeout(() => router.push(`/venue/${venueId}`), 300);
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: Story; index: number }) => {
      const isActive = index === activeIndex;
      const venue = item.venue_id
        ? MOCK_VENUES.find((v) => v.id === item.venue_id)
        : null;

      return (
        <View style={styles.reelContainer}>
          <Video
            ref={(ref) => { videoRefs.current[index] = ref; }}
            source={{ uri: item.video_url }}
            style={styles.video}
            resizeMode={ResizeMode.COVER}
            shouldPlay={isActive}
            isLooping
            isMuted={false}
          />

          {/* Top overlay */}
          <SafeAreaView style={styles.topOverlay} edges={['top']}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => router.back()}
            >
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{item.title}</Text>
            <View style={{ width: 28 }} />
          </SafeAreaView>

          {/* Bottom overlay */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            style={styles.bottomOverlay}
          >
            <View style={styles.bottomContent}>
              <Text style={styles.reelTitle}>{item.title}</Text>

              {venue && (
                <TouchableOpacity
                  style={styles.venueChip}
                  onPress={() => handleVenuePress(venue.id)}
                >
                  <Ionicons name="location" size={14} color={Colors.primary} />
                  <Text style={styles.venueChipText}>{venue.name}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.watchButton}
                onPress={() => handleOpenExternal(item.external_url)}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[Colors.primary, Colors.primaryDark]}
                  style={styles.watchButtonGradient}
                >
                  <Ionicons name="play-circle" size={20} color="#FFFFFF" />
                  <Text style={styles.watchButtonText}>Videoyu Izle</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      );
    },
    [activeIndex],
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={MOCK_STORIES}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        pagingEnabled
        snapToInterval={SCREEN_HEIGHT}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        getItemLayout={(_, index) => ({
          length: SCREEN_HEIGHT,
          offset: SCREEN_HEIGHT * index,
          index,
        })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  reelContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    position: 'relative',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.headingBold,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 100,
    paddingTop: 60,
    paddingHorizontal: Spacing.xl,
  },
  bottomContent: {
    gap: Spacing.md,
  },
  reelTitle: {
    fontSize: FontSize.xl,
    fontFamily: FontFamily.heading,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  venueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  venueChipText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodySemiBold,
    color: Colors.text,
  },
  watchButton: {
    alignSelf: 'flex-start',
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  watchButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  watchButtonText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
    color: '#FFFFFF',
  },
});
```

**Step 2: Commit**

```bash
git add src/app/reels.tsx
git commit -m "feat: create fullscreen Reels viewer with expo-av"
```

---

### Task 5: Register reels route in root layout

**Files:**
- Modify: `src/app/_layout.tsx` (line ~97, after the last Stack.Screen)

**Step 1: Add reels screen to Stack**

After the `chat/new` Stack.Screen (line 98), add:

```tsx
<Stack.Screen name="reels" options={{ presentation: 'fullScreenModal', headerShown: false, animation: 'slide_from_bottom' }} />
```

**Step 2: Commit**

```bash
git add src/app/_layout.tsx
git commit -m "feat: register reels route as fullscreen modal"
```

---

### Task 6: Integrate StoriesBar into feed screen

**Files:**
- Modify: `src/app/(tabs)/feed.tsx`

**Step 1: Import StoriesBar**

Add import at the top (after other component imports, around line 38):

```ts
import StoriesBar from '../../components/feed/StoriesBar';
```

**Step 2: Add StoriesBar to the feed layout**

In the `renderHeader` function (line 338), wrap the existing content and prepend StoriesBar. Replace the `renderHeader` function:

```tsx
const renderHeader = () => (
  <>
    <StoriesBar />
    <View style={styles.categoryRow}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryScroll}
      >
        <View style={styles.chipContainer}>
          <Animated.View
            style={[
              styles.chipIndicator,
              { backgroundColor: Colors.primary },
              indicatorStyle,
            ]}
          />
          {CATEGORIES.map((cat) => {
            const isActive = category === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                onLayout={(e) => handleChipLayout(cat.key, e)}
                style={styles.categoryChip}
                onPress={() => handleCategoryChange(cat.key)}
                activeOpacity={0.7}
                accessibilityRole="tab"
                accessibilityLabel={cat.label + ' kategorisi'}
                accessibilityState={{ selected: isActive }}
              >
                <Ionicons
                  name={cat.icon}
                  size={14}
                  color={isActive ? '#FFFFFF' : colors.textTertiary}
                />
                <Text
                  style={[
                    styles.categoryChipText,
                    isActive ? styles.categoryChipTextActive : { color: colors.textSecondary },
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  </>
);
```

**Step 3: Commit**

```bash
git add src/app/(tabs)/feed.tsx
git commit -m "feat: integrate StoriesBar into feed screen"
```

---

### Task 7: Manual smoke test

**Step 1: Start the app**

Run: `npx expo start --port 8090`

**Step 2: Verify on simulator**

1. Open Feed tab — story circles should appear at top with gradient borders
2. Tap a story — fullscreen video modal should open and autoplay
3. Swipe up — should navigate to next video
4. Tap "Videoyu Izle" — should open external URL
5. Tap venue chip — should navigate to venue detail
6. Tap X or swipe down — should close modal
7. Return to feed — tapped story should have faded gradient border

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: ONY Reels — stories bar + fullscreen video viewer"
```
