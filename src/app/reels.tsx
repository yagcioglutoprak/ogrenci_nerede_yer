import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Dimensions,
  Linking,
  ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoView } from 'expo-video';
import { useReleasingSharedObject } from 'expo-modules-core';
// @ts-expect-error: internal module access to work around Expo Go constructor arg mismatch
import NativeVideoModule from 'expo-video/build/NativeVideoModule';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  FadeIn,
  FadeOut,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Colors, Spacing, FontSize, FontFamily, BorderRadius } from '../lib/constants';
import { MOCK_STORIES, MOCK_VENUES } from '../lib/mockData';
import type { Story } from '../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 120;

function useVideoPlayerCompat(source: string) {
  return useReleasingSharedObject(() => {
    return new NativeVideoModule.VideoPlayer({ uri: source }, false);
  }, [source]);
}

// Animated swipe-up hint with bouncing arrow
function SwipeUpHint() {
  const arrowY = useSharedValue(0);

  useEffect(() => {
    arrowY.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 600, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, []);

  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: arrowY.value }],
  }));

  return (
    <View style={styles.swipeUpHint}>
      <Animated.View style={arrowStyle}>
        <Ionicons name="chevron-up" size={26} color="#FFFFFF" />
      </Animated.View>
      <Text style={styles.swipeUpLabel}>Yukari kaydir</Text>
      <LinearGradient
        colors={[Colors.primary, Colors.primaryDark]}
        style={styles.swipeUpPill}
      >
        <Ionicons name="play" size={14} color="#FFFFFF" />
        <Text style={styles.swipeUpText}>Videoyu Izle</Text>
      </LinearGradient>
    </View>
  );
}

// Subtle animated navigation arrow (no background box)
function NavArrow({ direction, onPress }: { direction: 'left' | 'right'; onPress?: () => void }) {
  const offset = useSharedValue(0);

  useEffect(() => {
    const movement = direction === 'right' ? 5 : -5;
    offset.value = withDelay(
      500,
      withRepeat(
        withSequence(
          withTiming(movement, { duration: 600, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        ),
        3,
        false,
      ),
    );
  }, [direction]);

  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}
      style={[
        styles.navArrow,
        direction === 'right' ? styles.navArrowRight : styles.navArrowLeft,
        arrowStyle,
      ]}
    >
      <TouchableOpacity onPress={onPress} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
        <Ionicons
          name={direction === 'right' ? 'chevron-forward' : 'chevron-back'}
          size={30}
          color="#FFFFFF"
        />
      </TouchableOpacity>
    </Animated.View>
  );
}

interface ReelItemProps {
  item: Story;
  isActive: boolean;
  isFirst: boolean;
  isLast: boolean;
  onVenuePress: (venueId: string) => void;
  onTapLeft: () => void;
  onTapRight: () => void;
}

function ReelItem({ item, isActive, isFirst, isLast, onVenuePress, onTapLeft, onTapRight }: ReelItemProps) {
  const venue = item.venue_id
    ? MOCK_VENUES.find((v) => v.id === item.venue_id)
    : null;

  const player = useVideoPlayerCompat(item.video_url);

  useEffect(() => {
    player.loop = true;
    if (isActive) {
      player.play();
    } else {
      player.pause();
    }
  }, [isActive, player]);

  return (
    <View style={styles.reelContainer}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="cover"
        nativeControls={false}
      />

      {/* Tap zones: left half = prev, right half = next */}
      <View style={styles.tapZoneContainer} pointerEvents="box-none">
        <TouchableWithoutFeedback onPress={onTapLeft}>
          <View style={styles.tapZoneLeft} />
        </TouchableWithoutFeedback>
        <TouchableWithoutFeedback onPress={onTapRight}>
          <View style={styles.tapZoneRight} />
        </TouchableWithoutFeedback>
      </View>

      {/* Bottom overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.75)']}
        style={styles.bottomOverlay}
        pointerEvents="box-none"
      >
        <View style={styles.bottomContent} pointerEvents="box-none">
          <Text style={styles.reelTitle}>{item.title}</Text>

          {venue && (
            <TouchableOpacity
              style={styles.venueChip}
              onPress={() => onVenuePress(venue.id)}
              accessibilityLabel={`${venue.name} mekanina git`}
              accessibilityRole="button"
            >
              <Ionicons name="location" size={14} color={Colors.primary} />
              <Text style={styles.venueChipText}>{venue.name}</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* Swipe up CTA */}
      {isActive && <SwipeUpHint />}

      {/* Navigation arrows */}
      {isActive && !isFirst && <NavArrow direction="left" onPress={onTapLeft} />}
      {isActive && !isLast && <NavArrow direction="right" onPress={onTapRight} />}
    </View>
  );
}

export default function ReelsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { startIndex } = useLocalSearchParams<{ startIndex: string }>();
  const initialIndex = parseInt(startIndex || '0', 10);

  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const flatListRef = useRef<FlatList>(null);

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

  const scrollToIndex = useCallback((index: number) => {
    if (index >= 0 && index < MOCK_STORIES.length) {
      flatListRef.current?.scrollToIndex({ index, animated: true });
    }
  }, []);

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  const handleOpenExternal = useCallback((url: string) => {
    Linking.openURL(url);
  }, []);

  const handleVenuePress = useCallback((venueId: string) => {
    router.dismiss();
    router.push(`/venue/${venueId}`);
  }, [router]);

  // Vertical swipe gesture: down = close, up = open external URL
  const translateY = useSharedValue(0);
  const overlayOpacity = useSharedValue(1);

  const verticalGesture = Gesture.Pan()
    .activeOffsetY([-20, 20])
    .failOffsetX([-10, 10])
    .onUpdate((e) => {
      if (e.translationY > 0) {
        translateY.value = e.translationY;
        overlayOpacity.value = 1 - Math.min(e.translationY / 300, 0.5);
      }
    })
    .onEnd((e) => {
      if (e.translationY < -SWIPE_THRESHOLD) {
        const story = MOCK_STORIES[activeIndex];
        if (story) {
          runOnJS(handleOpenExternal)(story.external_url);
        }
      } else if (e.translationY > SWIPE_THRESHOLD) {
        runOnJS(handleClose)();
      }
      translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
      overlayOpacity.value = withSpring(1, { damping: 20, stiffness: 200 });
    });

  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: overlayOpacity.value,
  }));

  const renderItem = useCallback(
    ({ item, index }: { item: Story; index: number }) => (
      <ReelItem
        item={item}
        isActive={index === activeIndex}
        isFirst={index === 0}
        isLast={index === MOCK_STORIES.length - 1}
        onVenuePress={handleVenuePress}
        onTapLeft={() => scrollToIndex(index - 1)}
        onTapRight={() => scrollToIndex(index + 1)}
      />
    ),
    [activeIndex, handleVenuePress, scrollToIndex],
  );

  return (
    <GestureHandlerRootView style={styles.container}>
      <GestureDetector gesture={verticalGesture}>
        <Animated.View style={[styles.container, animatedContainerStyle]}>
          <FlatList
            ref={flatListRef}
            data={MOCK_STORIES}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            horizontal
            pagingEnabled
            snapToInterval={SCREEN_WIDTH}
            decelerationRate={0.99}
            snapToAlignment="start"
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={initialIndex}
            getItemLayout={(_, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
          />

          {/* Top bar: progress dots + close button */}
          <View style={[styles.topOverlay, { paddingTop: insets.top + Spacing.sm }]} pointerEvents="box-none">
            <View style={styles.progressRow}>
              {MOCK_STORIES.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.progressDot,
                    i === activeIndex && styles.progressDotActive,
                  ]}
                />
              ))}
            </View>
            <View style={styles.topBar} pointerEvents="box-none">
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
                accessibilityLabel="Kapat"
                accessibilityRole="button"
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
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
  // Tap zones for left/right navigation
  tapZoneContainer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    zIndex: 5,
  },
  tapZoneLeft: {
    flex: 1,
  },
  tapZoneRight: {
    flex: 1,
  },
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: Spacing.xl,
  },
  progressDot: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  progressDotActive: {
    backgroundColor: '#FFFFFF',
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 160,
    paddingTop: 60,
    paddingHorizontal: Spacing.xl,
    zIndex: 6,
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
  // Swipe up CTA
  swipeUpHint: {
    position: 'absolute',
    bottom: 55,
    alignSelf: 'center',
    alignItems: 'center',
    gap: 6,
    zIndex: 7,
  },
  swipeUpLabel: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemiBold,
    color: 'rgba(255,255,255,0.5)',
  },
  swipeUpPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.full,
  },
  swipeUpText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.headingBold,
    color: '#FFFFFF',
  },
  // Navigation arrows (no background)
  navArrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -15,
    zIndex: 8,
  },
  navArrowRight: {
    right: 10,
  },
  navArrowLeft: {
    left: 10,
  },
});
