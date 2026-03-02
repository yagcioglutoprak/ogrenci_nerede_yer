import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, PriceRanges, VenueLevels } from '../../lib/constants';
import type { Venue } from '../../types';
import StarRating from '../ui/StarRating';
import Badge from '../ui/Badge';

interface VenueCardProps {
  venue: Venue;
  onPress: (venue: Venue) => void;
  style?: StyleProp<ViewStyle>;
}

export default function VenueCard({ venue, onPress, style }: VenueCardProps) {
  const priceLabel = PriceRanges.find((p) => p.value === venue.price_range)?.label ?? '₺';
  const levelInfo = VenueLevels.find((l) => l.level === venue.level);

  return (
    <TouchableOpacity
      style={[styles.card, style]}
      onPress={() => onPress(venue)}
      activeOpacity={0.85}
    >
      {/* Cover Image */}
      <View style={styles.imageContainer}>
        {venue.cover_image_url ? (
          <Image
            source={{ uri: venue.cover_image_url }}
            style={styles.coverImage}
          />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="restaurant-outline" size={36} color={Colors.textLight} />
          </View>
        )}

        {/* Price overlay */}
        <View style={styles.priceOverlay}>
          <Text style={styles.priceText}>{priceLabel}</Text>
        </View>

        {/* Verified overlay */}
        {venue.is_verified && (
          <View style={styles.verifiedOverlay}>
            <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
            <Text style={styles.verifiedText}>Onayli</Text>
          </View>
        )}
      </View>

      {/* Info Section */}
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
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

        {/* Rating Row */}
        <View style={styles.ratingRow}>
          <StarRating rating={venue.overall_rating} size={16} />
          <Text style={styles.ratingValue}>
            {venue.overall_rating.toFixed(1)}
          </Text>
          <Text style={styles.reviewCount}>
            ({venue.total_reviews})
          </Text>
        </View>

        {/* Address */}
        <View style={styles.addressRow}>
          <Ionicons
            name="location-outline"
            size={14}
            color={Colors.textSecondary}
          />
          <Text style={styles.address} numberOfLines={1}>
            {venue.address}
          </Text>
        </View>

        {/* Tags */}
        {venue.tags && venue.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {venue.tags.slice(0, 3).map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
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
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  imageContainer: {
    position: 'relative',
    height: 160,
    backgroundColor: Colors.surfaceElevated,
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
    backgroundColor: Colors.surfaceElevated,
  },
  priceOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  priceText: {
    color: Colors.star,
    fontSize: 13,
    fontWeight: '700',
  },
  verifiedOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.verified,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  verifiedText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  info: {
    padding: 14,
    gap: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  reviewCount: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  address: {
    fontSize: 13,
    color: Colors.textSecondary,
    flex: 1,
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  tag: {
    backgroundColor: Colors.borderLight,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  moreTagsText: {
    fontSize: 11,
    color: Colors.textLight,
    fontWeight: '500',
  },
});
