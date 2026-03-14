import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  Pressable,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  interpolate,
  Extrapolation,
  runOnJS,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { Colors, Spacing, FontSize, FontFamily, SpringConfig } from '../lib/constants';
import { haptic } from '../lib/haptics';
import type { Story } from '../types';

// ---------------------------------------------------------------------------
// Bouncing arrow hint
// ---------------------------------------------------------------------------

function SwipeUpHint() {
  const ty = useSharedValue(0);

  useEffect(() => {
    ty.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(ty);
    };
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ty.value }],
  }));

  return (
    <Animated.View style={[styles.swipeHint, animStyle]}>
      <Ionicons name="chevron-up" size={20} color="rgba(255,255,255,0.8)" />
      <Text style={styles.swipeHintText}>Videoya Git</Text>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Progress bars
// ---------------------------------------------------------------------------

function ProgressBars({
  count,
  activeIndex,
  top,
}: {
  count: number;
  activeIndex: number;
  top: number;
}) {
  return (
    <View style={[styles.progressContainer, { top: top + Spacing.sm }]}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.progressBar,
            {
              backgroundColor:
                i <= activeIndex ? '#FFFFFF' : 'rgba(255,255,255,0.3)',
            },
          ]}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Single reel — owns its own VideoPlayer
// ---------------------------------------------------------------------------

function ActiveReel({ story }: { story: Story }) {
  const player = useVideoPlayer(story.video_url, (p) => {
    p.loop = true;
  });

  const { isPlaying } = useEvent(player, 'playingChange', {
    isPlaying: player.playing,
  });

  const hasPlayedOnce = useRef(false);
  const [userPaused, setUserPaused] = useState(false);

  useEffect(() => {
    if (isPlaying) {
      hasPlayedOnce.current = true;
      setUserPaused(false);
    }
  }, [isPlaying]);

  useEffect(() => {
    player.play();
  }, []);

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      player.pause();
      setUserPaused(true);
    } else {
      player.play();
      setUserPaused(false);
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

      <Pressable style={styles.centerTapZone} onPress={togglePlayback} />

      {userPaused && hasPlayedOnce.current && (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(150)}
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

const DISMISS_THRESHOLD = 180;

export default function ReelsScreen() {
  const router = useRouter();
  const { index: initialIndexParam } = useLocalSearchParams<{
    index?: string;
  }>();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Stories will come from Supabase in the future — empty for now
  const stories: Story[] = [];

  const initialIndex = stories.length > 0
    ? Math.min(parseInt(initialIndexParam || '0', 10), stories.length - 1)
    : 0;
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const story = stories[currentIndex] ?? null;
  const venueName = story?.venue_id ? null : null; // venue name lookup will come from Supabase

  // Refs for stable closures inside worklets / runOnJS
  const currentIndexRef = useRef(currentIndex);
  const storyRef = useRef<Story | null>(story);
  useEffect(() => {
    currentIndexRef.current = currentIndex;
    storyRef.current = story;
  }, [currentIndex, story]);

  // ---- Shared values ----
  const dismissY = useSharedValue(0);
  const gestureDir = useSharedValue<'none' | 'vertical' | 'horizontal'>(
    'none',
  );
  const reelFade = useSharedValue(1);

  // ---- Navigation (called from worklet via runOnJS) ----
  const doGoNext = useCallback(() => {
    setCurrentIndex((i) => (i < stories.length - 1 ? i + 1 : i));
    reelFade.value = withTiming(1, { duration: 200 });
  }, [stories.length]);

  const doGoPrev = useCallback(() => {
    setCurrentIndex((i) => (i > 0 ? i - 1 : i));
    reelFade.value = withTiming(1, { duration: 200 });
  }, []);

  // ---- Animated navigation (with crossfade) ----
  const goNextAnimated = useCallback(() => {
    if (currentIndexRef.current >= stories.length - 1) return;
    haptic.selection();
    reelFade.value = withTiming(0, { duration: 100 }, (finished) => {
      if (finished) runOnJS(doGoNext)();
    });
  }, [doGoNext]);

  const goPrevAnimated = useCallback(() => {
    if (currentIndexRef.current <= 0) return;
    haptic.selection();
    reelFade.value = withTiming(0, { duration: 100 }, (finished) => {
      if (finished) runOnJS(doGoPrev)();
    });
  }, [doGoPrev]);

  const handleClose = useCallback(() => {
    router.back();
  }, []);

  const handleVenuePress = useCallback(() => {
    if (storyRef.current?.venue_id) {
      router.push(`/venue/${storyRef.current.venue_id}`);
    }
  }, []);

  const openVideoUrl = useCallback(() => {
    const s = storyRef.current;
    const url = s?.external_url || s?.video_url;
    if (url) Linking.openURL(url);
  }, []);

  // ---- Pan gesture for interactive dismiss & horizontal navigation ----
  const panGesture = Gesture.Pan()
    .minDistance(15)
    .onBegin(() => {
      gestureDir.value = 'none';
    })
    .onUpdate((e) => {
      // Lock direction on first significant movement
      if (gestureDir.value === 'none') {
        if (Math.abs(e.translationY) > 10 || Math.abs(e.translationX) > 10) {
          gestureDir.value =
            Math.abs(e.translationY) > Math.abs(e.translationX)
              ? 'vertical'
              : 'horizontal';
        }
      }
      // Interactive: follow finger on downward swipe
      if (gestureDir.value === 'vertical' && e.translationY > 0) {
        dismissY.value = e.translationY;
      }
    })
    .onEnd((e) => {
      const isVert = gestureDir.value === 'vertical';

      if (isVert && e.translationY > DISMISS_THRESHOLD) {
        // Dismiss — animate off-screen then close
        dismissY.value = withSpring(height, SpringConfig.snappy, () => {
          runOnJS(handleClose)();
        });
      } else if (isVert && e.translationY < -80) {
        // Swipe up — open video URL
        dismissY.value = withSpring(0, SpringConfig.snappy);
        runOnJS(openVideoUrl)();
      } else if (!isVert && e.translationX < -50) {
        // Swipe left — next reel
        runOnJS(goNextAnimated)();
      } else if (!isVert && e.translationX > 50) {
        // Swipe right — previous reel
        runOnJS(goPrevAnimated)();
      } else {
        // Spring back
        dismissY.value = withSpring(0, SpringConfig.snappy);
      }
      gestureDir.value = 'none';
    })
    .onFinalize((_, success) => {
      // Safety: if gesture was cancelled mid-drag, spring back
      if (!success && dismissY.value > 0) {
        dismissY.value = withSpring(0, SpringConfig.snappy);
      }
      gestureDir.value = 'none';
    });

  // ---- Animated styles ----
  const dismissStyle = useAnimatedStyle(() => {
    const progress = dismissY.value;
    const scale = interpolate(
      progress,
      [0, 400],
      [1, 0.88],
      Extrapolation.CLAMP,
    );
    const borderRadius = interpolate(
      progress,
      [0, 150],
      [0, 20],
      Extrapolation.CLAMP,
    );
    const opacity = interpolate(
      progress,
      [0, 400],
      [1, 0.7],
      Extrapolation.CLAMP,
    );
    return {
      transform: [{ translateY: progress > 0 ? progress : 0 }, { scale }],
      borderRadius,
      opacity,
    };
  });

  const reelStyle = useAnimatedStyle(() => ({
    opacity: reelFade.value,
  }));

  const TAP_ZONE = width * 0.3;

  // Empty state when there are no stories
  if (!story) {
    return (
      <View style={styles.outerContainer}>
        <StatusBar style="light" />
        <View style={styles.emptyContainer}>
          <Ionicons name="videocam-off-outline" size={48} color="rgba(255,255,255,0.5)" />
          <Text style={styles.emptyText}>Henuz icerik yok</Text>
          <Pressable style={styles.emptyBackButton} onPress={() => router.back()}>
            <Text style={styles.emptyBackButtonText}>Geri Don</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.outerContainer}>
      <StatusBar style="light" />
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.container, dismissStyle]}>
          {/* Video with crossfade */}
          <Animated.View style={[StyleSheet.absoluteFill, reelStyle]}>
            <ActiveReel key={story.id} story={story} />
          </Animated.View>

          {/* Left / Right tap zones */}
          <Pressable
            style={[styles.tapZone, { left: 0, width: TAP_ZONE }]}
            onPress={goPrevAnimated}
          />
          <Pressable
            style={[styles.tapZone, { right: 0, width: TAP_ZONE }]}
            onPress={goNextAnimated}
          />

          {/* Progress bars */}
          <ProgressBars
            count={stories.length}
            activeIndex={currentIndex}
            top={insets.top}
          />

          {/* Top: close button */}
          <LinearGradient
            colors={['rgba(0,0,0,0.5)', 'transparent']}
            style={[
              styles.topGradient,
              { paddingTop: insets.top + Spacing.xl + Spacing.sm },
            ]}
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
            style={[
              styles.bottomGradient,
              { paddingBottom: insets.bottom + Spacing.lg },
            ]}
            pointerEvents="box-none"
          >
            <Pressable
              onPress={handleVenuePress}
              style={styles.venueInfoTouchable}
              disabled={!story.venue_id}
            >
              {venueName && (
                <View style={styles.venueNameRow}>
                  <Ionicons
                    name="restaurant"
                    size={14}
                    color={Colors.accent}
                  />
                  <Text style={styles.venueName}>{venueName}</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={14}
                    color="rgba(255,255,255,0.5)"
                  />
                </View>
              )}
              <Text style={styles.storyTitle}>{story.title}</Text>
            </Pressable>

            <SwipeUpHint />
          </LinearGradient>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
  },

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

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    paddingBottom: 60,
  },
  emptyText: {
    fontSize: FontSize.xl,
    fontFamily: FontFamily.headingBold,
    color: 'rgba(255,255,255,0.8)',
  },
  emptyBackButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginTop: Spacing.md,
  },
  emptyBackButtonText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
    color: '#FFFFFF',
  },
});
