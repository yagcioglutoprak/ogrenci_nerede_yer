import React from 'react';
import { View, Image, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily, PriceRanges } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';

interface VenueBubbleProps {
  venueId: string;
  venueName: string;
  venueCoverUrl: string | null;
  venueRating: number;
  venuePriceRange: number;
  isOwn: boolean;
  time: string;
  isRead?: boolean;
}

export default function VenueBubble({
  venueId,
  venueName,
  venueCoverUrl,
  venueRating,
  venuePriceRange,
  isOwn,
  time,
  isRead,
}: VenueBubbleProps) {
  const colors = useThemeColors();
  const router = useRouter();
  const priceLabel = PriceRanges.find((p) => p.value === venuePriceRange)?.label ?? '\u20ba';

  return (
    <View style={[styles.container, isOwn ? styles.ownContainer : styles.otherContainer]}>
      <TouchableOpacity
        style={[styles.card, { backgroundColor: isOwn ? Colors.primary : colors.backgroundSecondary }]}
        onPress={() => router.push(`/venue/${venueId}`)}
        activeOpacity={0.8}
      >
        {venueCoverUrl ? (
          <Image source={{ uri: venueCoverUrl }} style={styles.coverImage} resizeMode="cover" />
        ) : (
          <View style={[styles.coverPlaceholder, { backgroundColor: isOwn ? Colors.primaryDark : colors.border }]}>
            <Ionicons name="restaurant" size={28} color={isOwn ? 'rgba(255,255,255,0.5)' : colors.textTertiary} />
          </View>
        )}
        <View style={styles.cardBody}>
          <Text style={[styles.venueName, { color: isOwn ? '#FFF' : colors.text }]} numberOfLines={1}>
            {venueName}
          </Text>
          <View style={styles.venueMetaRow}>
            <Ionicons name="star" size={12} color={isOwn ? '#FFD700' : Colors.star} />
            <Text style={[styles.venueRating, { color: isOwn ? 'rgba(255,255,255,0.8)' : colors.textSecondary }]}>
              {venueRating.toFixed(1)}
            </Text>
            <Text style={[styles.venuePrice, { color: isOwn ? 'rgba(255,255,255,0.6)' : colors.textTertiary }]}>
              {' \u00b7 '}{priceLabel}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
      <View style={[styles.meta, isOwn ? styles.ownMeta : styles.otherMeta]}>
        <Text style={[styles.time, { color: colors.textTertiary }]}>
          {time}
        </Text>
        {isOwn && isRead && (
          <Ionicons name="checkmark-done" size={14} color={colors.textTertiary} style={{ marginLeft: Spacing.xs }} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    maxWidth: '78%',
    marginBottom: Spacing.sm,
  },
  ownContainer: {
    alignSelf: 'flex-end',
  },
  otherContainer: {
    alignSelf: 'flex-start',
  },
  card: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: 120,
  },
  coverPlaceholder: {
    width: '100%',
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: 2,
  },
  venueName: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
  },
  venueMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  venueRating: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemiBold,
  },
  venuePrice: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  ownMeta: {
    justifyContent: 'flex-end',
  },
  otherMeta: {
    justifyContent: 'flex-start',
  },
  time: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
  },
});
