import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useVenueStore } from '../../stores/venueStore';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily, PriceRanges } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { Venue } from '../../types';

interface VenuePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (venue: {
    venue_id: string;
    venue_name: string;
    venue_cover_url: string | null;
    venue_rating: number;
    venue_price_range: number;
  }) => void;
}

const DEBOUNCE_MS = 300;

export default function VenuePickerModal({ visible, onClose, onSelect }: VenuePickerModalProps) {
  const colors = useThemeColors();
  const venues = useVenueStore((s) => s.venues);
  const fetchVenues = useVenueStore((s) => s.fetchVenues);
  const searchVenues = useVenueStore((s) => s.searchVenues);

  const [query, setQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible && venues.length === 0) {
      fetchVenues();
    }
  }, [visible]);

  const handleSearch = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      if (text.trim()) {
        searchVenues(text.trim());
      } else {
        fetchVenues();
      }
    }, DEBOUNCE_MS);
  }, []);

  const handleSelect = useCallback((venue: Venue) => {
    onSelect({
      venue_id: venue.id,
      venue_name: venue.name,
      venue_cover_url: venue.cover_image_url,
      venue_rating: venue.overall_rating,
      venue_price_range: venue.price_range,
    });
    onClose();
    setQuery('');
  }, [onSelect, onClose]);

  const renderVenueRow = useCallback(({ item, index }: { item: Venue; index: number }) => {
    const priceLabel = PriceRanges.find((p) => p.value === item.price_range)?.label ?? '\u20ba';

    return (
      <Animated.View entering={FadeInDown.delay(Math.min(index * 30, 150)).springify().damping(22).stiffness(340)}>
        <TouchableOpacity
          style={[styles.venueRow, { backgroundColor: colors.background }]}
          onPress={() => handleSelect(item)}
          activeOpacity={0.7}
        >
          {item.cover_image_url ? (
            <Image source={{ uri: item.cover_image_url }} style={styles.venueThumb} />
          ) : (
            <View style={[styles.venueThumbPlaceholder, { backgroundColor: colors.backgroundSecondary }]}>
              <Ionicons name="restaurant-outline" size={20} color={colors.textTertiary} />
            </View>
          )}
          <View style={styles.venueInfo}>
            <Text style={[styles.venueName, { color: colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.venueMetaRow}>
              <Ionicons name="star" size={12} color={Colors.star} />
              <Text style={[styles.venueRating, { color: colors.textSecondary }]}>
                {item.overall_rating.toFixed(1)}
              </Text>
              <Text style={[styles.venuePrice, { color: colors.textTertiary }]}>
                {' \u00b7 '}{priceLabel}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
      </Animated.View>
    );
  }, [colors, handleSelect]);

  const renderSeparator = useCallback(() => (
    <View style={[styles.separator, { backgroundColor: colors.borderLight }]} />
  ), [colors.borderLight]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Mekan Sec</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={[styles.searchContainer, { backgroundColor: colors.backgroundSecondary }]}>
          <Ionicons name="search" size={18} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={query}
            onChangeText={handleSearch}
            placeholder="Mekan ara..."
            placeholderTextColor={colors.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            selectionColor={Colors.primary}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Venue List */}
        <FlatList
          data={venues}
          keyExtractor={(item) => item.id}
          renderItem={renderVenueRow}
          ItemSeparatorComponent={renderSeparator}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="restaurant-outline" size={40} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Mekan bulunamadi
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.headingBold,
  },
  closeButton: {
    position: 'absolute',
    right: Spacing.xl,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.xl,
    marginVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    paddingVertical: Spacing.xs,
  },
  listContent: {
    paddingBottom: Spacing.xxxl * 2,
  },
  venueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: Spacing.lg,
  },
  venueThumb: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
  },
  venueThumbPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  venueInfo: {
    flex: 1,
    gap: 2,
  },
  venueName: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.bodySemiBold,
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
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Spacing.xl + 48 + Spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.xxxl * 3,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
  },
});
