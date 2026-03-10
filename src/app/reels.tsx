import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Platform,
  ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../lib/constants';
import { haptic } from '../lib/haptics';
import { MOCK_STORIES } from '../lib/mockData';
import type { Story } from '../types';

// ---------------------------------------------------------------------------
// Single reel item — owns its own VideoPlayer
// ---------------------------------------------------------------------------

function ReelItem({
  story,
  isActive,
  width,
  height,
  insets,
  onClose,
  onVenuePress,
}: {
  story: Story;
  isActive: boolean;
  width: number;
  height: number;
  insets: { top: number; bottom: number };
  onClose: () => void;
  onVenuePress: (venueId: string) => void;
}) {
  const player = useVideoPlayer(story.video_url, (p) => {
    p.loop = true;
    p.volume = 1;
  });

  const { isPlaying } = useEvent(player, 'playingChange', {
    isPlaying: player.playing,
  });

  // Play/pause based on visibility
  useEffect(() => {
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive]);

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
    haptic.light();
  }, [isPlaying]);

  return (
    <View style={{ width, height }}>
      {/* Video */}
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />

      {/* Tap to play/pause */}
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={togglePlayback}
      />

      {/* Paused indicator */}
      {!isPlaying && isActive && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={styles.pauseOverlay}
          pointerEvents="none"
        >
          <View style={styles.pauseCircle}>
            <Ionicons name="play" size={40} color="#FFFFFF" />
          </View>
        </Animated.View>
      )}

      {/* Top gradient + close button */}
      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'transparent']}
        style={[styles.topGradient, { paddingTop: insets.top + Spacing.sm }]}
        pointerEvents="box-none"
      >
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Bottom gradient + info */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.7)']}
        style={[styles.bottomGradient, { paddingBottom: insets.bottom + Spacing.xl }]}
        pointerEvents="box-none"
      >
        <Text style={styles.storyTitle}>{story.title}</Text>

        {story.venue_id && (
          <TouchableOpacity
            style={styles.venueChip}
            onPress={() => onVenuePress(story.venue_id!)}
            activeOpacity={0.8}
          >
            <Ionicons name="restaurant" size={14} color="#FFFFFF" />
            <Text style={styles.venueChipText}>Mekani Gor</Text>
            <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        )}
      </LinearGradient>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Reels screen — vertical paging FlatList
// ---------------------------------------------------------------------------

export default function ReelsScreen() {
  const router = useRouter();
  const { index: initialIndexParam } = useLocalSearchParams<{ index?: string }>();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const initialIndex = parseInt(initialIndexParam || '0', 10);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const flatListRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
        haptic.selection();
      }
    },
    [],
  );

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  const handleClose = useCallback(() => {
    router.back();
  }, []);

  const handleVenuePress = useCallback((venueId: string) => {
    router.push(`/venue/${venueId}`);
  }, []);

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: height,
      offset: height * index,
      index,
    }),
    [height],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: Story; index: number }) => (
      <ReelItem
        story={item}
        isActive={index === activeIndex}
        width={width}
        height={height}
        insets={insets}
        onClose={handleClose}
        onVenuePress={handleVenuePress}
      />
    ),
    [activeIndex, width, height, insets],
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <FlatList
        ref={flatListRef}
        data={MOCK_STORIES}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        pagingEnabled
        horizontal={false}
        showsVerticalScrollIndicator={false}
        snapToInterval={height}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={getItemLayout}
        initialScrollIndex={initialIndex}
        removeClippedSubviews={Platform.OS === 'android'}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Pause overlay
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
  },

  // Top gradient
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Bottom gradient
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxxl * 2,
  },
  storyTitle: {
    fontSize: FontSize.xxl,
    fontFamily: FontFamily.heading,
    color: '#FFFFFF',
    marginBottom: Spacing.md,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  venueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  venueChipText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.headingBold,
    color: '#FFFFFF',
  },
});
