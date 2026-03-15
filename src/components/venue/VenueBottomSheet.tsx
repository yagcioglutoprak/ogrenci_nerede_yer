import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Platform,
  Dimensions,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Alert,
  ScrollView,
} from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontSize,
  FontFamily,
  PriceRanges,
  VenueLevels,
  RatingCategories,
  SpringConfig,
} from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useVenueStore } from '../../stores/venueStore';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import GlassView from '../ui/GlassView';
import { GlassSheet, GlassProvider } from '../glass';
import RatingBar from '../ui/RatingBar';
import StarRating from '../ui/StarRating';
import Avatar from '../ui/Avatar';
import { haptic } from '../../lib/haptics';
import { getRelativeTime } from '../../lib/utils';
import { enrichVenue, fetchPlacePhoto } from '../../lib/venueEnrichment';
import type { Venue, Review, Post, SocialVideo } from '../../types';

const ONY_LOGO = require('../../../assets/logo-icon-hires.png');
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = 200;

// Rating bar width helper (moved to module scope to avoid recreation per render)
const ratingBarWidth = (rating: number) => `${(rating / 5) * 100}%`;

const getPlatformInfo = (platform: SocialVideo['platform']) => {
  switch (platform) {
    case 'youtube':
      return { icon: 'logo-youtube' as const, color: '#FF0000', label: 'YouTube' };
    case 'instagram':
      return { icon: 'logo-instagram' as const, color: '#E4405F', label: 'Instagram' };
    case 'tiktok':
      return { icon: 'musical-notes' as const, color: '#000000', label: 'TikTok' };
  }
};

interface VenueBottomSheetProps {
  venue: Venue | null;
  onDismiss: () => void;
  onExpandChange?: (expanded: boolean) => void;
}

// Custom glass background for BottomSheet — uses GlassSheet which
// sets GlassContext=true so all children (cards, pills) render solid
function GlassBackground({ style }: { style?: any }) {
  return (
    <GlassSheet
      style={[styles.glassBackground, style]}
      blurIntensity={90}
    />
  );
}

// Extracted review item as a memoized component to avoid re-renders of the entire list
const ReviewItem = React.memo(function ReviewItem({ item, colors }: { item: Review; colors: ReturnType<typeof useThemeColors> }) {
  const avg = (
    (item.taste_rating + item.value_rating + item.friendliness_rating) / 3
  ).toFixed(1);

  const ratingPills = [
    { icon: 'restaurant' as keyof typeof Ionicons.glyphMap, value: item.taste_rating, color: Colors.primary },
    { icon: 'pricetag' as keyof typeof Ionicons.glyphMap, value: item.value_rating, color: Colors.accent },
    { icon: 'cafe' as keyof typeof Ionicons.glyphMap, value: item.friendliness_rating, color: Colors.verified },
  ];

  return (
    <GlassView key={item.id} style={[styles.reviewCard, styles.reviewCardGlass]} fallbackColor={colors.card}>
      <View style={styles.reviewHeader}>
        <Avatar
          uri={item.user?.avatar_url}
          name={item.user?.full_name ?? item.user?.username ?? '?'}
          size={36}
        />
        <View style={styles.reviewHeaderText}>
          <Text style={[styles.reviewUsername, { color: colors.text }]}>
            {item.user?.username ?? 'Anonim'}
          </Text>
          <Text style={[styles.reviewDate, { color: colors.textTertiary }]}>
            {new Date(item.created_at).toLocaleDateString('tr-TR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </Text>
        </View>
        <View style={[styles.reviewAvgBadge, { backgroundColor: colors.accentSoft }]}>
          <Ionicons name="star" size={12} color={Colors.accent} />
          <Text style={[styles.reviewAvgText, { color: colors.text }]}>{avg}</Text>
        </View>
      </View>

      {item.comment ? (
        <Text style={[styles.reviewComment, { color: colors.text }]}>{item.comment}</Text>
      ) : null}

      <View style={styles.reviewRatingPills}>
        {ratingPills.map((pill) => (
          <View key={pill.icon} style={[styles.reviewPill, { backgroundColor: colors.backgroundSecondary }]}>
            <Ionicons name={pill.icon} size={12} color={pill.color} />
            <Text style={[styles.reviewPillText, { color: colors.textSecondary }]}>{pill.value.toFixed(1)}</Text>
          </View>
        ))}
      </View>
    </GlassView>
  );
});

export default function VenueBottomSheet({ venue, onDismiss, onExpandChange }: VenueBottomSheetProps) {
  const colors = useThemeColors();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['40%', '95%'], []);
  const prevVenueIdRef = useRef<string | null>(null);

  const { reviews, fetchReviews, fetchVenueById, toggleFavorite, addReview } = useVenueStore();
  const user = useAuthStore((s) => s.user);

  const [sheetIndex, setSheetIndex] = useState(-1);
  const [showDetail, setShowDetail] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [venuePosts, setVenuePosts] = useState<Post[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Rating modal state
  const [enrichedVenue, setEnrichedVenue] = useState<Venue | null>(null);
  const [enriching, setEnriching] = useState(false);

  // Use enriched data when available, fall back to original venue
  const displayVenue = enrichedVenue ?? venue;

  const [showRating, setShowRating] = useState(false);
  const [rateTaste, setRateTaste] = useState(0);
  const [rateValue, setRateValue] = useState(0);
  const [rateFriendliness, setRateFriendliness] = useState(0);
  const [rateComment, setRateComment] = useState('');
  const [rateSubmitting, setRateSubmitting] = useState(false);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [showPostPrompt, setShowPostPrompt] = useState(false);
  const router = useRouter();

  // Swipe-to-dismiss for rating modal (native gesture handler)
  const rateTranslateY = useSharedValue(0);
  const dismissRating = useCallback(() => setShowRating(false), []);
  const ratePanGesture = Gesture.Pan()
    .activeOffsetY(12)
    .failOffsetX([-20, 20])
    .onUpdate((e) => {
      if (e.translationY > 0) rateTranslateY.value = e.translationY;
    })
    .onEnd((e) => {
      if (e.translationY > 80 || e.velocityY > 500) {
        runOnJS(dismissRating)();
      } else {
        rateTranslateY.value = withSpring(0, SpringConfig.default);
      }
    });
  const rateSheetAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: rateTranslateY.value }],
  }));
  const rateOverlayAnimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(rateTranslateY.value, [0, 300], [1, 0], Extrapolation.CLAMP),
  }));

  // Animated index driven by bottom sheet — used for morph animation
  const animatedIdx = useSharedValue(-1);

  // Compact elements fade out as sheet expands
  const compactFadeStyle = useAnimatedStyle(() => {
    const idx = animatedIdx.value;
    if (idx <= 0) return { opacity: 1, maxHeight: 200, marginTop: 0 };
    return {
      opacity: interpolate(idx, [0, 0.3], [1, 0], Extrapolation.CLAMP),
      maxHeight: interpolate(idx, [0, 0.4], [200, 0], Extrapolation.CLAMP),
      marginTop: interpolate(idx, [0, 0.4], [0, -8], Extrapolation.CLAMP),
    };
  });

  // Expanded elements fade in as sheet expands
  const expandFadeStyle = useAnimatedStyle(() => {
    const idx = animatedIdx.value;
    if (idx <= 0) return { opacity: 0 };
    return {
      opacity: interpolate(idx, [0.2, 0.55], [0, 1], Extrapolation.CLAMP),
    };
  });

  // Image morphs from thumbnail (72x72) to hero (full width x 260)
  const THUMB_SIZE = 72;
  const HERO_W = SCREEN_WIDTH - 2 * Spacing.xl;
  const morphImageStyle = useAnimatedStyle(() => {
    const idx = animatedIdx.value;
    if (idx <= 0) return { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: BorderRadius.md + 2 };
    return {
      width: interpolate(idx, [0, 0.6], [THUMB_SIZE, HERO_W], Extrapolation.CLAMP),
      height: interpolate(idx, [0, 0.6], [THUMB_SIZE, HERO_HEIGHT], Extrapolation.CLAMP),
      borderRadius: interpolate(idx, [0, 0.6], [BorderRadius.md + 2, BorderRadius.lg], Extrapolation.CLAMP),
    };
  });

  // Open/close sheet based on venue; reset to collapsed when venue changes
  useEffect(() => {
    if (venue) {
      if (prevVenueIdRef.current !== venue.id) {
        prevVenueIdRef.current = venue.id;
        setShowDetail(false);
        setIsFavorited(false);
        setVenuePosts([]);
        setMyReview(null);
        setShowPostPrompt(false);
        setEnrichedVenue(null);
        setLoadingDetail(true);

        // Fetch reviews
        fetchReviews(venue.id).finally(() => setLoadingDetail(false));

        // Enrich scraped venues with Google Places data on tap
        if (venue.source === 'scraped' && !venue.google_enriched_at) {
          setEnriching(true);
          enrichVenue(venue.id)
            .then((enriched) => {
              if (enriched) setEnrichedVenue(enriched);
            })
            .finally(() => setEnriching(false));
        }

        // Fetch venue posts
        fetchVenuePosts(venue.id);

        // Fetch user's existing review (only for DB venues with UUID ids)
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(venue.id);
        if (user && isUuid) {
          supabase
            .from('reviews')
            .select('*')
            .eq('venue_id', venue.id)
            .eq('user_id', user.id)
            .single()
            .then(({ data }) => {
              if (data) {
                setMyReview(data as Review);
                setRateTaste(data.taste_rating);
                setRateValue(data.value_rating);
                setRateFriendliness(data.friendliness_rating);
                setRateComment(data.comment || '');
              }
            });
        }
      }
      bottomSheetRef.current?.snapToIndex(0);
    } else {
      prevVenueIdRef.current = null;
      bottomSheetRef.current?.close();
    }
  }, [venue]);

  // Fetch venue posts with Supabase -> mock fallback
  const fetchVenuePosts = async (venueId: string) => {
    try {
      const { data, error } = await supabase
        .from('posts_with_counts')
        .select(`
          *,
          user:users!user_id(*),
          images:post_images!post_id(*)
        `)
        .eq('venue_id', venueId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data && data.length > 0) {
        setVenuePosts(data as Post[]);
        return;
      }
    } catch {}

    // No data from Supabase
    setVenuePosts([]);
  };

  const handleSheetChange = useCallback(
    (index: number) => {
      setSheetIndex(index);
      if (index === -1) {
        onExpandChange?.(false);
        onDismiss();
      }
    },
    [onDismiss, onExpandChange],
  );

  // Fires at animation START — mount detail content immediately so no blank flash
  const handleAnimate = useCallback(
    (_fromIndex: number, toIndex: number) => {
      if (toIndex === 1) {
        setShowDetail(true);
        setSheetIndex(1);
        onExpandChange?.(true);
      } else if (toIndex === 0) {
        setShowDetail(false);
        setSheetIndex(0);
        onExpandChange?.(false);
      }
    },
    [onExpandChange],
  );

  const handleClose = useCallback(() => {
    bottomSheetRef.current?.close();
    onDismiss();
  }, [onDismiss]);

  const handleDirections = useCallback(() => {
    if (!venue) return;
    haptic.light();
    const url = Platform.select({
      ios: `maps:?daddr=${venue.latitude},${venue.longitude}&dirflg=w`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${venue.latitude},${venue.longitude}&travelmode=walking`,
    });
    if (url) Linking.openURL(url);
  }, [venue]);

  const handleRate = useCallback(() => {
    if (!venue) return;
    haptic.light();
    if (!myReview) {
      setRateTaste(0);
      setRateValue(0);
      setRateFriendliness(0);
      setRateComment('');
    }
    rateTranslateY.value = 500;
    setShowRating(true);
    requestAnimationFrame(() => {
      rateTranslateY.value = withTiming(0, { duration: 300 });
    });
  }, [venue, myReview]);

  // Derived values (memoized together to avoid repeated lookups)
  const { priceLabel, priceDesc, levelInfo, isDbVenue, tier } = useMemo(() => {
    const priceRange = venue ? PriceRanges.find((p) => p.value === venue.price_range) : null;
    return {
      priceLabel: priceRange?.label ?? '',
      priceDesc: priceRange?.description ?? '',
      levelInfo: venue ? VenueLevels.find((l) => l.level === venue.level) ?? null : null,
      isDbVenue: venue ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(venue.id) : false,
      tier: (!venue || venue.total_reviews > 0 ? 'reviewed' : 'unreviewed') as 'unreviewed' | 'reviewed',
    };
  }, [venue]);

  const handleSubmitRating = useCallback(async () => {
    if (!venue || !user) return;
    if (rateTaste === 0 || rateValue === 0 || rateFriendliness === 0) {
      haptic.error();
      Alert.alert('Eksik Puan', 'Lutfen tum kategorilere puan verin.');
      return;
    }
    setRateSubmitting(true);
    haptic.light();

    // If venue is not in DB (OSM/external), import it first
    let venueId = venue.id;
    if (!isDbVenue) {
      const { data: inserted, error: insertErr } = await supabase
        .from('venues')
        .insert({
          name: venue.name,
          description: venue.description || null,
          latitude: venue.latitude,
          longitude: venue.longitude,
          address: venue.address,
          phone: venue.phone || null,
          price_range: venue.price_range || 1,
          cover_image_url: venue.cover_image_url || null,
          tags: venue.tags || [],
          created_by: user.id,
        })
        .select('id')
        .single();

      if (insertErr || !inserted) {
        setRateSubmitting(false);
        haptic.error();
        Alert.alert('Hata', insertErr?.message || 'Mekan kaydedilemedi');
        return;
      }
      venueId = inserted.id;
      // Update venue reference so subsequent actions use the DB id
      venue.id = venueId;
    }

    let err: string | null = null;
    if (myReview) {
      const { error: updateErr } = await supabase
        .from('reviews')
        .update({
          taste_rating: rateTaste,
          value_rating: rateValue,
          friendliness_rating: rateFriendliness,
          comment: rateComment.trim(),
        })
        .eq('id', myReview.id);
      err = updateErr?.message || null;
    } else {
      const result = await addReview({
        venue_id: venueId,
        user_id: user.id,
        taste_rating: rateTaste,
        value_rating: rateValue,
        friendliness_rating: rateFriendliness,
        comment: rateComment.trim(),
      });
      err = result.error;
    }

    setRateSubmitting(false);
    if (err) {
      haptic.error();
      Alert.alert('Hata', err);
    } else {
      haptic.success();
      const wasNewReview = !myReview;
      setShowRating(false);
      // Update myReview state
      const updated: Review = {
        ...(myReview || { id: '', venue_id: venueId, user_id: user.id, created_at: new Date().toISOString() }),
        taste_rating: rateTaste,
        value_rating: rateValue,
        friendliness_rating: rateFriendliness,
        comment: rateComment.trim(),
      } as Review;
      setMyReview(updated);
      // Refresh venue + reviews
      fetchVenueById(venueId);
      fetchReviews(venueId);
      // Show post prompt for first-time reviews
      if (wasNewReview) {
        setShowPostPrompt(true);
      }
    }
  }, [venue, user, rateTaste, rateValue, rateFriendliness, rateComment, addReview, myReview, isDbVenue]);

  const handleSave = useCallback(() => {
    if (!venue || !user) return;
    haptic.light();
    setIsFavorited((prev) => !prev);
    toggleFavorite(venue.id, user.id);
  }, [venue, user, toggleFavorite]);

  const handleExpandHint = useCallback(() => {
    haptic.light();
    bottomSheetRef.current?.snapToIndex(1);
  }, []);

  // Social videos for this venue
  // TODO: Fetch videos from Supabase
  const venueVideos: SocialVideo[] = [];

  const isExpanded = sheetIndex === 1;

  // Memoize hero image URI to avoid recomputing on every render
  const heroImageUri = useMemo(() => {
    if (displayVenue?.cover_image_url) return displayVenue.cover_image_url;
    if (displayVenue?.google_photos?.[0]) return fetchPlacePhoto(displayVenue.google_photos[0], 800);
    return null;
  }, [displayVenue?.cover_image_url, displayVenue?.google_photos]);



  return (
    <>
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      enableDynamicSizing={false}
      onChange={handleSheetChange}
      onAnimate={handleAnimate}
      animatedIndex={animatedIdx}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundComponent={GlassBackground}
      style={styles.sheet}
    >
      {venue && (
        <GlassProvider value={true}>
        <BottomSheetScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={isExpanded}
          scrollEnabled={isExpanded}
        >
          <View style={styles.compactSection}>
            {/* Close button — only when expanded */}
            {isExpanded && (
              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: colors.backgroundSecondary + 'DD' }]}
                onPress={handleClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            )}

            {/* ---- MORPHING IMAGE: thumbnail → hero ---- */}
            <View style={styles.venueRow}>
              <Animated.View style={[styles.morphImageWrap, { backgroundColor: colors.backgroundSecondary }, morphImageStyle]}>
                {heroImageUri ? (
                  <Image
                    source={{ uri: heroImageUri }}
                    style={styles.morphImage}
                  />
                ) : enriching ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <Ionicons name="restaurant" size={28} color={colors.textTertiary} />
                )}
                {/* Hero overlay — name + level badge on image when expanded */}
                <Animated.View style={[styles.heroOverlay, expandFadeStyle]} pointerEvents="none">
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.65)']}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.heroBottomContent}>
                    <Text style={styles.heroName} numberOfLines={2}>
                      {venue.name}
                    </Text>
                    {levelInfo && (
                      <View style={[styles.levelPill, { backgroundColor: levelInfo.color }]}>
                        <Ionicons name="shield-checkmark" size={12} color="#FFFFFF" />
                        <Text style={styles.levelPillText}>{levelInfo.name}</Text>
                      </View>
                    )}
                  </View>
                </Animated.View>
              </Animated.View>

              {/* Text info — fades out when expanding */}
              <Animated.View style={[styles.venueInfo, compactFadeStyle]}>
                <Text style={[styles.venueName, { color: colors.text }]} numberOfLines={1}>
                  {venue.name}
                </Text>
                {tier === 'unreviewed' ? (
                  <>
                    <Text style={[styles.venueAddress, { color: colors.textSecondary }]} numberOfLines={1}>
                      {displayVenue?.address ?? venue?.address}
                    </Text>
                    {displayVenue?.google_rating ? (
                      <View style={styles.ratingsRow}>
                        <Ionicons name="star" size={14} color={Colors.star} />
                        <Text style={[styles.priceText, { color: colors.text, fontWeight: '600' }]}>
                          {displayVenue.google_rating.toFixed(1)}
                        </Text>
                        {displayVenue.google_rating_count != null && (
                          <Text style={[styles.priceText, { color: colors.textSecondary }]}>
                            ({displayVenue.google_rating_count})
                          </Text>
                        )}
                      </View>
                    ) : (
                      <Text style={[styles.noReviewsHint, { color: colors.textTertiary }]}>
                        {enriching ? 'Bilgiler yukleniyor...' : 'Henuz degerlendirme yok'}
                      </Text>
                    )}
                  </>
                ) : (
                  <>
                    <Text style={[styles.venueAddress, { color: colors.textSecondary }]} numberOfLines={1}>
                      {displayVenue?.address ?? venue?.address}
                    </Text>
                    <View style={styles.ratingsRow}>
                      {venue.editorial_rating != null && (
                        <View style={styles.onyRatingBadge}>
                          <Image source={ONY_LOGO} style={styles.onyLogoSmall} resizeMode="contain" />
                          <Text style={styles.onyRatingText}>{venue.editorial_rating.toFixed(1)}</Text>
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
                  </>
                )}
              </Animated.View>
            </View>

            {/* ---- ACTION BUTTONS (always visible, below image) ---- */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionBtn, myReview ? styles.actionBtnRated : styles.actionBtnRate]}
                onPress={handleRate}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={myReview ? 'checkmark-circle' : 'star-outline'}
                  size={16}
                  color={myReview ? Colors.verified : '#FFF'}
                />
                <Text style={myReview ? [styles.actionBtnWhiteText, { color: Colors.verified, fontSize: FontSize.lg, fontFamily: FontFamily.headingBold }] : styles.actionBtnWhiteText}>
                  {myReview ? `${((myReview.taste_rating + myReview.value_rating + myReview.friendliness_rating) / 3).toFixed(1)}` : 'Puan Ver'}
                </Text>
              </TouchableOpacity>
              {!isExpanded && (
                <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDirections]} onPress={handleDirections} activeOpacity={0.8}>
                  <Ionicons name="navigate-outline" size={16} color="#FFF" />
                  <Text style={styles.actionBtnWhiteText}>Yol Tarifi</Text>
                </TouchableOpacity>
              )}
              {(
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnSave, { borderColor: colors.border }]}
                  onPress={handleSave}
                  activeOpacity={0.8}
                >
                  <Ionicons name={isFavorited ? 'heart' : 'heart-outline'} size={16} color={isFavorited ? Colors.primary : colors.text} />
                  <Text style={[styles.actionBtnSaveText, { color: colors.text }]}>Kaydet</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Post prompt after rating */}
            {showPostPrompt && venue && (
              <TouchableOpacity
                style={styles.postPromptBanner}
                activeOpacity={0.85}
                onPress={() => {
                  setShowPostPrompt(false);
                  router.push({ pathname: '/(tabs)/add', params: { venueId: venue.id, venueName: venue.name } });
                }}
              >
                <LinearGradient
                  colors={[Colors.primary, '#D4483B']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.postPromptGradient}
                >
                  <View style={styles.postPromptContent}>
                    <Ionicons name="camera-outline" size={22} color="#FFF" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.postPromptTitle}>Deneyimini paylas!</Text>
                      <Text style={styles.postPromptSubtitle}>Bu mekan hakkinda gonderi olustur</Text>
                    </View>
                    <Ionicons name="arrow-forward-circle" size={24} color="rgba(255,255,255,0.8)" />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* "Detaylari Gor" hint — only when collapsed */}
            {!isExpanded && (
              <TouchableOpacity style={styles.detailHint} onPress={handleExpandHint} activeOpacity={0.7}>
                <Text style={[styles.detailHintText, { color: Colors.primary }]}>Detaylari Gor</Text>
                <Ionicons name="chevron-up" size={16} color={Colors.primary} />
              </TouchableOpacity>
            )}
          </View>

          {/* ========================================
              EXPANDED DETAIL — below compact card
          ======================================== */}
          {showDetail && (
            <View style={styles.expandedSection}>
              {/* ---- 1. EKIP PUANI (editorial) — shown first ---- */}
              {venue.editorial_rating != null && (
                <GlassView style={[styles.scoreCard, styles.scoreCardGlass]} fallbackColor={colors.card}>
                  {/* Header row: logo + score + label */}
                  <View style={styles.scoreCardHeader}>
                    <Image source={ONY_LOGO} style={styles.scoreCardLogo} resizeMode="contain" />
                    <Text style={[styles.scoreCardValue, { color: Colors.primary }]}>
                      {venue.editorial_rating.toFixed(1)}
                    </Text>
                    <Text style={[styles.scoreCardLabel, { color: colors.textSecondary }]}>Ekip Puani</Text>
                  </View>
                  {/* 3 sub-rating bars */}
                  <View style={styles.scoreCardBars}>
                    {[
                      { label: RatingCategories[0].label, value: venue.avg_taste_rating, icon: RatingCategories[0].icon as keyof typeof Ionicons.glyphMap, color: Colors.primary },
                      { label: RatingCategories[1].label, value: venue.avg_value_rating, icon: RatingCategories[1].icon as keyof typeof Ionicons.glyphMap, color: Colors.accent },
                      { label: RatingCategories[2].label, value: venue.avg_friendliness_rating, icon: RatingCategories[2].icon as keyof typeof Ionicons.glyphMap, color: Colors.verified },
                    ].map((cat) => (
                      <View key={cat.label} style={styles.miniRatingRow}>
                        <Ionicons name={cat.icon} size={14} color={cat.color} />
                        <Text style={[styles.miniRatingLabel, { color: colors.textSecondary }]}>{cat.label}</Text>
                        <View style={[styles.miniRatingTrack, { backgroundColor: colors.border }]}>
                          <View style={[styles.miniRatingFill, { width: ratingBarWidth(cat.value) as any, backgroundColor: cat.color }]} />
                        </View>
                        <Text style={[styles.miniRatingValue, { color: colors.text }]}>{cat.value.toFixed(1)}</Text>
                      </View>
                    ))}
                  </View>
                  {/* Editorial note */}
                  {venue.editorial_note && (
                    <View style={[styles.scoreCardNote, { borderTopColor: colors.border }]}>
                      <Ionicons name="chatbox-ellipses" size={14} color={Colors.primary} />
                      <Text style={[styles.scoreCardNoteText, { color: colors.text }]}>
                        {venue.editorial_note}
                      </Text>
                    </View>
                  )}
                </GlassView>
              )}

              {/* ---- 2. KULLANICI PUANI (user ratings) ---- */}
              {venue.total_reviews > 0 && (
                <GlassView style={[styles.scoreCard, styles.scoreCardGlass]} fallbackColor={colors.card}>
                  {/* Header row: star + score + count */}
                  <View style={styles.scoreCardHeader}>
                    <View style={styles.scoreCardStarCircle}>
                      <Ionicons name="star" size={16} color={Colors.star} />
                    </View>
                    <Text style={[styles.scoreCardValue, { color: colors.text }]}>
                      {venue.overall_rating.toFixed(1)}
                    </Text>
                    <Text style={[styles.scoreCardLabel, { color: colors.textSecondary }]}>
                      {venue.total_reviews} degerlendirme
                    </Text>
                  </View>
                  {/* 3 sub-rating bars */}
                  <View style={styles.scoreCardBars}>
                    {[
                      { label: RatingCategories[0].label, value: venue.avg_taste_rating, icon: RatingCategories[0].icon as keyof typeof Ionicons.glyphMap, color: Colors.primary },
                      { label: RatingCategories[1].label, value: venue.avg_value_rating, icon: RatingCategories[1].icon as keyof typeof Ionicons.glyphMap, color: Colors.accent },
                      { label: RatingCategories[2].label, value: venue.avg_friendliness_rating, icon: RatingCategories[2].icon as keyof typeof Ionicons.glyphMap, color: Colors.verified },
                    ].map((cat) => (
                      <View key={cat.label} style={styles.miniRatingRow}>
                        <Ionicons name={cat.icon} size={14} color={cat.color} />
                        <Text style={[styles.miniRatingLabel, { color: colors.textSecondary }]}>{cat.label}</Text>
                        <View style={[styles.miniRatingTrack, { backgroundColor: colors.border }]}>
                          <View style={[styles.miniRatingFill, { width: ratingBarWidth(cat.value) as any, backgroundColor: cat.color }]} />
                        </View>
                        <Text style={[styles.miniRatingValue, { color: colors.text }]}>{cat.value.toFixed(1)}</Text>
                      </View>
                    ))}
                  </View>
                </GlassView>
              )}

              {/* ---- INFO SECTION ---- */}
              <GlassView style={[styles.infoSection, styles.infoSectionGlass]} fallbackColor={colors.card}>
                <View style={styles.infoRow}>
                  <View style={[styles.infoIconCircle, { backgroundColor: colors.primarySoft }]}>
                    <Ionicons name="location" size={18} color={Colors.primary} />
                  </View>
                  <Text style={[styles.infoTextLg, { color: colors.text }]} numberOfLines={2}>
                    {displayVenue?.address ?? venue?.address}
                  </Text>
                  <TouchableOpacity style={styles.directionsBtn} onPress={handleDirections} activeOpacity={0.8}>
                    <Ionicons name="navigate" size={14} color="#FFF" />
                    <Text style={styles.directionsBtnText}>Yol Tarifi</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.infoRow}>
                  <View style={[styles.infoIconCircle, { backgroundColor: colors.primarySoft }]}>
                    <Ionicons name="cash" size={18} color={Colors.accent} />
                  </View>
                  <Text style={[styles.infoTextLg, { color: colors.text }]}>
                    {priceLabel} {'\u00B7'} {priceDesc}
                  </Text>
                </View>

                {(displayVenue?.phone || displayVenue?.google_phone) && (
                  <View style={styles.infoRow}>
                    <View style={[styles.infoIconCircle, { backgroundColor: colors.primarySoft }]}>
                      <Ionicons name="call" size={18} color={Colors.primaryDark} />
                    </View>
                    <TouchableOpacity onPress={() => Linking.openURL(`tel:${displayVenue?.phone || displayVenue?.google_phone}`)}>
                      <Text style={[styles.infoTextLg, { color: colors.text }]}>{displayVenue?.phone || displayVenue?.google_phone}</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {displayVenue?.google_website && (
                  <View style={styles.infoRow}>
                    <View style={[styles.infoIconCircle, { backgroundColor: colors.primarySoft }]}>
                      <Ionicons name="globe" size={18} color={Colors.accent} />
                    </View>
                    <TouchableOpacity onPress={() => Linking.openURL(displayVenue.google_website!)}>
                      <Text style={[styles.infoTextLg, { color: Colors.primary }]} numberOfLines={1}>
                        {displayVenue.google_website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {displayVenue?.google_hours && displayVenue.google_hours.length > 0 && (
                  <View style={styles.infoRow}>
                    <View style={[styles.infoIconCircle, { backgroundColor: colors.primarySoft }]}>
                      <Ionicons name="time" size={18} color={Colors.verified} />
                    </View>
                    <View style={{ flex: 1 }}>
                      {displayVenue.google_hours.map((line, i) => (
                        <Text key={i} style={[styles.infoTextSm, { color: colors.textSecondary }]}>
                          {line}
                        </Text>
                      ))}
                    </View>
                  </View>
                )}

                {venue?.tags && venue.tags.length > 0 && (
                  <View style={styles.tagContainer}>
                    {venue.tags.map((tag) => (
                      <View key={tag} style={[styles.tagPillLg, { backgroundColor: colors.accentSoft }]}>
                        <Text style={styles.tagTextLg}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </GlassView>

              {/* ---- SOCIAL VIDEOS ---- */}
              {venueVideos.length > 0 && (
                <View style={styles.videosSection}>
                  <View style={styles.videosSectionHeader}>
                    <View style={styles.videosSectionTitleRow}>
                      <Ionicons name="videocam" size={18} color={Colors.primary} />
                      <Text style={[styles.videosSectionTitle, { color: colors.text }]}>Sosyal Medya</Text>
                    </View>
                    <Text style={[styles.videosSectionCount, { color: colors.textTertiary }]}>{venueVideos.length} video</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.videosScroll}>
                    {venueVideos.map((video) => {
                      const platform = getPlatformInfo(video.platform);
                      return (
                        <TouchableOpacity
                          key={video.id}
                          style={[styles.videoCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                          onPress={() => Linking.openURL(video.video_url)}
                          activeOpacity={0.85}
                        >
                          <View style={styles.videoThumbnailContainer}>
                            <Image source={{ uri: video.thumbnail_url }} style={styles.videoThumbnail} />
                            <View style={styles.videoPlayOverlay}>
                              <Ionicons name="play" size={24} color="#FFFFFF" />
                            </View>
                            <View style={[styles.videoPlatformBadge, { backgroundColor: platform.color }]}>
                              <Ionicons name={platform.icon} size={12} color="#FFFFFF" />
                            </View>
                          </View>
                          <View style={styles.videoInfo}>
                            <Text style={[styles.videoTitle, { color: colors.text }]} numberOfLines={2}>{video.title}</Text>
                            {video.author && (
                              <Text style={[styles.videoAuthor, { color: colors.textTertiary }]} numberOfLines={1}>@{video.author}</Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* ---- COMMUNITY POSTS ---- */}
              {venuePosts.length > 0 && (
                <View style={styles.communitySection}>
                  <View style={styles.communitySectionHeader}>
                    <View style={styles.communitySectionTitleRow}>
                      <Ionicons name="people" size={18} color={Colors.primary} />
                      <Text style={[styles.communitySectionTitle, { color: colors.text }]}>Topluluk</Text>
                    </View>
                    <Text style={[styles.communitySectionCount, { color: colors.textTertiary }]}>{venuePosts.length} paylasim</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.communityScroll}>
                    {venuePosts.map((post) => {
                      const firstImage = post.images?.[0]?.image_url;
                      return (
                        <View key={post.id} style={[styles.communityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                          {firstImage ? (
                            <View style={styles.communityImageContainer}>
                              <Image source={{ uri: firstImage }} style={styles.communityImage} />
                              {(post.images?.length ?? 0) > 1 && (
                                <View style={styles.communityImageCount}>
                                  <Ionicons name="images" size={10} color="#FFFFFF" />
                                  <Text style={styles.communityImageCountText}>{post.images?.length}</Text>
                                </View>
                              )}
                            </View>
                          ) : (
                            <View style={[styles.communityImageContainer, styles.communityImagePlaceholder, { backgroundColor: colors.backgroundSecondary }]}>
                              <Ionicons name="chatbubble-ellipses-outline" size={24} color={colors.textTertiary} />
                            </View>
                          )}
                          <View style={styles.communityCardBody}>
                            <View style={styles.communityUserRow}>
                              <Avatar uri={post.user?.avatar_url} name={post.user?.full_name ?? post.user?.username ?? '?'} size={20} />
                              <Text style={[styles.communityUsername, { color: colors.text }]} numberOfLines={1}>
                                {post.user?.username ?? 'Kullanici'}
                              </Text>
                              <Text style={[styles.communityTime, { color: colors.textTertiary }]}>
                                {getRelativeTime(post.created_at)}
                              </Text>
                            </View>
                            {post.caption ? (
                              <Text style={[styles.communityCaption, { color: colors.textSecondary }]} numberOfLines={2}>{post.caption}</Text>
                            ) : null}
                            <View style={styles.communityEngagement}>
                              <View style={styles.communityEngagementItem}>
                                <Ionicons name="heart" size={12} color={Colors.primary} />
                                <Text style={[styles.communityEngagementText, { color: colors.textTertiary }]}>{post.likes_count ?? 0}</Text>
                              </View>
                              <View style={styles.communityEngagementItem}>
                                <Ionicons name="chatbubble" size={11} color={colors.textTertiary} />
                                <Text style={[styles.communityEngagementText, { color: colors.textTertiary }]}>{post.comments_count ?? 0}</Text>
                              </View>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* ---- REVIEWS LIST ---- */}
              <View style={styles.reviewsSection}>
                <View style={styles.reviewsSectionHeader}>
                  <Text style={[styles.reviewsSectionTitle, { color: colors.text }]}>
                    Degerlendirmeler
                  </Text>
                  <View style={styles.reviewsCountBadge}>
                    <Text style={styles.reviewsCountText}>{reviews.length}</Text>
                  </View>
                </View>

                {loadingDetail ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                  </View>
                ) : reviews.length === 0 ? (
                  <View style={styles.noReviews}>
                    <Ionicons name="chatbubbles-outline" size={40} color={colors.border} />
                    <Text style={[styles.noReviewsTitle, { color: colors.text }]}>
                      Henuz degerlendirme yok
                    </Text>
                    <Text style={[styles.noReviewsSubtitle, { color: colors.textSecondary }]}>
                      Ilk degerlendirmeyi sen yap!
                    </Text>
                  </View>
                ) : (
                  reviews.map((review) => <ReviewItem key={review.id} item={review} colors={colors} />)
                )}
              </View>

              <View style={styles.bottomSpacer} />
            </View>
          )}
        </BottomSheetScrollView>
        </GlassProvider>
      )}
    </BottomSheet>

    {/* ── RATING MODAL ── */}
    <Modal visible={showRating} animationType="none" transparent onRequestClose={() => setShowRating(false)}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.rateModalContainer}>
        <Animated.View style={[styles.rateModalOverlay, rateOverlayAnimStyle]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={dismissRating} />
        </Animated.View>
        <GestureDetector gesture={ratePanGesture}>
        <Animated.View
          style={[styles.rateSheet, { backgroundColor: colors.background }, rateSheetAnimStyle]}
        >
          <View style={[styles.rateHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.rateTitle, { color: colors.text }]}>{myReview ? 'Puanini Guncelle' : 'Puan Ver'}</Text>
          {venue && (
            <Text style={[styles.rateVenueName, { color: colors.textSecondary }]} numberOfLines={1}>
              {venue.name}
            </Text>
          )}

          {/* 3-axis ratings */}
          {[
            { label: RatingCategories[0].label, icon: RatingCategories[0].icon as keyof typeof Ionicons.glyphMap, value: rateTaste, setter: setRateTaste, color: Colors.primary },
            { label: RatingCategories[1].label, icon: RatingCategories[1].icon as keyof typeof Ionicons.glyphMap, value: rateValue, setter: setRateValue, color: Colors.accent },
            { label: RatingCategories[2].label, icon: RatingCategories[2].icon as keyof typeof Ionicons.glyphMap, value: rateFriendliness, setter: setRateFriendliness, color: Colors.verified },
          ].map((cat) => (
            <View key={cat.label} style={styles.rateCategoryRow}>
              <View style={styles.rateCategoryLabel}>
                <Ionicons name={cat.icon} size={18} color={cat.color} />
                <Text style={[styles.rateCategoryText, { color: colors.text }]}>{cat.label}</Text>
              </View>
              <StarRating
                rating={cat.value}
                size="lg"
                interactive
                onRatingChange={cat.setter}
                color={cat.color}
              />
            </View>
          ))}

          {/* Comment */}
          <TextInput
            style={[styles.rateCommentInput, { color: colors.text, backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
            placeholder="Yorumun (istege bagli)..."
            placeholderTextColor={colors.textTertiary}
            value={rateComment}
            onChangeText={setRateComment}
            multiline
            maxLength={500}
            textAlignVertical="top"
          />

          {/* Actions */}
          <View style={styles.rateActions}>
            <TouchableOpacity
              style={[styles.rateCancelBtn, { borderColor: colors.border }]}
              onPress={() => setShowRating(false)}
              activeOpacity={0.7}
            >
              <Text style={[styles.rateCancelText, { color: colors.textSecondary }]}>Vazgec</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.rateSubmitBtn, (rateTaste === 0 || rateValue === 0 || rateFriendliness === 0) && styles.rateSubmitBtnDisabled]}
              onPress={handleSubmitRating}
              activeOpacity={0.85}
              disabled={rateSubmitting}
            >
              {rateSubmitting ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.rateSubmitText}>Gonder</Text>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
        </GestureDetector>
      </KeyboardAvoidingView>
    </Modal>
    </>
  );
}

// ======================================
// STYLES
// ======================================
const styles = StyleSheet.create({
  sheet: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  glassBackground: {
    ...StyleSheet.absoluteFillObject,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
  },
  handleIndicator: {
    backgroundColor: 'rgba(255,255,255,0.4)',
    width: 40,
    height: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 120,
  },

  // ---- COMPACT SECTION ----
  compactSection: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  closeButton: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.xl,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  venueRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
    marginTop: Spacing.sm,
    flexWrap: 'wrap',
  },
  morphImageWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  morphImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
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
  onyRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  onyLogoSmall: {
    width: 18,
    height: 18,
  },
  onyRatingText: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontFamily: FontFamily.headingBold,
  },
  priceText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodySemiBold,
  },
  noReviewsHint: {
    fontSize: FontSize.sm,
    fontStyle: 'italic',
    marginTop: Spacing.xs,
  },
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
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
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
  actionBtnRated: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.verified,
  },
  postPromptBanner: {
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  postPromptGradient: {
    borderRadius: BorderRadius.md,
  },
  postPromptContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  postPromptTitle: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.headingBold,
    color: '#FFF',
  },
  postPromptSubtitle: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
    color: 'rgba(255,255,255,0.75)',
  },
  actionBtnDirections: {
    backgroundColor: '#06B6D4',
  },
  actionBtnWhiteText: {
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

  // ---- EXPANDED SECTION ----
  expandedSection: {
    marginTop: Spacing.sm,
  },
  heroBottomContent: {
    position: 'absolute',
    bottom: Spacing.lg,
    left: Spacing.lg,
    right: Spacing.lg,
    gap: Spacing.sm,
  },
  heroName: {
    fontSize: FontSize.xxl,
    fontFamily: FontFamily.heading,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
    letterSpacing: -0.3,
  },
  levelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  levelPillText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.headingBold,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },

  // ---- COMPACT SCORE CARDS ----
  scoreCard: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.md,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  scoreCardGlass: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  scoreCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  scoreCardLogo: {
    width: 24,
    height: 24,
  },
  scoreCardStarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreCardValue: {
    fontSize: FontSize.xxl,
    fontFamily: FontFamily.headingBold,
    letterSpacing: -0.5,
  },
  scoreCardLabel: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodyMedium,
    flex: 1,
  },
  scoreCardBars: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  miniRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  miniRatingLabel: {
    fontSize: FontSize.xs,
    width: 100,
  },
  miniRatingTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  miniRatingFill: {
    height: '100%',
    borderRadius: 3,
  },
  miniRatingValue: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.headingBold,
    width: 28,
    textAlign: 'right',
  },
  scoreCardNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  scoreCardNoteText: {
    flex: 1,
    fontSize: FontSize.sm,
    lineHeight: 20,
    fontStyle: 'italic',
  },

  // ---- INFO SECTION ----
  infoSection: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  infoSectionGlass: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  infoIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    fontSize: FontSize.md,
    flex: 1,
    lineHeight: 22,
  },
  infoTextLg: {
    fontSize: FontSize.lg,
    flex: 1,
    lineHeight: 26,
    fontFamily: FontFamily.bodyMedium,
  },
  infoTextSm: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    fontFamily: FontFamily.body,
  },
  directionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
  },
  directionsBtnText: {
    fontSize: FontSize.sm + 1,
    fontFamily: FontFamily.headingBold,
    color: '#FFFFFF',
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  tagPill: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 1,
  },
  tagText: {
    fontSize: FontSize.xs,
    color: Colors.accent,
    fontWeight: '600',
  },
  tagPillLg: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  tagTextLg: {
    fontSize: FontSize.sm,
    color: Colors.accent,
    fontFamily: FontFamily.bodySemiBold,
  },

  // (editorial styles removed — now uses scoreCard)

  // ---- SOCIAL VIDEOS SECTION ----
  videosSection: {
    paddingTop: Spacing.xxl,
  },
  videosSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  videosSectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  videosSectionTitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.headingBold,
  },
  videosSectionCount: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  videosScroll: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  videoCard: {
    width: 140,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
  },
  videoThumbnailContainer: {
    width: '100%',
    height: 180,
    position: 'relative',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  videoPlayOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  videoPlatformBadge: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoInfo: {
    padding: Spacing.sm,
    gap: 2,
  },
  videoTitle: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    lineHeight: 16,
  },
  videoAuthor: {
    fontSize: FontSize.xs - 1,
    fontWeight: '500',
  },

  // ---- COMMUNITY POSTS SECTION ----
  communitySection: {
    paddingTop: Spacing.xxl,
  },
  communitySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  communitySectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  communitySectionTitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.headingBold,
  },
  communitySectionCount: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  communityScroll: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  communityCard: {
    width: 200,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
  },
  communityImageContainer: {
    width: '100%',
    height: 130,
    position: 'relative',
  },
  communityImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  communityImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  communityImageCount: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  communityImageCountText: {
    fontSize: FontSize.xs - 1,
    fontFamily: FontFamily.bodySemiBold,
    color: '#FFFFFF',
  },
  communityCardBody: {
    padding: Spacing.sm + 2,
    gap: Spacing.xs + 1,
  },
  communityUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  communityUsername: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.headingBold,
    flex: 1,
  },
  communityTime: {
    fontSize: FontSize.xs - 1,
  },
  communityCaption: {
    fontSize: FontSize.xs,
    lineHeight: 16,
  },
  communityEngagement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: 2,
  },
  communityEngagementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  communityEngagementText: {
    fontSize: FontSize.xs - 1,
    fontFamily: FontFamily.bodySemiBold,
  },

  // ---- REVIEWS SECTION ----
  reviewsSection: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxl,
  },
  reviewsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  reviewsSectionTitle: {
    fontSize: FontSize.xl,
    fontFamily: FontFamily.headingBold,
  },
  reviewsCountBadge: {
    backgroundColor: Colors.primarySoft,
    borderRadius: BorderRadius.full,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  reviewsCountText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.headingBold,
    color: Colors.primary,
  },
  loadingContainer: {
    paddingVertical: Spacing.xxxl,
    alignItems: 'center',
  },
  noReviews: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    gap: Spacing.sm,
  },
  noReviewsTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  noReviewsSubtitle: {
    fontSize: FontSize.sm,
  },
  reviewCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  reviewCardGlass: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  reviewHeaderText: {
    flex: 1,
  },
  reviewUsername: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.headingBold,
  },
  reviewDate: {
    fontSize: FontSize.xs,
    marginTop: 1,
  },
  reviewAvgBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  reviewAvgText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.headingBold,
  },
  reviewComment: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    marginTop: Spacing.sm,
  },
  reviewRatingPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  reviewPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  reviewPillText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.headingBold,
  },

  // ---- BOTTOM SPACER ----
  bottomSpacer: {
    height: Spacing.xxxl + Spacing.xl,
  },

  // ---- RATING MODAL ----
  rateModalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  rateModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  rateSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.xxl,
    paddingTop: Spacing.md,
  },
  rateHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  rateTitle: {
    fontSize: FontSize.xl,
    fontFamily: FontFamily.headingBold,
    marginBottom: Spacing.xs,
  },
  rateVenueName: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodyMedium,
    marginBottom: Spacing.xl,
  },
  rateCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  rateCategoryLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    width: 140,
  },
  rateCategoryText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.bodySemiBold,
  },
  rateCommentInput: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    fontSize: FontSize.sm,
    minHeight: 80,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  rateActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  rateCancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rateCancelText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  rateSubmitBtn: {
    flex: 2,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rateSubmitBtnDisabled: {
    opacity: 0.5,
  },
  rateSubmitText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
    color: '#FFFFFF',
  },
});
