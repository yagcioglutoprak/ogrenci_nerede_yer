import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Platform,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontSize,
  FontFamily,
  PriceRanges,
  VenueLevels,
  RatingCategories,
} from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useVenueStore } from '../../stores/venueStore';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { MOCK_SOCIAL_VIDEOS, MOCK_POSTS, MOCK_USERS, MOCK_POST_IMAGES } from '../../lib/mockData';
import GlassView from '../ui/GlassView';
import RatingBar from '../ui/RatingBar';
import Avatar from '../ui/Avatar';
import { haptic } from '../../lib/haptics';
import type { Venue, Review, Post } from '../../types';

const ONY_LOGO = require('../../../assets/logo-icon-hires.png');
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = 200;

interface VenueBottomSheetProps {
  venue: Venue | null;
  onDismiss: () => void;
  onExpandChange?: (expanded: boolean) => void;
}

// Custom glass background for BottomSheet
function GlassBackground({ style }: { style?: any }) {
  return (
    <GlassView
      style={[styles.glassBackground, style]}
      blurIntensity={90}
    />
  );
}

export default function VenueBottomSheet({ venue, onDismiss, onExpandChange }: VenueBottomSheetProps) {
  const colors = useThemeColors();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['40%', '95%'], []);
  const prevVenueIdRef = useRef<string | null>(null);

  const { reviews, fetchReviews, toggleFavorite } = useVenueStore();
  const user = useAuthStore((s) => s.user);

  const [sheetIndex, setSheetIndex] = useState(-1);
  const [showDetail, setShowDetail] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [venuePosts, setVenuePosts] = useState<Post[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

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
        setLoadingDetail(true);

        // Fetch reviews
        fetchReviews(venue.id).finally(() => setLoadingDetail(false));

        // Fetch venue posts
        fetchVenuePosts(venue.id);
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
          user:users(*),
          images:post_images(*)
        `)
        .eq('venue_id', venueId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data && data.length > 0) {
        setVenuePosts(data as Post[]);
        return;
      }
    } catch {}

    // Fallback: mock data
    const mockPosts = MOCK_POSTS
      .filter((p) => p.venue_id === venueId)
      .map((p) => ({
        ...p,
        user: MOCK_USERS.find((u) => u.id === p.user_id),
        images: MOCK_POST_IMAGES.filter((img) => img.post_id === p.id).sort((a, b) => a.order - b.order),
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) as Post[];
    setVenuePosts(mockPosts);
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
    // TODO: open rating modal or navigate
  }, [venue]);

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

  // Derived values
  const priceLabel = venue
    ? PriceRanges.find((p) => p.value === venue.price_range)?.label ?? ''
    : '';
  const priceDesc = venue
    ? PriceRanges.find((p) => p.value === venue.price_range)?.description ?? ''
    : '';
  const levelInfo = venue ? VenueLevels.find((l) => l.level === venue.level) : null;

  // Determine tier
  const tier: 'google_places' | 'unreviewed' | 'reviewed' = (() => {
    if (!venue) return 'reviewed';
    if (venue.source === 'google_places') return 'google_places';
    if (venue.total_reviews > 0) return 'reviewed';
    return 'unreviewed';
  })();

  // Social videos for this venue
  const venueVideos = venue
    ? MOCK_SOCIAL_VIDEOS.filter((v) => v.venue_id === venue.id)
    : [];

  const isExpanded = sheetIndex === 1;

  // Relative time helper
  const getRelativeTime = (dateString: string): string => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMinutes < 1) return 'simdi';
    if (diffMinutes < 60) return `${diffMinutes}dk`;
    if (diffHours < 24) return `${diffHours}sa`;
    if (diffDays < 7) return `${diffDays}g`;
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  };

  // Rating bar width helper
  const ratingBarWidth = (rating: number) => `${(rating / 5) * 100}%`;

  // Render a single review card
  const renderReviewItem = (item: Review) => {
    const avg = (
      (item.taste_rating + item.value_rating + item.friendliness_rating) / 3
    ).toFixed(1);

    const ratingPills = [
      { icon: 'restaurant' as keyof typeof Ionicons.glyphMap, value: item.taste_rating, color: Colors.primary },
      { icon: 'pricetag' as keyof typeof Ionicons.glyphMap, value: item.value_rating, color: Colors.accent },
      { icon: 'cafe' as keyof typeof Ionicons.glyphMap, value: item.friendliness_rating, color: Colors.verified },
    ];

    return (
      <View key={item.id} style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
      </View>
    );
  };

  return (
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
                {venue.cover_image_url ? (
                  <Image source={{ uri: venue.cover_image_url }} style={styles.morphImage} />
                ) : tier === 'google_places' ? (
                  <Ionicons name="location" size={28} color="#9CA3AF" />
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
                {tier === 'google_places' ? (
                  <>
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
                  </>
                ) : tier === 'unreviewed' ? (
                  <>
                    <Text style={[styles.venueAddress, { color: colors.textSecondary }]} numberOfLines={1}>
                      {venue.address}
                    </Text>
                    <Text style={[styles.noReviewsHint, { color: colors.textTertiary }]}>
                      Henuz degerlendirme yok
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={[styles.venueAddress, { color: colors.textSecondary }]} numberOfLines={1}>
                      {venue.address}
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
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnRate]} onPress={handleRate} activeOpacity={0.8}>
                <Ionicons name="star-outline" size={16} color="#FFF" />
                <Text style={styles.actionBtnWhiteText}>
                  {tier === 'reviewed' ? 'Puan Ver' : 'Degerlendir'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDirections]} onPress={handleDirections} activeOpacity={0.8}>
                <Ionicons name="navigate-outline" size={16} color="#FFF" />
                <Text style={styles.actionBtnWhiteText}>Yol Tarifi</Text>
              </TouchableOpacity>
              {tier !== 'google_places' && (
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
                <View style={[styles.scoreCard, { backgroundColor: colors.card, borderColor: Colors.primary + '25' }]}>
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
                </View>
              )}

              {/* ---- 2. KULLANICI PUANI (user ratings) ---- */}
              {tier !== 'google_places' && venue.total_reviews > 0 && (
                <View style={[styles.scoreCard, { backgroundColor: colors.card, borderColor: Colors.accent + '25' }]}>
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
                </View>
              )}

              {/* ---- INFO SECTION ---- */}
              <View style={styles.infoSection}>
                <View style={styles.infoRow}>
                  <View style={[styles.infoIconCircle, { backgroundColor: colors.primarySoft }]}>
                    <Ionicons name="location" size={18} color={Colors.primary} />
                  </View>
                  <Text style={[styles.infoTextLg, { color: colors.text }]} numberOfLines={2}>
                    {venue.address}
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

                {venue.phone && (
                  <View style={styles.infoRow}>
                    <View style={[styles.infoIconCircle, { backgroundColor: colors.primarySoft }]}>
                      <Ionicons name="call" size={18} color={Colors.primaryDark} />
                    </View>
                    <TouchableOpacity onPress={() => Linking.openURL(`tel:${venue.phone}`)}>
                      <Text style={[styles.infoTextLg, { color: colors.text }]}>{venue.phone}</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {venue.tags && venue.tags.length > 0 && (
                  <View style={styles.tagContainer}>
                    {venue.tags.map((tag) => (
                      <View key={tag} style={[styles.tagPillLg, { backgroundColor: colors.accentSoft }]}>
                        <Text style={styles.tagTextLg}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

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
                  reviews.map((review) => renderReviewItem(review))
                )}
              </View>

              <View style={styles.bottomSpacer} />
            </View>
          )}
        </BottomSheetScrollView>
      )}
    </BottomSheet>
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
    paddingBottom: Spacing.xl,
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
    borderWidth: 1,
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
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxl,
    gap: Spacing.md,
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
    borderWidth: 1,
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
});
