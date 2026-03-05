import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Dimensions,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
  Share,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVenueStore } from '../../stores/venueStore';
import { useAuthStore } from '../../stores/authStore';
import { useListStore } from '../../stores/listStore';
import { MOCK_SOCIAL_VIDEOS } from '../../lib/mockData';
import {
  Colors,
  PriceRanges,
  VenueLevels,
  RatingCategories,
  Spacing,
  BorderRadius,
  FontSize,
  FontFamily,
} from '../../lib/constants';
import StarRating from '../../components/ui/StarRating';
import RatingBar from '../../components/ui/RatingBar';
import CircleRating from '../../components/ui/CircleRating';
import Avatar from '../../components/ui/Avatar';
import type { Review, SocialVideo } from '../../types';
import GlassView from '../../components/ui/GlassView';
import { useThemeColors } from '../../hooks/useThemeColors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = 280;

export default function VenueDetailScreen() {
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const {
    selectedVenue: venue,
    reviews,
    loading,
    fetchVenueById,
    fetchReviews,
    addReview,
    toggleFavorite,
  } = useVenueStore();
  const { userLists, fetchUserLists, addVenueToList } = useListStore();

  const [isFavorited, setIsFavorited] = useState(false);
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [showListPicker, setShowListPicker] = useState(false);
  const [ratingTaste, setRatingTaste] = useState(0);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingFriendliness, setRatingFriendliness] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (id) {
      fetchVenueById(id);
      fetchReviews(id);
    }
  }, [id]);

  useEffect(() => {
    if (user) fetchUserLists(user.id);
  }, [user]);

  const handleFavorite = async () => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    if (!venue) return;
    setIsFavorited((prev) => !prev);
    await toggleFavorite(venue.id, user.id);
  };

  const handleShareVenue = async () => {
    if (!venue) return;
    const message = `${venue.name}\n⭐ ${venue.overall_rating.toFixed(1)} · ${venue.address}\n\nOgrenci Nerede Yer? uygulamasinda kesfet!`;
    try {
      await Share.share({ message });
    } catch {}
  };

  const handleToggleRatingForm = () => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    setShowRatingForm((prev) => !prev);
  };

  const handleSubmitReview = async () => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    if (!venue) return;
    if (ratingTaste === 0 || ratingValue === 0 || ratingFriendliness === 0) {
      Alert.alert('Hata', 'Lütfen tüm kategorileri puanlayın.');
      return;
    }

    setSubmittingReview(true);
    const { error } = await addReview({
      venue_id: venue.id,
      user_id: user.id,
      taste_rating: ratingTaste,
      value_rating: ratingValue,
      friendliness_rating: ratingFriendliness,
      comment: ratingComment.trim(),
    });
    setSubmittingReview(false);

    if (error) {
      Alert.alert('Hata', error);
    } else {
      Alert.alert('Teşekkürler!', 'Değerlendirmeniz kaydedildi.');
      setShowRatingForm(false);
      setRatingTaste(0);
      setRatingValue(0);
      setRatingFriendliness(0);
      setRatingComment('');
      fetchVenueById(venue.id);
      fetchReviews(venue.id);
    }
  };

  const openYouTube = () => {
    if (venue?.youtube_video_url) {
      Linking.openURL(venue.youtube_video_url);
    }
  };

  const openVideo = (url: string) => {
    Linking.openURL(url);
  };

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

  // -- Loading state --
  if (loading || !venue) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const priceLabel =
    PriceRanges.find((p) => p.value === venue.price_range)?.label ?? '';
  const priceDesc =
    PriceRanges.find((p) => p.value === venue.price_range)?.description ?? '';
  const levelInfo = VenueLevels.find((l) => l.level === venue.level);

  const ratingBarWidth = (rating: number) => `${(rating / 5) * 100}%`;

  // Social videos for this venue
  const venueVideos = MOCK_SOCIAL_VIDEOS.filter((v) => v.venue_id === venue.id);

  // -- Render review item --
  const renderReviewItem = (item: Review) => {
    const avg = (
      (item.taste_rating + item.value_rating + item.friendliness_rating) /
      3
    ).toFixed(1);

    const ratingPills = [
      { icon: 'restaurant' as keyof typeof Ionicons.glyphMap, value: item.taste_rating, color: Colors.primary },
      { icon: 'pricetag' as keyof typeof Ionicons.glyphMap, value: item.value_rating, color: Colors.accent },
      { icon: 'cafe' as keyof typeof Ionicons.glyphMap, value: item.friendliness_rating, color: Colors.verified },
    ];

    return (
      <View key={item.id} style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Header: avatar + name + date + score */}
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
          <View style={styles.reviewAvgBadge}>
            <Ionicons name="star" size={12} color={Colors.accent} />
            <Text style={styles.reviewAvgText}>{avg}</Text>
          </View>
        </View>

        {/* Comment */}
        {item.comment ? (
          <Text style={[styles.reviewComment, { color: colors.text }]}>{item.comment}</Text>
        ) : null}

        {/* Compact rating pills */}
        <View style={styles.reviewRatingPills}>
          {ratingPills.map((pill) => (
            <View key={pill.icon} style={[styles.reviewPill, { backgroundColor: colors.background }]}>
              <Ionicons name={pill.icon} size={12} color={pill.color} />
              <Text style={[styles.reviewPillText, { color: colors.textSecondary }]}>{pill.value.toFixed(1)}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // ===========================
  // MAIN RENDER
  // ===========================
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ============================
            HERO SECTION
        ============================ */}
        <View style={styles.heroContainer}>
          {venue.cover_image_url ? (
            <Image
              source={{ uri: venue.cover_image_url }}
              style={styles.heroImage}
            />
          ) : (
            <LinearGradient
              colors={[Colors.primaryDark, Colors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.heroImage, styles.heroPlaceholder]}
            >
              <Ionicons
                name="restaurant-outline"
                size={64}
                color="rgba(255,255,255,0.4)"
              />
            </LinearGradient>
          )}

          {/* Dark gradient overlay */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.75)']}
            style={styles.heroGradient}
          />

          {/* Top bar: Back + Share + Favorite */}
          <SafeAreaView edges={['top']} style={styles.heroTopBar}>
            <GlassView style={styles.heroCircleButtonGlass} fallbackColor="rgba(255,255,255,0.2)">
              <TouchableOpacity
                style={styles.heroCircleButtonInner}
                onPress={() => router.back()}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </GlassView>
            <View style={styles.heroTopBarRight}>
              <GlassView style={styles.heroCircleButtonGlass} fallbackColor="rgba(255,255,255,0.2)">
                <TouchableOpacity
                  style={styles.heroCircleButtonInner}
                  onPress={() => {
                    if (!user) { router.push('/auth/login'); return; }
                    setShowListPicker(!showListPicker);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="list-outline" size={22} color="#FFFFFF" />
                </TouchableOpacity>
              </GlassView>
              <GlassView style={styles.heroCircleButtonGlass} fallbackColor="rgba(255,255,255,0.2)">
                <TouchableOpacity
                  style={styles.heroCircleButtonInner}
                  onPress={handleShareVenue}
                  activeOpacity={0.7}
                >
                  <Ionicons name="share-outline" size={22} color="#FFFFFF" />
                </TouchableOpacity>
              </GlassView>
              <GlassView style={styles.heroCircleButtonGlass} fallbackColor="rgba(255,255,255,0.2)">
                <TouchableOpacity
                  style={styles.heroCircleButtonInner}
                  onPress={handleFavorite}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isFavorited ? 'heart' : 'heart-outline'}
                    size={22}
                    color={isFavorited ? Colors.primary : '#FFFFFF'}
                  />
                </TouchableOpacity>
              </GlassView>
            </View>
          </SafeAreaView>

          {/* Hero bottom text */}
          <View style={styles.heroBottomContent}>
            <View style={styles.heroNameRow}>
              <Text style={styles.heroName} numberOfLines={2}>
                {venue.name}
              </Text>
              {venue.is_verified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color="#FFFFFF"
                  />
                </View>
              )}
            </View>
            {levelInfo && (
              <View
                style={[
                  styles.levelPill,
                  { backgroundColor: levelInfo.color },
                ]}
              >
                <Ionicons name="shield-checkmark" size={12} color="#FFFFFF" />
                <Text style={styles.levelPillText}>{levelInfo.name}</Text>
              </View>
            )}
          </View>
        </View>

        {/* List Picker Dropdown */}
        {showListPicker && (
          <View style={{
            backgroundColor: colors.backgroundSecondary, borderRadius: BorderRadius.md,
            borderWidth: 1, borderColor: colors.border, marginHorizontal: Spacing.xl,
            marginBottom: Spacing.md, overflow: 'hidden',
          }}>
            {userLists.length === 0 ? (
              <TouchableOpacity
                style={{ padding: Spacing.lg, alignItems: 'center' }}
                onPress={() => { setShowListPicker(false); router.push('/list/create'); }}
              >
                <Text style={{ color: Colors.primary, fontFamily: FontFamily.bodySemiBold }}>Yeni Liste Olustur</Text>
              </TouchableOpacity>
            ) : (
              userLists.map((list) => (
                <TouchableOpacity
                  key={list.id}
                  style={{ flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: Spacing.sm }}
                  onPress={async () => {
                    await addVenueToList(list.id, venue.id);
                    setShowListPicker(false);
                    Alert.alert('Eklendi', `"${list.title}" listesine eklendi`);
                  }}
                >
                  <Ionicons name="list" size={18} color={Colors.primary} />
                  <Text style={{ flex: 1, color: colors.text, fontFamily: FontFamily.body }}>{list.title}</Text>
                  <Ionicons name="add" size={18} color={Colors.primary} />
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* ============================
            RATING OVERVIEW CARD
        ============================ */}
        <GlassView style={[styles.ratingCard, Platform.OS === 'ios' && styles.ratingCardGlass, { backgroundColor: colors.card }]} fallbackColor={colors.card}>
          {/* Top row: big circle + bar */}
          <View style={styles.ratingCardTop}>
            <CircleRating score={parseFloat(venue.overall_rating.toFixed(1))} maxScore={5} size="lg" autoColor />
            <View style={styles.ratingCardStarsCol}>
              <RatingBar rating={venue.overall_rating} size="lg" color={Colors.primary} showValue={false} barWidth={120} />
              <Text style={[styles.ratingCardReviewCount, { color: colors.textSecondary }]}>
                {venue.total_reviews} değerlendirme
              </Text>
            </View>
          </View>

          {/* Divider */}
          <View style={[styles.ratingCardDivider, { backgroundColor: colors.border }]} />

          {/* Sub-rating rows */}
          {[
            {
              label: RatingCategories[0].label,
              value: venue.avg_taste_rating,
              icon: RatingCategories[0].icon as keyof typeof Ionicons.glyphMap,
              color: Colors.primary,
            },
            {
              label: RatingCategories[1].label,
              value: venue.avg_value_rating,
              icon: RatingCategories[1].icon as keyof typeof Ionicons.glyphMap,
              color: Colors.accent,
            },
            {
              label: RatingCategories[2].label,
              value: venue.avg_friendliness_rating,
              icon: RatingCategories[2].icon as keyof typeof Ionicons.glyphMap,
              color: Colors.verified,
            },
          ].map((cat) => (
            <View key={cat.label} style={styles.subRatingRow}>
              <View style={styles.subRatingLabelArea}>
                <Ionicons name={cat.icon} size={16} color={cat.color} />
                <Text style={[styles.subRatingLabelText, { color: colors.textSecondary }]}>{cat.label}</Text>
              </View>
              <View style={[styles.subRatingBarTrack, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.subRatingBarFill,
                    {
                      width: ratingBarWidth(cat.value) as any,
                      backgroundColor: cat.color,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.subRatingValueText, { color: colors.text }]}>
                {cat.value.toFixed(1)}
              </Text>
            </View>
          ))}

          {/* Puan Ver button */}
          <TouchableOpacity
            onPress={handleToggleRatingForm}
            activeOpacity={0.8}
            style={{ marginTop: Spacing.md }}
          >
            <LinearGradient
              colors={[Colors.primary, Colors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.rateToggleButton}
            >
              <Ionicons name="star-outline" size={20} color="#FFFFFF" />
              <Text style={[styles.rateToggleText, { color: '#FFFFFF' }]}>Puan Ver</Text>
            </LinearGradient>
          </TouchableOpacity>
        </GlassView>

        {/* ============================
            INFO SECTION
        ============================ */}
        <View style={styles.infoSection}>
          {/* Address */}
          <View style={styles.infoRow}>
            <View style={[styles.infoIconCircle, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="location" size={16} color={Colors.primary} />
            </View>
            <Text style={[styles.infoText, { color: colors.text }]}>{venue.address}</Text>
          </View>

          {/* Price */}
          <View style={styles.infoRow}>
            <View style={[styles.infoIconCircle, { backgroundColor: colors.primarySoft }]}>
              <Ionicons name="cash" size={16} color={Colors.accent} />
            </View>
            <Text style={[styles.infoText, { color: colors.text }]}>
              {priceLabel} &middot; {priceDesc}
            </Text>
          </View>

          {/* Phone */}
          {venue.phone && (
            <View style={styles.infoRow}>
              <View style={[styles.infoIconCircle, { backgroundColor: colors.primarySoft }]}>
                <Ionicons
                  name="call"
                  size={16}
                  color={Colors.primaryDark}
                />
              </View>
              <Text style={[styles.infoText, { color: colors.text }]}>{venue.phone}</Text>
            </View>
          )}

          {/* Tags */}
          {venue.tags && venue.tags.length > 0 && (
            <View style={styles.tagContainer}>
              {venue.tags.map((tag) => (
                <View key={tag} style={[styles.tagPill, { backgroundColor: colors.accentSoft }]}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* YouTube link */}
          {venue.youtube_video_url && (
            <TouchableOpacity
              style={styles.youtubeButton}
              onPress={openYouTube}
              activeOpacity={0.7}
            >
              <Ionicons name="play-circle" size={22} color={Colors.primary} />
              <Text style={styles.youtubeButtonText}>
                YouTube İncelemesini İzle
              </Text>
              <Ionicons
                name="open-outline"
                size={16}
                color={Colors.textTertiary}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* ============================
            EDITORIAL REVIEW SECTION
        ============================ */}
        {venue.editorial_rating != null && (
          <View style={styles.editorialSection}>
            <View style={styles.editorialHeader}>
              <View style={styles.editorialBadge}>
                <Ionicons name="shield-checkmark" size={16} color="#FFFFFF" />
              </View>
              <Text style={[styles.editorialTitle, { color: colors.text }]}>Ekip Değerlendirmesi</Text>
            </View>

            <GlassView style={[styles.editorialCard, Platform.OS === 'ios' && styles.editorialCardGlass, { backgroundColor: colors.card, borderColor: colors.primarySoft }]} fallbackColor={colors.card}>
              {/* Score circle */}
              <View style={styles.editorialScoreRow}>
                <CircleRating score={venue.editorial_rating} size="lg" autoColor />
                <View style={styles.editorialScoreInfo}>
                  <Text style={[styles.editorialScoreLabel, { color: colors.textSecondary }]}>Ekip Puani</Text>
                  <RatingBar rating={venue.editorial_rating} maxRating={10} size="md" color={Colors.accent} showValue={false} />
                </View>
              </View>

              {/* Editorial note */}
              {venue.editorial_note && (
                <View style={[styles.editorialNoteContainer, { borderTopColor: colors.border }]}>
                  <Ionicons name="chatbox-ellipses" size={16} color={Colors.primary} />
                  <Text style={[styles.editorialNoteText, { color: colors.text }]}>{venue.editorial_note}</Text>
                </View>
              )}
            </GlassView>
          </View>
        )}

        {/* ============================
            SOCIAL VIDEOS SECTION
        ============================ */}
        {venueVideos.length > 0 && (
          <View style={styles.videosSection}>
            <View style={styles.videosSectionHeader}>
              <View style={styles.videosSectionTitleRow}>
                <Ionicons name="videocam" size={20} color={Colors.primary} />
                <Text style={[styles.videosSectionTitle, { color: colors.text }]}>Sosyal Medya</Text>
              </View>
              <Text style={styles.videosSectionCount}>{venueVideos.length} video</Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.videosScroll}
            >
              {venueVideos.map((video) => {
                const platform = getPlatformInfo(video.platform);
                return (
                  <TouchableOpacity
                    key={video.id}
                    style={[styles.videoCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => openVideo(video.video_url)}
                    activeOpacity={0.85}
                  >
                    {/* Thumbnail */}
                    <View style={styles.videoThumbnailContainer}>
                      <Image
                        source={{ uri: video.thumbnail_url }}
                        style={styles.videoThumbnail}
                      />
                      {/* Play overlay */}
                      <View style={styles.videoPlayOverlay}>
                        <Ionicons name="play" size={24} color="#FFFFFF" />
                      </View>
                      {/* Platform badge */}
                      <View style={[styles.videoPlatformBadge, { backgroundColor: platform.color }]}>
                        <Ionicons name={platform.icon} size={12} color="#FFFFFF" />
                      </View>
                    </View>

                    {/* Info */}
                    <View style={styles.videoInfo}>
                      <Text style={[styles.videoTitle, { color: colors.text }]} numberOfLines={2}>
                        {video.title}
                      </Text>
                      {video.author && (
                        <Text style={styles.videoAuthor} numberOfLines={1}>
                          @{video.author}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ============================
            RATING MODAL
        ============================ */}
        <Modal
          visible={showRatingForm}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowRatingForm(false)}
        >
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
              {/* Modal Header */}
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => setShowRatingForm(false)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Puan Ver</Text>
                <View style={{ width: 40 }} />
              </View>

              {/* Venue info at top */}
              {venue && (
                <View style={[styles.modalVenueInfo, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.modalVenueName, { color: colors.text }]}>{venue.name}</Text>
                  <Text style={[styles.modalVenueAddress, { color: colors.textSecondary }]}>{venue.address}</Text>
                </View>
              )}

              <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.modalFormContent}>
                {/* Taste */}
                <View style={[styles.rateFormRow, { borderBottomColor: colors.border }]}>
                  <View style={styles.rateFormLabel}>
                    <Ionicons name="restaurant" size={20} color={Colors.primary} />
                    <Text style={[styles.rateFormLabelText, { color: colors.text }]}>Lezzet</Text>
                  </View>
                  <StarRating rating={ratingTaste} interactive onRatingChange={setRatingTaste} size={32} />
                </View>

                {/* Value */}
                <View style={[styles.rateFormRow, { borderBottomColor: colors.border }]}>
                  <View style={styles.rateFormLabel}>
                    <Ionicons name="pricetag" size={20} color={Colors.accent} />
                    <Text style={[styles.rateFormLabelText, { color: colors.text }]}>Fiyat/Performans</Text>
                  </View>
                  <StarRating rating={ratingValue} interactive onRatingChange={setRatingValue} size={32} />
                </View>

                {/* Ortam */}
                <View style={[styles.rateFormRow, { borderBottomColor: colors.border }]}>
                  <View style={styles.rateFormLabel}>
                    <Ionicons name="cafe" size={20} color={Colors.verified} />
                    <Text style={[styles.rateFormLabelText, { color: colors.text }]}>Ortam</Text>
                  </View>
                  <StarRating rating={ratingFriendliness} interactive onRatingChange={setRatingFriendliness} size={32} />
                </View>

                {/* Comment */}
                <TextInput
                  style={[styles.rateCommentInput, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border, color: colors.text }]}
                  placeholder="Deneyimini paylaş..."
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  value={ratingComment}
                  onChangeText={setRatingComment}
                  textAlignVertical="top"
                />
              </ScrollView>

              {/* Submit button fixed at bottom */}
              <View style={[styles.modalFooter, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
                <TouchableOpacity
                  style={[styles.rateSubmitButton, submittingReview && styles.rateSubmitDisabled]}
                  onPress={handleSubmitReview}
                  disabled={submittingReview}
                  activeOpacity={0.8}
                >
                  {submittingReview ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="send" size={16} color="#FFFFFF" />
                      <Text style={styles.rateSubmitText}>Gönder</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </Modal>

        {/* ============================
            REVIEWS LIST
        ============================ */}
        <View style={styles.reviewsSection}>
          <View style={styles.reviewsSectionHeader}>
            <Text style={[styles.reviewsSectionTitle, { color: colors.text }]}>
              Değerlendirmeler
            </Text>
            <View style={styles.reviewsCountBadge}>
              <Text style={styles.reviewsCountText}>{reviews.length}</Text>
            </View>
          </View>

          {reviews.length === 0 ? (
            <View style={styles.noReviews}>
              <Ionicons
                name="chatbubbles-outline"
                size={48}
                color={Colors.border}
              />
              <Text style={[styles.noReviewsTitle, { color: colors.text }]}>
                Henüz değerlendirme yok
              </Text>
              <Text style={[styles.noReviewsSubtitle, { color: colors.textSecondary }]}>
                İlk değerlendirmeyi sen yap!
              </Text>
            </View>
          ) : (
            reviews.map((review) => renderReviewItem(review))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ======================================
// STYLES
// ======================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },

  // ---- HERO ----
  heroContainer: {
    height: HERO_HEIGHT,
    position: 'relative',
  },
  heroImage: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
    resizeMode: 'cover',
  },
  heroPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: HERO_HEIGHT * 0.65,
  },
  heroTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  heroTopBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  heroCircleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  heroBottomContent: {
    position: 'absolute',
    bottom: Spacing.xl,
    left: Spacing.lg,
    right: Spacing.lg,
    gap: Spacing.sm,
  },
  heroNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  heroName: {
    fontSize: 26,
    fontFamily: FontFamily.heading,
    color: '#FFFFFF',
    flex: 1,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
    letterSpacing: -0.3,
  },
  verifiedBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.verified,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.verified,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
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

  // ---- RATING OVERVIEW CARD ----
  ratingCard: {
    backgroundColor: Colors.card,
    marginHorizontal: Spacing.lg,
    marginTop: -Spacing.xxl,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
    zIndex: 10,
  },
  ratingCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  ratingBigNumber: {
    fontSize: FontSize.display,
    fontFamily: FontFamily.heading,
    color: Colors.text,
    letterSpacing: -1,
  },
  ratingCardStarsCol: {
    gap: Spacing.xs,
  },
  ratingCardReviewCount: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  ratingCardDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.lg,
  },
  subRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  subRatingLabelArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 140,
  },
  subRatingLabelText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  subRatingBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  subRatingBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  subRatingValueText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.headingBold,
    color: Colors.text,
    width: 30,
    textAlign: 'right',
  },

  // ---- INFO SECTION ----
  infoSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    gap: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  infoIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    fontSize: FontSize.md,
    color: Colors.text,
    flex: 1,
    lineHeight: 22,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  tagPill: {
    backgroundColor: Colors.accentSoft,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 1,
  },
  tagText: {
    fontSize: FontSize.xs,
    color: Colors.accent,
    fontWeight: '600',
  },
  youtubeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginTop: Spacing.xs,
  },
  youtubeButtonText: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.primary,
  },

  // ---- EDITORIAL SECTION ----
  editorialSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
  },
  editorialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  editorialBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editorialTitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.headingBold,
    color: Colors.text,
  },
  editorialCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1.5,
    borderColor: Colors.primarySoft,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  editorialScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  editorialScoreCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  editorialScoreNumber: {
    fontSize: 26,
    fontFamily: FontFamily.heading,
    color: Colors.primary,
  },
  editorialScoreMax: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textTertiary,
    marginTop: 8,
  },
  editorialScoreInfo: {
    flex: 1,
    gap: Spacing.sm,
  },
  editorialScoreLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  editorialScoreBar: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  editorialScoreBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  editorialNoteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  editorialNoteText: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
    lineHeight: 22,
    fontStyle: 'italic',
  },

  // ---- SOCIAL VIDEOS SECTION ----
  videosSection: {
    paddingTop: Spacing.xxl,
  },
  videosSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
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
    color: Colors.text,
  },
  videosSectionCount: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
  videosScroll: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  videoCard: {
    width: 140,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
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
    color: Colors.text,
    lineHeight: 16,
  },
  videoAuthor: {
    fontSize: FontSize.xs - 1,
    color: Colors.textTertiary,
    fontWeight: '500',
  },

  // ---- PUAN VER BUTTON ----
  rateToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  rateToggleText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
  },
  rateFormContainer: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  rateFormRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rateFormLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rateFormLabelText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  rateCommentInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
    minHeight: 80,
    marginTop: Spacing.xs,
  },
  rateSubmitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2,
    marginTop: Spacing.xs,
  },
  rateSubmitDisabled: {
    opacity: 0.6,
  },
  rateSubmitText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
    color: '#FFFFFF',
  },

  // ---- RATING MODAL ----
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  modalCloseBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: FontSize.xl,
    fontFamily: FontFamily.headingBold,
  },
  modalVenueInfo: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
  },
  modalVenueName: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.headingBold,
  },
  modalVenueAddress: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    marginTop: 2,
  },
  modalFormContent: {
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  modalFooter: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
  },

  // ---- REVIEWS ----
  reviewsSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
  },
  reviewsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  reviewsSectionTitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.headingBold,
    color: Colors.text,
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
  noReviews: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl + 8,
    gap: Spacing.sm,
  },
  noReviewsTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  noReviewsSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  reviewCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
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
    color: Colors.text,
  },
  reviewDate: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: 1,
  },
  reviewAvgBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFF8E1',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  reviewAvgText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.headingBold,
    color: Colors.text,
  },
  reviewComment: {
    fontSize: FontSize.sm,
    color: Colors.text,
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
  heroCircleButtonGlass: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  heroCircleButtonInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingCardGlass: {
    borderWidth: 0,
  },
  editorialCardGlass: {
    borderWidth: 0,
  },
});
