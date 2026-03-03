import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, PriceRanges, VenueLevels } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { Venue } from '../../types';
import StarRating from '../ui/StarRating';
import Badge from '../ui/Badge';
import GlassView from '../ui/GlassView';

interface VenueCardProps {
  venue: Venue;
  onPress: (venue: Venue) => void;
  style?: StyleProp<ViewStyle>;
}

export default function VenueCard({ venue, onPress, style }: VenueCardProps) {
  const colors = useThemeColors();
  const priceLabel = PriceRanges.find((p) => p.value === venue.price_range)?.label ?? '₺';
  const levelInfo = VenueLevels.find((l) => l.level === venue.level);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card }, style]}
      onPress={() => onPress(venue)}
      activeOpacity={0.88}
    >
      {/* Cover Image with 16:10 ratio */}
      <View style={[styles.imageContainer, { backgroundColor: colors.backgroundSecondary }]}>
        {venue.cover_image_url ? (
          <Image
            source={{ uri: venue.cover_image_url }}
            style={styles.coverImage}
          />
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: colors.backgroundSecondary }]}>
            <Ionicons name="restaurant-outline" size={40} color={Colors.textTertiary} />
          </View>
        )}

        {/* Dark gradient overlay at bottom */}
        <LinearGradient
          colors={['transparent', 'rgba(0, 0, 0, 0.45)']}
          style={styles.gradientOverlay}
        />

        {/* Price tag - top-left red pill */}
        {Platform.OS === 'ios' ? (
          <GlassView style={styles.priceTagGlass} fallbackColor="rgba(226, 55, 68, 0.85)" tintColor={Colors.primary}>
            <Text style={styles.priceText}>{priceLabel}</Text>
          </GlassView>
        ) : (
          <View style={styles.priceTag}>
            <Text style={styles.priceText}>{priceLabel}</Text>
          </View>
        )}

        {/* Verified badge - top-right red circle with checkmark */}
        {venue.is_verified && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark" size={14} color={Colors.textOnPrimary} />
          </View>
        )}
      </View>

      {/* Info Section */}
      <View style={styles.info}>
        {/* Name + Level Badge row */}
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {venue.name}
          </Text>
          {levelInfo && levelInfo.level >= 2 && (
            <Badge
              label={levelInfo.name}
              color={levelInfo.color}
              size="sm"
            />
          )}
        </View>

        {/* Address row */}
        <View style={styles.addressRow}>
          <Ionicons
            name="location-outline"
            size={14}
            color={Colors.textSecondary}
          />
          <Text style={[styles.address, { color: colors.textSecondary }]} numberOfLines={1}>
            {venue.address}
          </Text>
        </View>

        {/* Rating row */}
        <View style={styles.ratingRow}>
          <StarRating rating={venue.overall_rating} size="sm" />
          <Text style={[styles.ratingValue, { color: colors.text }]}>
            {venue.overall_rating.toFixed(1)}
          </Text>
          <Text style={[styles.reviewCount, { color: colors.textSecondary }]}>
            ({venue.total_reviews} yorum)
          </Text>
        </View>

        {/* Tags */}
        {venue.tags && venue.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {venue.tags.slice(0, 3).map((tag) => (
              <View key={tag} style={[styles.tagChip, { backgroundColor: colors.backgroundSecondary }]}>
                <Text style={[styles.tagText, { color: colors.textSecondary }]}>{tag}</Text>
              </View>
            ))}
            {venue.tags.length > 3 && (
              <Text style={styles.moreTagsText}>+{venue.tags.length - 3}</Text>
            )}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  imageContainer: {
    position: 'relative',
    aspectRatio: 16 / 10,
    backgroundColor: Colors.backgroundSecondary,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.backgroundSecondary,
  },
  gradientOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
  },
  priceTag: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  priceTagGlass: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.md,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    overflow: 'hidden',
  },
  priceText: {
    color: Colors.textOnPrimary,
    fontSize: FontSize.sm,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  verifiedBadge: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.verified,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  info: {
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
    letterSpacing: -0.2,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  address: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    flex: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  ratingValue: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  reviewCount: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  tagChip: {
    backgroundColor: Colors.backgroundSecondary,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  tagText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  moreTagsText: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
});
