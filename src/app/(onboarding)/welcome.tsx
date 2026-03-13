import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  FlatList as RNFlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  useAnimatedScrollHandler,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';
import { haptic } from '../../lib/haptics';
import Button from '../../components/ui/Button';

// ---------------------------------------------------------------------------
// Slide data
// ---------------------------------------------------------------------------

type SlideType = 'map' | 'venue' | 'buddy';

interface Slide {
  id: string;
  title: string;
  subtitle: string;
  type: SlideType;
}

const SLIDES: Slide[] = [
  {
    id: '1',
    title: 'Haritada Keşfet',
    subtitle: 'Okuluna yakın öğrenci dostu mekanları bul',
    type: 'map',
  },
  {
    id: '2',
    title: 'Paylaş & Puanla',
    subtitle: 'Deneyimlerini paylaş, diğer öğrencilere yol göster',
    type: 'venue',
  },
  {
    id: '3',
    title: 'Birlikte Ye',
    subtitle: 'Yemek arkadaşı bul, buluşmalara katıl',
    type: 'buddy',
  },
];

// ---------------------------------------------------------------------------
// Phone mockup illustrations
// ---------------------------------------------------------------------------

/** Slide 1 -- map with pins */
function MapIllustration() {
  return (
    <View style={[illustrationStyles.container, { backgroundColor: '#E8F5E9' }]}>
      {/* Stylised roads */}
      <View style={illustrationStyles.roadH} />
      <View style={illustrationStyles.roadV} />

      {/* Map grid dots (subtle) */}
      {[0, 1, 2, 3].map((row) =>
        [0, 1, 2, 3].map((col) => (
          <View
            key={`dot-${row}-${col}`}
            style={[
              illustrationStyles.gridDot,
              { top: 40 + row * 55, left: 28 + col * 46 },
            ]}
          />
        )),
      )}

      {/* Pin 1 -- primary red (large, main) */}
      <View style={[illustrationStyles.pin, illustrationStyles.pinLarge, { top: 55, left: 50 }]}>
        <View style={[illustrationStyles.pinHead, { backgroundColor: Colors.primary, width: 24, height: 24 }]}>
          <View style={illustrationStyles.pinDot} />
        </View>
        <View style={[illustrationStyles.pinTail, { borderTopColor: Colors.primary }]} />
      </View>

      {/* Pin 2 -- accent amber */}
      <View style={[illustrationStyles.pin, { top: 110, left: 120 }]}>
        <View style={[illustrationStyles.pinHead, { backgroundColor: Colors.accent, width: 20, height: 20 }]}>
          <View style={illustrationStyles.pinDot} />
        </View>
        <View style={[illustrationStyles.pinTail, { borderTopColor: Colors.accent }]} />
      </View>

      {/* Pin 3 -- primary red (small) */}
      <View style={[illustrationStyles.pin, { top: 75, left: 150 }]}>
        <View style={[illustrationStyles.pinHead, { backgroundColor: Colors.primary, width: 18, height: 18 }]}>
          <View style={illustrationStyles.pinDotSmall} />
        </View>
        <View style={[illustrationStyles.pinTailSmall, { borderTopColor: Colors.primary }]} />
      </View>

      {/* Pin 4 -- subtle accent (small, background) */}
      <View style={[illustrationStyles.pin, { top: 170, left: 80 }]}>
        <View style={[illustrationStyles.pinHead, { backgroundColor: Colors.accentLight, width: 16, height: 16 }]}>
          <View style={illustrationStyles.pinDotSmall} />
        </View>
        <View style={[illustrationStyles.pinTailSmall, { borderTopColor: Colors.accentLight }]} />
      </View>

      {/* Search bar at top */}
      <View style={illustrationStyles.searchBar}>
        <View style={illustrationStyles.searchIcon} />
        <View style={illustrationStyles.searchLine} />
      </View>
    </View>
  );
}

/** Slide 2 -- venue card with star rating */
function VenueIllustration() {
  return (
    <View style={[illustrationStyles.container, { backgroundColor: '#FFF8F0' }]}>
      {/* Venue card */}
      <View style={illustrationStyles.venueCard}>
        {/* Image placeholder */}
        <View style={illustrationStyles.venueImagePlaceholder}>
          {/* Food icon placeholder -- a circle with fork/knife lines */}
          <View style={illustrationStyles.foodIconCircle}>
            <View style={illustrationStyles.forkLine} />
            <View style={illustrationStyles.knifeLine} />
          </View>
        </View>

        {/* Card body */}
        <View style={illustrationStyles.venueCardBody}>
          {/* Title line */}
          <View style={illustrationStyles.venueTitleLine} />

          {/* Subtitle line */}
          <View style={illustrationStyles.venueSubtitleLine} />

          {/* Star rating row */}
          <View style={illustrationStyles.starRow}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View
                key={`star-${i}`}
                style={[
                  illustrationStyles.star,
                  { backgroundColor: i < 4 ? Colors.star : '#E8E8EC' },
                ]}
              />
            ))}
            <View style={illustrationStyles.ratingTextLine} />
          </View>

          {/* Tag pills */}
          <View style={illustrationStyles.tagRow}>
            <View style={[illustrationStyles.tagPill, { backgroundColor: Colors.primarySoft }]} />
            <View style={[illustrationStyles.tagPill, { backgroundColor: Colors.accentSoft, width: 42 }]} />
            <View style={[illustrationStyles.tagPill, { backgroundColor: '#E8F5E9', width: 32 }]} />
          </View>
        </View>
      </View>

      {/* Small floating review card */}
      <View style={illustrationStyles.reviewCard}>
        <View style={illustrationStyles.reviewAvatar} />
        <View style={illustrationStyles.reviewLines}>
          <View style={[illustrationStyles.reviewLine, { width: 60 }]} />
          <View style={[illustrationStyles.reviewLine, { width: 45, opacity: 0.5 }]} />
        </View>
      </View>
    </View>
  );
}

/** Slide 3 -- buddy matching with overlapping profiles */
function BuddyIllustration() {
  return (
    <View style={[illustrationStyles.container, { backgroundColor: '#FFF0F0' }]}>
      {/* Two overlapping profile circles */}
      <View style={illustrationStyles.buddyCircles}>
        <View style={[illustrationStyles.buddyCircle, illustrationStyles.buddyCircleLeft]}>
          {/* Face elements */}
          <View style={illustrationStyles.buddyEyeRow}>
            <View style={illustrationStyles.buddyEye} />
            <View style={illustrationStyles.buddyEye} />
          </View>
          <View style={[illustrationStyles.buddySmile, { borderBottomColor: '#fff' }]} />
        </View>
        <View style={[illustrationStyles.buddyCircle, illustrationStyles.buddyCircleRight]}>
          <View style={illustrationStyles.buddyEyeRow}>
            <View style={illustrationStyles.buddyEye} />
            <View style={illustrationStyles.buddyEye} />
          </View>
          <View style={[illustrationStyles.buddySmile, { borderBottomColor: '#fff' }]} />
        </View>
      </View>

      {/* Heart between them */}
      <View style={illustrationStyles.heartContainer}>
        <View style={illustrationStyles.heartLeft} />
        <View style={illustrationStyles.heartRight} />
        <View style={illustrationStyles.heartBottom} />
      </View>

      {/* Match text pill */}
      <View style={illustrationStyles.matchPill}>
        <View style={[illustrationStyles.matchDot, { backgroundColor: Colors.success }]} />
        <View style={illustrationStyles.matchLine} />
      </View>

      {/* Floating food icons */}
      <View style={[illustrationStyles.floatingEmoji, { top: 40, left: 30 }]}>
        <View style={[illustrationStyles.emojiCircle, { backgroundColor: Colors.accentSoft }]}>
          <View style={[illustrationStyles.emojiInner, { backgroundColor: Colors.accent }]} />
        </View>
      </View>
      <View style={[illustrationStyles.floatingEmoji, { top: 50, right: 35 }]}>
        <View style={[illustrationStyles.emojiCircle, { backgroundColor: Colors.primarySoft }]}>
          <View style={[illustrationStyles.emojiInner, { backgroundColor: Colors.primary }]} />
        </View>
      </View>
      <View style={[illustrationStyles.floatingEmoji, { bottom: 45, left: 45 }]}>
        <View style={[illustrationStyles.emojiCircle, { backgroundColor: '#E8F5E9' }]}>
          <View style={[illustrationStyles.emojiInner, { backgroundColor: Colors.success }]} />
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Dot indicator
// ---------------------------------------------------------------------------

interface DotProps {
  index: number;
  scrollX: SharedValue<number>;
  width: number;
}

function Dot({ index, scrollX, width }: DotProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];

    const dotWidth = interpolate(
      scrollX.value,
      inputRange,
      [8, 24, 8],
      Extrapolation.CLAMP,
    );

    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.35, 1, 0.35],
      Extrapolation.CLAMP,
    );

    const backgroundColor =
      scrollX.value >= (index - 0.5) * width && scrollX.value < (index + 0.5) * width
        ? Colors.primary
        : '#E8E8EC';

    return {
      width: dotWidth,
      opacity,
      backgroundColor,
    };
  });

  return <Animated.View style={[styles.dot, animatedStyle]} />;
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function WelcomeScreen() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const colors = useThemeColors();

  const scrollX = useSharedValue(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<RNFlatList<Slide>>(null);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const newIndex = Math.round(event.nativeEvent.contentOffset.x / width);
      if (newIndex !== currentIndex) {
        haptic.light();
      }
      setCurrentIndex(newIndex);
    },
    [width, currentIndex],
  );

  const goToSlide = useCallback(
    (index: number) => {
      if (index < 0 || index >= SLIDES.length) return;
      flatListRef.current?.scrollToOffset({ offset: index * width, animated: true });
      haptic.light();
      setCurrentIndex(index);
    },
    [width],
  );

  const renderIllustration = (type: SlideType) => {
    switch (type) {
      case 'map':
        return <MapIllustration />;
      case 'venue':
        return <VenueIllustration />;
      case 'buddy':
        return <BuddyIllustration />;
    }
  };

  const renderSlide = ({ item }: { item: Slide }) => (
    <View style={[styles.slide, { width }]}>
      {/* Phone mockup frame */}
      <View style={[styles.phoneMockup, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.shadow }]}>
        {/* Status bar dots */}
        <View style={styles.phoneStatusBar}>
          <View style={[styles.statusDot, { backgroundColor: colors.textTertiary }]} />
          <View style={[styles.statusLine, { backgroundColor: colors.textTertiary }]} />
        </View>
        {/* Illustration content */}
        {renderIllustration(item.type)}
        {/* Home indicator */}
        <View style={[styles.phoneHomeIndicator, { backgroundColor: colors.textTertiary }]} />
      </View>

      {/* Text below mockup */}
      <View style={styles.textContainer}>
        <Text style={[styles.slideTitle, { color: colors.text }]}>{item.title}</Text>
        <Text style={[styles.slideSubtitle, { color: colors.textSecondary }]}>{item.subtitle}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Slides */}
      <Animated.FlatList
        ref={flatListRef as any}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleMomentumScrollEnd}
      />

      {/* Navigation: prev arrow + dots + next arrow */}
      <View style={styles.navRow}>
        <TouchableOpacity
          onPress={() => goToSlide(currentIndex - 1)}
          style={[styles.arrowButton, currentIndex === 0 && styles.arrowHidden]}
          activeOpacity={0.7}
          disabled={currentIndex === 0}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textSecondary} />
        </TouchableOpacity>

        <View style={styles.dotContainer}>
          {SLIDES.map((_, index) => (
            <Dot key={index} index={index} scrollX={scrollX} width={width} />
          ))}
        </View>

        <TouchableOpacity
          onPress={() => goToSlide(currentIndex + 1)}
          style={[styles.arrowButton, currentIndex === SLIDES.length - 1 && styles.arrowHidden]}
          activeOpacity={0.7}
          disabled={currentIndex === SLIDES.length - 1}
        >
          <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Auth buttons -- always visible */}
      <View style={styles.buttonsContainer}>
        <View style={styles.buttonsInner}>
          <Button
            title="Kayıt Ol"
            onPress={() => {
              haptic.light();
              router.push('/auth/register');
            }}
            variant="primary"
            style={styles.registerButton}
          />

          <TouchableOpacity
            onPress={() => {
              haptic.light();
              router.push('/auth/login');
            }}
            style={styles.loginLink}
            activeOpacity={0.7}
          >
            <Text style={[styles.loginLinkText, { color: colors.primary }]}>
              Giriş Yap
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const MOCKUP_WIDTH = 220;
const MOCKUP_HEIGHT = 300;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Slide
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.xxxl,
  },

  // Phone mockup
  phoneMockup: {
    width: MOCKUP_WIDTH,
    height: MOCKUP_HEIGHT,
    borderRadius: 28,
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 8,
  },
  phoneStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.4,
  },
  statusLine: {
    width: 28,
    height: 3,
    borderRadius: 1.5,
    opacity: 0.25,
  },
  phoneHomeIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
    opacity: 0.3,
  },

  // Text
  textContainer: {
    alignItems: 'center',
    marginTop: Spacing.xxl,
    paddingHorizontal: Spacing.xxxl,
  },
  slideTitle: {
    fontSize: FontSize.xxl,
    fontFamily: FontFamily.heading,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    letterSpacing: -0.3,
  },
  slideSubtitle: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Navigation row (arrows + dots)
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
  },
  arrowButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowHidden: {
    opacity: 0,
  },

  // Dots
  dotContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },

  // Buttons
  buttonsContainer: {
    paddingHorizontal: Spacing.xxl,
    paddingBottom: Spacing.xl,
    minHeight: 110,
    justifyContent: 'flex-end',
  },
  buttonsInner: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  registerButton: {
    marginBottom: 0,
  },
  loginLink: {
    paddingVertical: Spacing.sm,
  },
  loginLinkText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
    letterSpacing: 0.2,
  },
});

// ---------------------------------------------------------------------------
// Illustration styles
// ---------------------------------------------------------------------------

const illustrationStyles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 0,
    overflow: 'hidden',
    position: 'relative',
  },

  // -- Map illustration --
  roadH: {
    position: 'absolute',
    top: 120,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 1.5,
  },
  roadV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 100,
    width: 3,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 1.5,
  },
  gridDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  pin: {
    position: 'absolute',
    alignItems: 'center',
  },
  pinLarge: {},
  pinHead: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  pinDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  pinDotSmall: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
  pinTailSmall: {
    width: 0,
    height: 0,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
  searchBar: {
    position: 'absolute',
    top: 12,
    left: 14,
    right: 14,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  searchIcon: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.25)',
  },
  searchLine: {
    width: 50,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },

  // -- Venue illustration --
  venueCard: {
    position: 'absolute',
    top: 30,
    left: 18,
    right: 18,
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  venueImagePlaceholder: {
    height: 85,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  foodIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(226,55,68,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  forkLine: {
    width: 2,
    height: 18,
    backgroundColor: Colors.primary,
    borderRadius: 1,
  },
  knifeLine: {
    width: 2,
    height: 14,
    backgroundColor: Colors.primary,
    borderRadius: 1,
    opacity: 0.7,
  },
  venueCardBody: {
    padding: 12,
    gap: 6,
  },
  venueTitleLine: {
    width: 100,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  venueSubtitleLine: {
    width: 65,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  star: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  ratingTextLine: {
    width: 20,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginLeft: 4,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 2,
  },
  tagPill: {
    width: 36,
    height: 14,
    borderRadius: 7,
  },

  reviewCard: {
    position: 'absolute',
    bottom: 30,
    left: 24,
    right: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  reviewAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.accentSoft,
  },
  reviewLines: {
    flex: 1,
    gap: 4,
  },
  reviewLine: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },

  // -- Buddy illustration --
  buddyCircles: {
    position: 'absolute',
    top: 55,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buddyCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  buddyCircleLeft: {
    backgroundColor: Colors.primary,
    marginRight: -18,
    zIndex: 2,
  },
  buddyCircleRight: {
    backgroundColor: Colors.accent,
    zIndex: 1,
  },
  buddyEyeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  buddyEye: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  buddySmile: {
    width: 16,
    height: 8,
    borderBottomWidth: 2.5,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    borderLeftWidth: 0,
    borderRightWidth: 0,
  },

  heartContainer: {
    position: 'absolute',
    top: 135,
    alignSelf: 'center',
    width: 20,
    height: 18,
    left: '50%',
    marginLeft: -10,
  },
  heartLeft: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  heartRight: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  heartBottom: {
    position: 'absolute',
    bottom: 0,
    left: 3,
    width: 14,
    height: 14,
    backgroundColor: Colors.primary,
    transform: [{ rotate: '45deg' }],
    borderRadius: 2,
  },

  matchPill: {
    position: 'absolute',
    top: 170,
    alignSelf: 'center',
    left: '50%',
    marginLeft: -40,
    width: 80,
    height: 26,
    backgroundColor: '#fff',
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  matchDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  matchLine: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },

  floatingEmoji: {
    position: 'absolute',
  },
  emojiCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
});
