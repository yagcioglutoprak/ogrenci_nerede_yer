import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  Pressable,
  Linking,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../lib/constants';
import { haptic } from '../lib/haptics';
import { MOCK_STORIES, MOCK_VENUES } from '../lib/mockData';
import type { Story } from '../types';

// Lookup venue name by ID
function getVenueName(venueId?: string): string | null {
  if (!venueId) return null;
  const venue = MOCK_VENUES.find((v) => v.id === venueId);
  return venue?.name || null;
}

// ---------------------------------------------------------------------------
// Bouncing arrow hint — "Videoya Git"
// ---------------------------------------------------------------------------

function SwipeUpHint() {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.swipeHint, animStyle]}>
      <Ionicons name="chevron-up" size={20} color="rgba(255,255,255,0.8)" />
      <Text style={styles.swipeHintText}>Videoya Git</Text>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Progress bar — shows current position among reels
// ---------------------------------------------------------------------------

function ProgressBars({ count, activeIndex, top }: { count: number; activeIndex: number; top: number }) {
  return (
    <View style={[styles.progressContainer, { top: top + Spacing.sm }]}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.progressBar,
            { backgroundColor: i <= activeIndex ? '#FFFFFF' : 'rgba(255,255,255,0.3)' },
          ]}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Single reel view — one video at a time
// ---------------------------------------------------------------------------

function ActiveReel({
  story,
  venueName,
}: {
  story: Story;
  venueName: string | null;
}) {
  const player = useVideoPlayer(story.video_url, (p) => {
    p.loop = true;
  });

  const { isPlaying } = useEvent(player, 'playingChange', {
    isPlaying: player.playing,
  });

  // Auto-play on mount
  useEffect(() => {
    player.play();
    return () => {
      player.pause();
    };
  }, []);

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
    haptic.light();
  }, [isPlaying]);

  return (
    <>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />

      {/* Invisible center tap to toggle play/pause */}
      <Pressable
        style={styles.centerTapZone}
        onPress={togglePlayback}
      />

      {/* Paused indicator */}
      {!isPlaying && (
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
    </>
  );
}

// ---------------------------------------------------------------------------
// Main Reels screen
// ---------------------------------------------------------------------------

export default function ReelsScreen() {
  const router = useRouter();
  const { index: initialIndexParam } = useLocalSearchParams<{ index?: string }>();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const initialIndex = Math.min(
    parseInt(initialIndexParam || '0', 10),
    MOCK_STORIES.length - 1,
  );
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const story = MOCK_STORIES[currentIndex];
  const venueName = getVenueName(story.venue_id);

  const goNext = useCallback(() => {
    if (currentIndex < MOCK_STORIES.length - 1) {
      setCurrentIndex((i) => i + 1);
      haptic.selection();
    }
  }, [currentIndex]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      haptic.selection();
    }
  }, [currentIndex]);

  const handleClose = useCallback(() => {
    router.back();
  }, []);

  const handleVenuePress = useCallback(() => {
    if (story.venue_id) {
      router.push(`/venue/${story.venue_id}`);
    }
  }, [story.venue_id]);

  const handleSwipeUpToVideo = useCallback(() => {
    if (story.external_url) {
      Linking.openURL(story.external_url);
    } else if (story.video_url) {
      Linking.openURL(story.video_url);
    }
  }, [story.external_url, story.video_url]);

  // Pan responder for vertical swipes
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        // Only capture vertical gestures
        return Math.abs(gs.dy) > 20 && Math.abs(gs.dy) > Math.abs(gs.dx);
      },
      onPanResponderRelease: (
        _: GestureResponderEvent,
        gs: PanResponderGestureState,
      ) => {
        if (gs.dy < -80) {
          // Swipe up → open video URL
          handleSwipeUpToVideo();
        } else if (gs.dy > 80) {
          // Swipe down → close
          handleClose();
        }
      },
    }),
  ).current;

  // Tap zones: left 30% = prev, right 30% = next
  const TAP_ZONE = width * 0.3;

  const handleTap = useCallback(
    (evt: GestureResponderEvent) => {
      const x = evt.nativeEvent.locationX;
      if (x < TAP_ZONE) {
        goPrev();
      } else if (x > width - TAP_ZONE) {
        goNext();
      }
      // Middle 40% does nothing (handled by center play/pause)
    },
    [TAP_ZONE, width, goPrev, goNext],
  );

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <StatusBar style="light" />

      {/* Video */}
      <ActiveReel
        key={story.id}
        story={story}
        venueName={venueName}
      />

      {/* Left/Right tap zones */}
      <Pressable style={[styles.tapZone, { left: 0, width: TAP_ZONE }]} onPress={goPrev} />
      <Pressable style={[styles.tapZone, { right: 0, width: TAP_ZONE }]} onPress={goNext} />

      {/* Progress bars */}
      <ProgressBars count={MOCK_STORIES.length} activeIndex={currentIndex} top={insets.top} />

      {/* Top: close button */}
      <LinearGradient
        colors={['rgba(0,0,0,0.5)', 'transparent']}
        style={[styles.topGradient, { paddingTop: insets.top + Spacing.xl + Spacing.sm }]}
        pointerEvents="box-none"
      >
        <Pressable
          style={styles.closeButton}
          onPress={handleClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-down" size={28} color="#FFFFFF" />
        </Pressable>
      </LinearGradient>

      {/* Bottom: venue name + title + swipe hint */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.75)']}
        style={[styles.bottomGradient, { paddingBottom: insets.bottom + Spacing.lg }]}
        pointerEvents="box-none"
      >
        {/* Venue name + story title — tappable to go to venue */}
        <Pressable
          onPress={handleVenuePress}
          style={styles.venueInfoTouchable}
          disabled={!story.venue_id}
        >
          {venueName && (
            <View style={styles.venueNameRow}>
              <Ionicons name="restaurant" size={14} color={Colors.accent} />
              <Text style={styles.venueName}>{venueName}</Text>
              <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.5)" />
            </View>
          )}
          <Text style={styles.storyTitle}>{story.title}</Text>
        </Pressable>

        {/* Swipe up hint */}
        <SwipeUpHint />
      </LinearGradient>
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

  // Tap zones (invisible)
  tapZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    zIndex: 5,
  },
  centerTapZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '30%',
    right: '30%',
    zIndex: 4,
  },

  // Progress bars
  progressContainer: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    gap: 4,
    zIndex: 20,
  },
  progressBar: {
    flex: 1,
    height: 2.5,
    borderRadius: 2,
  },

  // Pause overlay
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  pauseCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.4)',
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
    paddingBottom: Spacing.xxxl,
    zIndex: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
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
    paddingTop: Spacing.xxxl * 3,
    zIndex: 10,
  },
  venueInfoTouchable: {
    marginBottom: Spacing.lg,
  },
  venueNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    marginBottom: Spacing.xs,
  },
  venueName: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.headingBold,
    color: Colors.accent,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  storyTitle: {
    fontSize: FontSize.xxl,
    fontFamily: FontFamily.heading,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // Swipe up hint
  swipeHint: {
    alignItems: 'center',
    gap: 2,
  },
  swipeHintText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemiBold,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
  },
});
