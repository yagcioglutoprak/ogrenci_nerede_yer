import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  FlatList,
  Modal,
  Alert,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVenueStore } from '../../stores/venueStore';
import { useAuthStore } from '../../stores/authStore';
import { Colors, PriceRanges, VenueLevels, RatingCategories } from '../../lib/constants';
import StarRating from '../../components/ui/StarRating';
import Badge from '../../components/ui/Badge';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import type { Review } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = 280;

export default function VenueDetailScreen() {
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

  const [isFavorited, setIsFavorited] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
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

  const handleFavorite = async () => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    if (!venue) return;
    setIsFavorited((prev) => !prev);
    await toggleFavorite(venue.id, user.id);
  };

  const handleSubmitReview = async () => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    if (!venue) return;
    if (ratingTaste === 0 || ratingValue === 0 || ratingFriendliness === 0) {
      Alert.alert('Hata', 'Lutfen tum kategorileri puanlayin.');
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
      Alert.alert('Tesekkurler!', 'Degerlendirmeniz kaydedildi.');
      setShowRatingModal(false);
      setRatingTaste(0);
      setRatingValue(0);
      setRatingFriendliness(0);
      setRatingComment('');
      fetchVenueById(venue.id);
    }
  };

  const openYouTube = () => {
    if (venue?.youtube_video_url) {
      Linking.openURL(venue.youtube_video_url);
    }
  };

  if (loading || !venue) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const priceLabel = PriceRanges.find((p) => p.value === venue.price_range)?.label ?? '';
  const priceDesc = PriceRanges.find((p) => p.value === venue.price_range)?.description ?? '';
  const levelInfo = VenueLevels.find((l) => l.level === venue.level);

  const ratingBarWidth = (rating: number) => `${(rating / 5) * 100}%`;

  const renderReviewItem = ({ item }: { item: Review }) => (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <Avatar
          uri={item.user?.avatar_url}
          name={item.user?.full_name ?? item.user?.username ?? '?'}
          size={36}
        />
        <View style={styles.reviewHeaderText}>
          <Text style={styles.reviewUsername}>{item.user?.username ?? 'Anonim'}</Text>
          <Text style={styles.reviewDate}>
            {new Date(item.created_at).toLocaleDateString('tr-TR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </Text>
        </View>
        <View style={styles.reviewOverall}>
          <Ionicons name="star" size={14} color={Colors.star} />
          <Text style={styles.reviewOverallText}>
            {((item.taste_rating + item.value_rating + item.friendliness_rating) / 3).toFixed(1)}
          </Text>
        </View>
      </View>
      {item.comment ? (
        <Text style={styles.reviewComment}>{item.comment}</Text>
      ) : null}
      <View style={styles.reviewRatings}>
        <Text style={styles.reviewRatingItem}>Lezzet: {item.taste_rating}/5</Text>
        <Text style={styles.reviewRatingDot}>-</Text>
        <Text style={styles.reviewRatingItem}>F/P: {item.value_rating}/5</Text>
        <Text style={styles.reviewRatingDot}>-</Text>
        <Text style={styles.reviewRatingItem}>Ogrenci: {item.friendliness_rating}/5</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
        {/* Hero Image */}
        <View style={styles.heroContainer}>
          {venue.cover_image_url ? (
            <Image source={{ uri: venue.cover_image_url }} style={styles.heroImage} />
          ) : (
            <View style={[styles.heroImage, styles.heroPlaceholder]}>
              <Ionicons name="restaurant-outline" size={64} color={Colors.textLight} />
            </View>
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            style={styles.heroGradient}
          />

          {/* Back & Favorite buttons */}
          <SafeAreaView edges={['top']} style={styles.heroTopBar}>
            <TouchableOpacity style={styles.heroButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.heroButton} onPress={handleFavorite}>
              <Ionicons
                name={isFavorited ? 'heart' : 'heart-outline'}
                size={24}
                color={isFavorited ? Colors.error : '#FFFFFF'}
              />
            </TouchableOpacity>
          </SafeAreaView>

          {/* Hero Text */}
          <View style={styles.heroTextContainer}>
            <View style={styles.heroNameRow}>
              <Text style={styles.heroName} numberOfLines={2}>{venue.name}</Text>
              {venue.is_verified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                </View>
              )}
            </View>
            {levelInfo && (
              <Badge
                label={levelInfo.name}
                color={levelInfo.color}
                icon="shield-checkmark"
                size="md"
              />
            )}
          </View>
        </View>

        {/* Ratings Section */}
        <View style={styles.ratingsSection}>
          <View style={styles.overallRatingRow}>
            <Text style={styles.overallRatingValue}>{venue.overall_rating.toFixed(1)}</Text>
            <View style={styles.overallRatingStars}>
              <StarRating rating={venue.overall_rating} size={22} />
              <Text style={styles.totalReviewsText}>
                {venue.total_reviews} degerlendirme
              </Text>
            </View>
          </View>

          {/* Sub-ratings */}
          {[
            { label: 'Lezzet', value: venue.avg_taste_rating, icon: 'restaurant' as const },
            { label: 'Fiyat/Performans', value: venue.avg_value_rating, icon: 'pricetag' as const },
            { label: 'Ogrenci Dostu', value: venue.avg_friendliness_rating, icon: 'people' as const },
          ].map((cat) => (
            <View key={cat.label} style={styles.subRatingRow}>
              <View style={styles.subRatingLabel}>
                <Ionicons name={cat.icon} size={16} color={Colors.textSecondary} />
                <Text style={styles.subRatingLabelText}>{cat.label}</Text>
              </View>
              <View style={styles.subRatingBar}>
                <View
                  style={[
                    styles.subRatingBarFill,
                    { width: ratingBarWidth(cat.value) as any },
                  ]}
                />
              </View>
              <Text style={styles.subRatingValue}>{cat.value.toFixed(1)}</Text>
            </View>
          ))}
        </View>

        {/* YouTube Link */}
        {venue.youtube_video_url && (
          <TouchableOpacity style={styles.youtubeButton} onPress={openYouTube} activeOpacity={0.8}>
            <Ionicons name="logo-youtube" size={24} color="#FF0000" />
            <Text style={styles.youtubeText}>YouTube Incelemesini Izle</Text>
            <Ionicons name="open-outline" size={18} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}

        {/* Info Section */}
        <View style={styles.infoSection}>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={20} color={Colors.primary} />
            <Text style={styles.infoText}>{venue.address}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="pricetag-outline" size={20} color={Colors.primary} />
            <Text style={styles.infoText}>{priceLabel} ({priceDesc})</Text>
          </View>
          {venue.phone && (
            <View style={styles.infoRow}>
              <Ionicons name="call-outline" size={20} color={Colors.primary} />
              <Text style={styles.infoText}>{venue.phone}</Text>
            </View>
          )}
        </View>

        {/* Tags */}
        {venue.tags && venue.tags.length > 0 && (
          <View style={styles.tagsSection}>
            {venue.tags.map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Rate Button */}
        <View style={styles.rateButtonContainer}>
          <Button
            title="Puan Ver"
            onPress={() => {
              if (!user) {
                router.push('/auth/login');
                return;
              }
              setShowRatingModal(true);
            }}
            icon="star-outline"
            variant="secondary"
          />
        </View>

        {/* Reviews */}
        <View style={styles.reviewsSection}>
          <Text style={styles.reviewsSectionTitle}>
            Degerlendirmeler ({reviews.length})
          </Text>
          {reviews.length === 0 ? (
            <View style={styles.noReviews}>
              <Ionicons name="chatbubbles-outline" size={40} color={Colors.borderLight} />
              <Text style={styles.noReviewsText}>Henuz degerlendirme yok</Text>
              <Text style={styles.noReviewsSubtext}>Ilk degerlendirmeyi sen yap!</Text>
            </View>
          ) : (
            reviews.map((review) => (
              <View key={review.id}>
                {renderReviewItem({ item: review })}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Rating Modal */}
      <Modal
        visible={showRatingModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowRatingModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowRatingModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.ratingSheet}>
            <View style={styles.ratingHandle} />
            <Text style={styles.ratingSheetTitle}>Degerlendirme</Text>
            <Text style={styles.ratingSheetSubtitle}>{venue.name}</Text>

            {/* Taste */}
            <View style={styles.ratingCategoryRow}>
              <View style={styles.ratingCategoryLabel}>
                <Ionicons name="restaurant" size={18} color={Colors.primary} />
                <Text style={styles.ratingCategoryText}>Lezzet</Text>
              </View>
              <StarRating
                rating={ratingTaste}
                interactive
                onRatingChange={setRatingTaste}
                size={30}
              />
            </View>

            {/* Value */}
            <View style={styles.ratingCategoryRow}>
              <View style={styles.ratingCategoryLabel}>
                <Ionicons name="pricetag" size={18} color={Colors.secondary} />
                <Text style={styles.ratingCategoryText}>Fiyat/Performans</Text>
              </View>
              <StarRating
                rating={ratingValue}
                interactive
                onRatingChange={setRatingValue}
                size={30}
              />
            </View>

            {/* Friendliness */}
            <View style={styles.ratingCategoryRow}>
              <View style={styles.ratingCategoryLabel}>
                <Ionicons name="people" size={18} color={Colors.verified} />
                <Text style={styles.ratingCategoryText}>Ogrenci Dostu</Text>
              </View>
              <StarRating
                rating={ratingFriendliness}
                interactive
                onRatingChange={setRatingFriendliness}
                size={30}
              />
            </View>

            {/* Comment */}
            <View style={styles.ratingCommentContainer}>
              <Text style={styles.ratingCommentLabel}>Yorum (Opsiyonel)</Text>
              <View style={styles.ratingCommentInput}>
                <Text
                  style={styles.ratingCommentPlaceholder}
                  // Using a Text as a placeholder display since we need a TextInput
                >
                  {ratingComment || 'Deneyimini paylas...'}
                </Text>
              </View>
            </View>

            <View style={styles.ratingActions}>
              <TouchableOpacity
                style={styles.ratingCancelButton}
                onPress={() => setShowRatingModal(false)}
              >
                <Text style={styles.ratingCancelText}>Iptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.ratingSubmitButton,
                  submittingReview && styles.ratingSubmitButtonDisabled,
                ]}
                onPress={handleSubmitReview}
                disabled={submittingReview}
              >
                {submittingReview ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.ratingSubmitText}>Gonder</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  // Hero
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
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: HERO_HEIGHT * 0.6,
  },
  heroTopBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  heroButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTextContainer: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    gap: 8,
  },
  heroNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    flex: 1,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  verifiedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.verified,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Ratings
  ratingsSection: {
    backgroundColor: Colors.surface,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  overallRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  overallRatingValue: {
    fontSize: 44,
    fontWeight: '800',
    color: Colors.text,
  },
  overallRatingStars: {
    gap: 4,
  },
  totalReviewsText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  subRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  subRatingLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 140,
  },
  subRatingLabelText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  subRatingBar: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.borderLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  subRatingBarFill: {
    height: '100%',
    backgroundColor: Colors.star,
    borderRadius: 4,
  },
  subRatingValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    width: 30,
    textAlign: 'right',
  },
  // YouTube
  youtubeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  youtubeText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  // Info
  infoSection: {
    backgroundColor: Colors.surface,
    marginTop: 8,
    padding: 16,
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoText: {
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
  // Tags
  tagsSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 16,
    backgroundColor: Colors.surface,
    marginTop: 1,
  },
  tag: {
    backgroundColor: Colors.borderLight,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tagText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  // Rate Button
  rateButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  // Reviews
  reviewsSection: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  reviewsSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 16,
  },
  noReviews: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  noReviewsText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  noReviewsSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  reviewCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  reviewHeaderText: {
    flex: 1,
  },
  reviewUsername: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  reviewDate: {
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 1,
  },
  reviewOverall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.borderLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  reviewOverallText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  reviewComment: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
    marginBottom: 8,
  },
  reviewRatings: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reviewRatingItem: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  reviewRatingDot: {
    fontSize: 12,
    color: Colors.textLight,
  },
  // Rating Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  ratingSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 12,
  },
  ratingHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderLight,
    alignSelf: 'center',
    marginBottom: 16,
  },
  ratingSheetTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  ratingSheetSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  ratingCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  ratingCategoryLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingCategoryText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  ratingCommentContainer: {
    marginTop: 16,
  },
  ratingCommentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  ratingCommentInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 12,
    minHeight: 80,
  },
  ratingCommentPlaceholder: {
    fontSize: 14,
    color: Colors.textLight,
  },
  ratingActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  ratingCancelButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ratingCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  ratingSubmitButton: {
    flex: 2,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ratingSubmitButtonDisabled: {
    opacity: 0.6,
  },
  ratingSubmitText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
