import React from 'react';
import { View, Image, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily, PriceRanges } from '../../lib/constants';
import { useThemeColors, useIsDarkMode } from '../../hooks/useThemeColors';

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
  const isDark = useIsDarkMode();
  const router = useRouter();
  const priceLabel = PriceRanges.find((p) => p.value === venuePriceRange)?.label ?? '\u20ba';

  const cardBg = isOwn
    ? undefined // will use gradient
    : isDark ? colors.surface : colors.backgroundSecondary;

  const cardInner = (
    <>
      {venueCoverUrl ? (
        <Image source={{ uri: venueCoverUrl }} style={styles.coverImage} resizeMode="cover" />
      ) : (
        <View style={[styles.coverPlaceholder, { backgroundColor: isOwn ? 'rgba(0,0,0,0.15)' : colors.border }]}>
          <Ionicons name="restaurant" size={28} color={isOwn ? 'rgba(255,255,255,0.5)' : colors.textTertiary} />
        </View>
      )}
      <View style={styles.cardBody}>
        <Text style={[styles.venueName, { color: isOwn ? '#FFF' : colors.text }]} numberOfLines={1}>
          {venueName}
        </Text>
        <View style={styles.venueMetaRow}>
          <Ionicons name="star" size={12} color={isOwn ? '#FFD700' : Colors.star} />
          <Text style={[styles.venueRating, { color: isOwn ? 'rgba(255,255,255,0.85)' : colors.textSecondary }]}>
            {venueRating.toFixed(1)}
          </Text>
          <Text style={[styles.venuePrice, { color: isOwn ? 'rgba(255,255,255,0.6)' : colors.textTertiary }]}>
            {' · '}{priceLabel}
          </Text>
          <View style={{ flex: 1 }} />
          <View style={styles.viewRow}>
            <Text style={[styles.viewText, { color: isOwn ? 'rgba(255,255,255,0.7)' : Colors.primary }]}>
              Gor
            </Text>
            <Ionicons name="chevron-forward" size={12} color={isOwn ? 'rgba(255,255,255,0.7)' : Colors.primary} />
          </View>
        </View>
      </View>
    </>
  );

  return (
    <View style={[styles.container, isOwn ? styles.ownContainer : styles.otherContainer]}>
      <TouchableOpacity
        onPress={() => router.push(`/venue/${venueId}`)}
        activeOpacity={0.8}
        style={[
          styles.card,
          isOwn ? styles.ownCard : styles.otherCard,
        ]}
      >
        {isOwn ? (
          <LinearGradient
            colors={[Colors.primary, Colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardGradient}
          >
            {cardInner}
          </LinearGradient>
        ) : (
          <View style={[styles.cardFlat, {
            backgroundColor: cardBg,
            borderColor: isDark ? colors.border : 'transparent',
            borderWidth: isDark ? StyleSheet.hairlineWidth : 0,
          }]}>
            {cardInner}
          </View>
        )}
      </TouchableOpacity>
      <View style={[styles.meta, isOwn ? styles.ownMeta : styles.otherMeta]}>
        <Text style={[styles.time, { color: colors.textTertiary }]}>
          {time}
        </Text>
        {isOwn && isRead && (
          <Ionicons name="checkmark-done" size={13} color={colors.textTertiary} style={{ marginLeft: 3 }} />
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
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  ownCard: {
    borderBottomRightRadius: 6,
  },
  otherCard: {
    borderBottomLeftRadius: 6,
  },
  cardGradient: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  cardFlat: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: 120,
  },
  coverPlaceholder: {
    width: '100%',
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    gap: 3,
  },
  venueName: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
    letterSpacing: -0.2,
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
  viewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemiBold,
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
    fontSize: 10,
    fontFamily: FontFamily.body,
    letterSpacing: 0.1,
  },
});
