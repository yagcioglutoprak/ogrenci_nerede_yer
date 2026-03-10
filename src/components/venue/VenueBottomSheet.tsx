import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Platform,
} from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontSize,
  FontFamily,
  PriceRanges,
} from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';
import RatingBar from '../ui/RatingBar';
import { haptic } from '../../lib/haptics';
import type { Venue } from '../../types';

interface VenueBottomSheetProps {
  venue: Venue | null;
  onDismiss: () => void;
}

export default function VenueBottomSheet({ venue, onDismiss }: VenueBottomSheetProps) {
  const router = useRouter();
  const colors = useThemeColors();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['42%'], []);

  // Open/close sheet based on venue
  useEffect(() => {
    if (venue) {
      bottomSheetRef.current?.snapToIndex(0);
    } else {
      bottomSheetRef.current?.close();
    }
  }, [venue]);

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1) {
        onDismiss();
      }
    },
    [onDismiss],
  );

  const handleSwipeUp = useCallback(() => {
    if (!venue) return;
    haptic.light();
    bottomSheetRef.current?.close();
    router.push(`/venue/${venue.id}`);
  }, [venue, router]);

  const handleDirections = useCallback(() => {
    if (!venue) return;
    haptic.light();
    const url = Platform.select({
      ios: `maps:?daddr=${venue.latitude},${venue.longitude}`,
      android: `google.navigation:q=${venue.latitude},${venue.longitude}`,
    });
    if (url) Linking.openURL(url);
  }, [venue]);

  const handleRate = useCallback(() => {
    if (!venue) return;
    haptic.light();
    bottomSheetRef.current?.close();
    router.push(`/venue/${venue.id}?rate=true`);
  }, [venue, router]);

  const handleSave = useCallback(() => {
    if (!venue) return;
    haptic.light();
    bottomSheetRef.current?.close();
    router.push(`/venue/${venue.id}`);
  }, [venue, router]);

  const priceLabel = venue
    ? PriceRanges.find((p) => p.value === venue.price_range)?.label ?? '₺'
    : '';

  // Determine tier
  const tier: 'google_places' | 'unreviewed' | 'reviewed' = (() => {
    if (!venue) return 'reviewed';
    if (venue.source === 'google_places') return 'google_places';
    if (venue.total_reviews > 0) return 'reviewed';
    return 'unreviewed';
  })();

  if (!venue) return null;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      enableOverDrag
      onChange={handleSheetChange}
      handleIndicatorStyle={styles.handleIndicator}
      backgroundStyle={[styles.sheetBackground, { backgroundColor: colors.background }]}
      style={styles.sheet}
    >
      <BottomSheetView style={styles.content}>
        {/* Close button */}
        <TouchableOpacity
          style={[styles.closeButton, { backgroundColor: colors.backgroundSecondary }]}
          onPress={() => {
            bottomSheetRef.current?.close();
            onDismiss();
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* ── Tier 3: Reviewed ONY Venue ── */}
        {tier === 'reviewed' && (
          <>
            <View style={styles.venueRow}>
              <View style={[styles.thumbnail, { backgroundColor: colors.backgroundSecondary }]}>
                {venue.cover_image_url ? (
                  <Image source={{ uri: venue.cover_image_url }} style={styles.thumbnailImage} />
                ) : (
                  <Ionicons name="restaurant" size={28} color={colors.textTertiary} />
                )}
              </View>
              <View style={styles.venueInfo}>
                <Text style={[styles.venueName, { color: colors.text }]} numberOfLines={1}>
                  {venue.name}
                </Text>
                <Text style={[styles.venueAddress, { color: colors.textSecondary }]} numberOfLines={1}>
                  {venue.address}
                </Text>
                <View style={styles.ratingsRow}>
                  {venue.editorial_rating != null && (
                    <View style={[styles.onyBadge, { backgroundColor: Colors.primary }]}>
                      <Text style={styles.onyBadgeText}>{venue.editorial_rating.toFixed(1)}</Text>
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
              </View>
            </View>
            <View style={styles.actionsRow}>
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnRate]} onPress={handleRate} activeOpacity={0.8}>
                <Ionicons name="star-outline" size={16} color="#FFF" />
                <Text style={styles.actionBtnRateText}>Puan Ver</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDirections]} onPress={handleDirections} activeOpacity={0.8}>
                <Ionicons name="navigate-outline" size={16} color="#FFF" />
                <Text style={styles.actionBtnDirectionsText}>Yol Tarifi</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSave, { borderColor: colors.border }]} onPress={handleSave} activeOpacity={0.8}>
                <Ionicons name="heart-outline" size={16} color={colors.text} />
                <Text style={[styles.actionBtnSaveText, { color: colors.text }]}>Kaydet</Text>
              </TouchableOpacity>
            </View>
            {/* Swipe up hint */}
            <TouchableOpacity style={styles.detailHint} onPress={handleSwipeUp} activeOpacity={0.7}>
              <Text style={[styles.detailHintText, { color: Colors.primary }]}>Detaylari Gor</Text>
              <Ionicons name="chevron-up" size={16} color={Colors.primary} />
            </TouchableOpacity>
          </>
        )}

        {/* ── Tier 2: Unreviewed ONY Venue ── */}
        {tier === 'unreviewed' && (
          <>
            <View style={styles.venueRow}>
              <View style={[styles.thumbnail, { backgroundColor: colors.backgroundSecondary }]}>
                <Ionicons name="restaurant-outline" size={28} color={colors.textTertiary} />
              </View>
              <View style={styles.venueInfo}>
                <Text style={[styles.venueName, { color: colors.text }]} numberOfLines={1}>
                  {venue.name}
                </Text>
                <Text style={[styles.venueAddress, { color: colors.textSecondary }]} numberOfLines={1}>
                  {venue.address}
                </Text>
                <Text style={[styles.noReviewsText, { color: colors.textTertiary }]}>
                  Henuz degerlendirme yok
                </Text>
              </View>
            </View>
            <View style={styles.actionsRow}>
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnRate]} onPress={handleRate} activeOpacity={0.8}>
                <Ionicons name="star-outline" size={16} color="#FFF" />
                <Text style={styles.actionBtnRateText}>Degerlendir</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDirections]} onPress={handleDirections} activeOpacity={0.8}>
                <Ionicons name="navigate-outline" size={16} color="#FFF" />
                <Text style={styles.actionBtnDirectionsText}>Yol Tarifi</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSave, { borderColor: colors.border }]} onPress={handleSave} activeOpacity={0.8}>
                <Ionicons name="heart-outline" size={16} color={colors.text} />
                <Text style={[styles.actionBtnSaveText, { color: colors.text }]}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── Tier 1: Google Places ── */}
        {tier === 'google_places' && (
          <>
            <View style={styles.venueRow}>
              <View style={[styles.thumbnail, styles.thumbnailGoogle, { backgroundColor: colors.backgroundSecondary }]}>
                <Ionicons name="location" size={24} color="#9CA3AF" />
              </View>
              <View style={styles.venueInfo}>
                <Text style={[styles.venueName, { color: colors.text }]} numberOfLines={1}>
                  {venue.name}
                </Text>
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
              </View>
            </View>
            <View style={styles.actionsRow}>
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnRate]} onPress={handleRate} activeOpacity={0.8}>
                <Ionicons name="add-circle-outline" size={16} color="#FFF" />
                <Text style={styles.actionBtnRateText}>Degerlendir</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDirections]} onPress={handleDirections} activeOpacity={0.8}>
                <Ionicons name="navigate-outline" size={16} color="#FFF" />
                <Text style={styles.actionBtnDirectionsText}>Yol Tarifi</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  sheetBackground: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handleIndicator: {
    backgroundColor: '#D1D5DB',
    width: 40,
    height: 4,
  },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  closeButton: {
    position: 'absolute',
    top: -4,
    right: Spacing.xl,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  venueRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  thumbnailGoogle: {
    borderRadius: BorderRadius.full,
    width: 52,
    height: 52,
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
  onyBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  onyBadgeText: {
    color: '#FFF',
    fontSize: FontSize.xs + 1,
    fontFamily: FontFamily.headingBold,
  },
  priceText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodySemiBold,
  },
  noReviewsText: {
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
    marginTop: Spacing.lg,
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
  actionBtnRateText: {
    color: '#FFF',
    fontSize: FontSize.sm,
    fontFamily: FontFamily.headingBold,
  },
  actionBtnDirections: {
    backgroundColor: '#06B6D4',
  },
  actionBtnDirectionsText: {
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
});
