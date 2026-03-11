import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily, SpringConfig } from '../../lib/constants';
import { useThemeColors, useIsDarkMode } from '../../hooks/useThemeColors';
import Avatar from '../ui/Avatar';
import type { MealBuddy } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const BUDDY_COLOR = '#06B6D4';
const BUDDY_COLOR_DARK = '#0891B2';

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface SwipeDeckProps {
  buddies: MealBuddy[];
  onSwipeRight: (buddy: MealBuddy) => void;
  onSwipeLeft: (buddy: MealBuddy) => void;
  userLocation?: { latitude: number; longitude: number } | null;
}

export default function SwipeDeck({ buddies, onSwipeRight, onSwipeLeft, userLocation }: SwipeDeckProps) {
  const colors = useThemeColors();
  const isDark = useIsDarkMode();
  const [currentIndex, setCurrentIndex] = useState(0);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  // Refs to avoid stale closures in the runOnJS callback
  const indexRef = useRef(0);
  const buddiesRef = useRef(buddies);
  const callbacksRef = useRef({ onSwipeRight, onSwipeLeft });

  useEffect(() => { indexRef.current = currentIndex; }, [currentIndex]);
  useEffect(() => { buddiesRef.current = buddies; }, [buddies]);
  useEffect(() => { callbacksRef.current = { onSwipeRight, onSwipeLeft }; }, [onSwipeRight, onSwipeLeft]);

  // Reset when buddy list changes
  useEffect(() => {
    setCurrentIndex(0);
    indexRef.current = 0;
    translateX.value = 0;
    translateY.value = 0;
  }, [buddies]);

  const handleSwipeComplete = useCallback((direction: 'left' | 'right') => {
    const buddy = buddiesRef.current[indexRef.current];
    if (!buddy) return;

    if (direction === 'right') {
      callbacksRef.current.onSwipeRight(buddy);
    } else {
      callbacksRef.current.onSwipeLeft(buddy);
    }

    translateX.value = 0;
    translateY.value = 0;
    const nextIndex = indexRef.current + 1;
    indexRef.current = nextIndex;
    setCurrentIndex(nextIndex);
  }, []);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-5, 5])
    .failOffsetY([-5, 5])
    .onUpdate((event) => {
      'worklet';
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      'worklet';
      if (event.translationX > SWIPE_THRESHOLD) {
        translateX.value = withTiming(SCREEN_WIDTH + 100, { duration: 250 }, () => {
          runOnJS(handleSwipeComplete)('right');
        });
        translateY.value = withTiming(event.translationY, { duration: 250 });
      } else if (event.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-SCREEN_WIDTH - 100, { duration: 250 }, () => {
          runOnJS(handleSwipeComplete)('left');
        });
        translateY.value = withTiming(event.translationY, { duration: 250 });
      } else {
        translateX.value = withSpring(0, SpringConfig.snappy);
        translateY.value = withSpring(0, SpringConfig.snappy);
      }
    });

  // Animated style for top card: translate + rotate
  const topCardStyle = useAnimatedStyle(() => {
    'worklet';
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
      [-10, 0, 10],
    );
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  // Like overlay opacity
  const likeOverlayStyle = useAnimatedStyle(() => {
    'worklet';
    const opacity = interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return { opacity };
  });

  // Nope overlay opacity
  const nopeOverlayStyle = useAnimatedStyle(() => {
    'worklet';
    const opacity = interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, 0],
      [1, 0],
      Extrapolation.CLAMP,
    );
    return { opacity };
  });

  // Next card scale + opacity driven by the top card's translateX
  const nextCardAnimatedScale = useSharedValue(0.92);
  const nextCardAnimatedOpacity = useSharedValue(0.5);

  useAnimatedReaction(
    () => translateX.value,
    (tx) => {
      nextCardAnimatedScale.value = interpolate(
        Math.abs(tx),
        [0, SCREEN_WIDTH],
        [0.92, 1],
        Extrapolation.CLAMP,
      );
      nextCardAnimatedOpacity.value = interpolate(
        Math.abs(tx),
        [0, SCREEN_WIDTH],
        [0.5, 1],
        Extrapolation.CLAMP,
      );
    },
  );

  const behindCardStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [{ scale: nextCardAnimatedScale.value }],
      opacity: nextCardAnimatedOpacity.value,
    };
  });

  if (currentIndex >= buddies.length) {
    return (
      <View style={styles.emptyContainer}>
        <View style={[styles.emptyIcon, { backgroundColor: isDark ? colors.surface : 'rgba(6,182,212,0.08)' }]}>
          <Ionicons name="search-outline" size={40} color={BUDDY_COLOR} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          Hepsi bu kadardi!
        </Text>
        <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
          Yakininda baska buddy kalmadi.{'\n'}Biraz bekle, yeni buddy'ler gelebilir!
        </Text>
      </View>
    );
  }

  const renderCard = (buddy: MealBuddy, isTop: boolean) => {
    const dist = userLocation
      ? getDistanceKm(userLocation.latitude, userLocation.longitude, buddy.latitude, buddy.longitude)
      : null;

    const cardContent = (
      <View style={[
        styles.cardInner,
        {
          backgroundColor: isDark ? colors.surface : '#FAFEFF',
          borderColor: isDark ? 'rgba(6,182,212,0.2)' : 'rgba(6,182,212,0.12)',
        },
      ]}>
        {/* Like / Nope overlays */}
        {isTop && (
          <>
            <Animated.View style={[styles.labelWrap, styles.likeWrap, likeOverlayStyle]}>
              <LinearGradient
                colors={[BUDDY_COLOR, BUDDY_COLOR_DARK]}
                style={styles.labelBadge}
              >
                <Ionicons name="heart" size={18} color="#FFF" />
                <Text style={styles.labelText}>ESLES</Text>
              </LinearGradient>
            </Animated.View>
            <Animated.View style={[styles.labelWrap, styles.nopeWrap, nopeOverlayStyle]}>
              <View style={[styles.labelBadge, { backgroundColor: Colors.error }]}>
                <Ionicons name="close" size={18} color="#FFF" />
                <Text style={styles.labelText}>GEC</Text>
              </View>
            </Animated.View>
          </>
        )}

        {/* Avatar section */}
        <View style={styles.avatarSection}>
          <LinearGradient
            colors={[BUDDY_COLOR, BUDDY_COLOR_DARK]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatarRing}
          >
            <View style={[styles.avatarInner, { backgroundColor: isDark ? colors.surface : '#FAFEFF' }]}>
              <Avatar
                uri={buddy.user?.avatar_url}
                name={buddy.user?.full_name || buddy.user?.username || '?'}
                size={100}
              />
            </View>
          </LinearGradient>

          {/* XP badge */}
          {buddy.user?.xp_points != null && (
            <View style={styles.xpBadge}>
              <Ionicons name="star" size={10} color={Colors.accent} />
              <Text style={styles.xpText}>{buddy.user.xp_points} XP</Text>
            </View>
          )}
        </View>

        {/* Info section */}
        <View style={styles.infoSection}>
          <Text style={[styles.cardName, { color: colors.text }]}>
            {buddy.user?.full_name || 'Anonim'}
          </Text>

          {buddy.user?.university && (
            <View style={styles.metaRow}>
              <Ionicons name="school-outline" size={14} color={BUDDY_COLOR} />
              <Text style={[styles.cardUni, { color: colors.textSecondary }]}>
                {buddy.user.university}
              </Text>
            </View>
          )}

          {buddy.note && (
            <View style={[styles.noteCard, {
              backgroundColor: isDark ? 'rgba(6,182,212,0.08)' : 'rgba(6,182,212,0.06)',
            }]}>
              <Ionicons name="chatbubble-outline" size={13} color={BUDDY_COLOR} />
              <Text style={[styles.cardNote, { color: colors.text }]} numberOfLines={2}>
                "{buddy.note}"
              </Text>
            </View>
          )}

          {dist !== null && (
            <View style={styles.distRow}>
              <LinearGradient
                colors={[BUDDY_COLOR, BUDDY_COLOR_DARK]}
                style={styles.distBadge}
              >
                <Ionicons name="location" size={13} color="#FFF" />
                <Text style={styles.distText}>
                  {dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)} km`}
                </Text>
              </LinearGradient>
            </View>
          )}
        </View>

        {/* Swipe hints */}
        <View style={styles.hintRow}>
          <View style={styles.hintItem}>
            <Ionicons name="close-circle" size={18} color={Colors.error} />
            <Text style={[styles.hintText, { color: colors.textTertiary }]}>Sola kaydir</Text>
          </View>
          <View style={styles.hintItem}>
            <Ionicons name="heart-circle" size={18} color={BUDDY_COLOR} />
            <Text style={[styles.hintText, { color: colors.textTertiary }]}>Saga kaydir</Text>
          </View>
        </View>
      </View>
    );

    if (isTop) {
      return (
        <GestureDetector gesture={panGesture} key={buddy.id}>
          <Animated.View style={[styles.card, topCardStyle]}>
            {cardContent}
          </Animated.View>
        </GestureDetector>
      );
    }

    return (
      <Animated.View key={buddy.id} style={[styles.card, behindCardStyle]}>
        {cardContent}
      </Animated.View>
    );
  };

  // Counter badge
  const remaining = buddies.length - currentIndex;

  return (
    <View style={styles.container}>
      {/* Counter */}
      <View style={styles.counterRow}>
        <Text style={[styles.counterText, { color: colors.textTertiary }]}>
          {remaining} buddy kaldi
        </Text>
      </View>

      {/* Card stack */}
      <View style={styles.deckArea}>
        {currentIndex + 1 < buddies.length && renderCard(buddies[currentIndex + 1], false)}
        {renderCard(buddies[currentIndex], true)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  counterRow: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  counterText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemiBold,
    letterSpacing: 0.5,
  },
  deckArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    position: 'absolute',
    width: SCREEN_WIDTH - 48,
  },
  cardInner: {
    borderRadius: BorderRadius.xxl,
    borderWidth: 1,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },

  // Swipe labels
  labelWrap: {
    position: 'absolute',
    top: Spacing.xl,
    zIndex: 10,
  },
  likeWrap: {
    left: Spacing.xl,
  },
  nopeWrap: {
    right: Spacing.xl,
  },
  labelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  labelText: {
    color: '#FFF',
    fontSize: FontSize.sm,
    fontFamily: FontFamily.headingBold,
    letterSpacing: 1,
  },

  // Avatar
  avatarSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  avatarRing: {
    width: 116,
    height: 116,
    borderRadius: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    width: 108,
    height: 108,
    borderRadius: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: Colors.accentSoft,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    marginTop: -Spacing.sm,
  },
  xpText: {
    fontSize: 10,
    fontFamily: FontFamily.bodySemiBold,
    color: Colors.accentDark,
  },

  // Info
  infoSection: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardName: {
    fontSize: FontSize.xxl,
    fontFamily: FontFamily.heading,
    letterSpacing: -0.3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  cardUni: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xs,
    maxWidth: '100%',
  },
  cardNote: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    fontStyle: 'italic',
    flex: 1,
  },
  distRow: {
    marginTop: Spacing.xs,
  },
  distBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 1,
    borderRadius: BorderRadius.full,
  },
  distText: {
    color: '#FFF',
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemiBold,
  },

  // Hints
  hintRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.xxl,
  },
  hintItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  hintText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xxxl,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.headingBold,
  },
  emptySubtext: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    textAlign: 'center',
    lineHeight: 20,
  },
});
