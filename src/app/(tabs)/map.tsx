import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Callout, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useVenueStore } from '../../stores/venueStore';
import {
  Colors,
  DEFAULT_REGION,
  PriceRanges,
  Spacing,
  BorderRadius,
  FontSize,
} from '../../lib/constants';
import type { Venue } from '../../types';

export default function MapScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);

  const { venues, loading, fetchVenues, filters, setFilters } = useVenueStore();

  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Filter state
  const [filterPrice, setFilterPrice] = useState<number[]>([]);
  const [filterMinRating, setFilterMinRating] = useState(0);

  const hasActiveFilters = filterPrice.length > 0 || filterMinRating > 0;

  useEffect(() => {
    requestLocationPermission();
    fetchVenues();
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const coords = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        setUserLocation(coords);
        setRegion({
          ...coords,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
        mapRef.current?.animateToRegion(
          {
            ...coords,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          },
          1000,
        );
      }
    } catch {
      // Konum alinamazsa Istanbul'a fallback
    }
  };

  const filteredVenues = venues.filter((v) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        v.name.toLowerCase().includes(q) ||
        v.address.toLowerCase().includes(q) ||
        v.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleMarkerPress = (venue: Venue) => {
    mapRef.current?.animateToRegion(
      {
        latitude: venue.latitude,
        longitude: venue.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      500,
    );
  };

  const handleCalloutPress = (venue: Venue) => {
    router.push(`/venue/${venue.id}`);
  };

  const applyFilters = () => {
    setFilters({
      ...filters,
      priceRange: filterPrice.length > 0 ? filterPrice : undefined,
      minRating: filterMinRating > 0 ? filterMinRating : undefined,
    });
    setShowFilters(false);
  };

  const clearFilters = () => {
    setFilterPrice([]);
    setFilterMinRating(0);
    setFilters({});
    setShowFilters(false);
  };

  const centerOnUser = useCallback(() => {
    if (userLocation) {
      mapRef.current?.animateToRegion(
        {
          ...userLocation,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        800,
      );
    }
  }, [userLocation]);

  const getPriceLabel = (priceRange: number) => {
    return PriceRanges.find((p) => p.value === priceRange)?.label ?? '';
  };

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalf = rating - fullStars >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <Ionicons key={i} name="star" size={12} color={Colors.star} />,
        );
      } else if (i === fullStars && hasHalf) {
        stars.push(
          <Ionicons key={i} name="star-half" size={12} color={Colors.star} />,
        );
      } else {
        stars.push(
          <Ionicons
            key={i}
            name="star-outline"
            size={12}
            color={Colors.starEmpty}
          />,
        );
      }
    }
    return stars;
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={DEFAULT_REGION}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        mapPadding={{ top: 100, right: 0, bottom: 80, left: 0 }}
      >
        {filteredVenues.map((venue) => (
          <Marker
            key={venue.id}
            coordinate={{
              latitude: venue.latitude,
              longitude: venue.longitude,
            }}
            onPress={() => handleMarkerPress(venue)}
          >
            {/* Custom Marker */}
            <View style={styles.markerWrapper}>
              <View
                style={[
                  styles.markerCircle,
                  venue.is_verified && styles.markerVerified,
                ]}
              >
                <Ionicons name="restaurant" size={14} color="#FFFFFF" />
              </View>
              <View
                style={[
                  styles.markerArrow,
                  venue.is_verified && styles.markerArrowVerified,
                ]}
              />
            </View>

            {/* Callout */}
            <Callout tooltip onPress={() => handleCalloutPress(venue)}>
              <View style={styles.calloutContainer}>
                <View style={styles.callout}>
                  <Text style={styles.calloutName} numberOfLines={1}>
                    {venue.name}
                  </Text>

                  <View style={styles.calloutRatingRow}>
                    <View style={styles.calloutStars}>
                      {renderStars(venue.overall_rating)}
                    </View>
                    <Text style={styles.calloutRatingText}>
                      {venue.overall_rating.toFixed(1)}
                    </Text>
                  </View>

                  <View style={styles.calloutFooter}>
                    <View style={styles.calloutPriceBadge}>
                      <Text style={styles.calloutPriceText}>
                        {getPriceLabel(venue.price_range)}
                      </Text>
                    </View>
                    <View style={styles.calloutDetailLink}>
                      <Text style={styles.calloutDetailText}>Detaylar</Text>
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color={Colors.primary}
                      />
                    </View>
                  </View>
                </View>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* Floating Search Bar */}
      <SafeAreaView edges={['top']} style={styles.searchBarSafe}>
        <View style={styles.searchBar}>
          <Ionicons
            name="search"
            size={20}
            color={Colors.textTertiary}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Mekan veya semt ara..."
            placeholderTextColor={Colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            selectionColor={Colors.primary}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery('')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={Colors.textTertiary}
              />
            </TouchableOpacity>
          )}
          <View style={styles.searchDivider} />
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilters(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="options-outline"
              size={22}
              color={
                hasActiveFilters ? Colors.primary : Colors.textSecondary
              }
            />
            {hasActiveFilters && <View style={styles.filterBadgeDot} />}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Loading Indicator */}
      {loading && (
        <View style={styles.loadingPill}>
          <ActivityIndicator size="small" color={Colors.primary} />
        </View>
      )}

      {/* My Location Button */}
      {userLocation && (
        <TouchableOpacity
          style={styles.myLocationButton}
          onPress={centerOnUser}
          activeOpacity={0.8}
        >
          <Ionicons name="locate" size={22} color={Colors.primary} />
        </TouchableOpacity>
      )}

      {/* FAB - Mekan Ekle */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(tabs)/add')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={22} color="#FFFFFF" />
        <Text style={styles.fabText}>Mekan Ekle</Text>
      </TouchableOpacity>

      {/* Filter Bottom Sheet Modal */}
      <Modal
        visible={showFilters}
        animationType="slide"
        transparent
        onRequestClose={() => setShowFilters(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowFilters(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.filterSheet}>
            {/* Drag Handle */}
            <View style={styles.filterHandle} />

            <Text style={styles.filterTitle}>Filtreler</Text>

            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {/* Price Range */}
              <Text style={styles.filterSectionTitle}>Fiyat Araligi</Text>
              <View style={styles.filterChipsRow}>
                {PriceRanges.map((price) => {
                  const isActive = filterPrice.includes(price.value);
                  return (
                    <TouchableOpacity
                      key={price.value}
                      style={[
                        styles.filterChip,
                        isActive && styles.filterChipActive,
                      ]}
                      onPress={() => {
                        setFilterPrice((prev) =>
                          prev.includes(price.value)
                            ? prev.filter((p) => p !== price.value)
                            : [...prev, price.value],
                        );
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          isActive && styles.filterChipTextActive,
                        ]}
                      >
                        {price.label}
                      </Text>
                      <Text
                        style={[
                          styles.filterChipDesc,
                          isActive && styles.filterChipDescActive,
                        ]}
                      >
                        {price.description}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Min Rating */}
              <Text style={styles.filterSectionTitle}>Minimum Puan</Text>
              <View style={styles.filterChipsRow}>
                {[0, 2, 3, 3.5, 4, 4.5].map((rating) => {
                  const isActive = filterMinRating === rating;
                  return (
                    <TouchableOpacity
                      key={rating}
                      style={[
                        styles.filterChip,
                        isActive && styles.filterChipActive,
                      ]}
                      onPress={() => setFilterMinRating(rating)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.ratingChipContent}>
                        {rating > 0 ? (
                          <>
                            <Ionicons
                              name="star"
                              size={14}
                              color={isActive ? '#FFFFFF' : Colors.star}
                            />
                            <Text
                              style={[
                                styles.filterChipText,
                                isActive && styles.filterChipTextActive,
                              ]}
                            >
                              {rating}+
                            </Text>
                          </>
                        ) : (
                          <Text
                            style={[
                              styles.filterChipText,
                              isActive && styles.filterChipTextActive,
                            ]}
                          >
                            Hepsi
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.filterActions}>
              <TouchableOpacity
                style={styles.filterClearButton}
                onPress={clearFilters}
                activeOpacity={0.7}
              >
                <Text style={styles.filterClearText}>Temizle</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.filterApplyButton}
                onPress={applyFilters}
                activeOpacity={0.85}
              >
                <Text style={styles.filterApplyText}>Uygula</Text>
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
  },
  map: {
    flex: 1,
  },

  // ── Floating Search Bar ──────────────────────────────────────
  searchBarSafe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    height: 52,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  searchIcon: {
    marginRight: Spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
    paddingVertical: 0,
  },
  searchDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.borderLight,
    marginHorizontal: Spacing.md,
  },
  filterButton: {
    padding: Spacing.xs,
    position: 'relative',
  },
  filterBadgeDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    borderWidth: 1.5,
    borderColor: Colors.background,
  },

  // ── Custom Map Markers ───────────────────────────────────────
  markerWrapper: {
    alignItems: 'center',
  },
  markerCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  markerVerified: {
    backgroundColor: Colors.star,
  },
  markerArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: Colors.primary,
    marginTop: -1,
  },
  markerArrowVerified: {
    borderTopColor: Colors.star,
  },

  // ── Callout ──────────────────────────────────────────────────
  calloutContainer: {
    minWidth: 180,
    maxWidth: 240,
  },
  callout: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
  },
  calloutName: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  calloutRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  calloutStars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  calloutRatingText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: Spacing.xs,
  },
  calloutFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calloutPriceBadge: {
    backgroundColor: Colors.primarySoft,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  calloutPriceText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primary,
  },
  calloutDetailLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  calloutDetailText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
  },

  // ── Loading ──────────────────────────────────────────────────
  loadingPill: {
    position: 'absolute',
    top: 120,
    alignSelf: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },

  // ── My Location Button ───────────────────────────────────────
  myLocationButton: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: 100,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },

  // ── FAB ──────────────────────────────────────────────────────
  fab: {
    position: 'absolute',
    left: Spacing.lg,
    bottom: Spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.xxl,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md + 2,
    gap: Spacing.sm,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: FontSize.md,
    fontWeight: '700',
  },

  // ── Filter Modal ─────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end',
  },
  filterSheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.xxl,
    paddingTop: Spacing.md,
    maxHeight: '70%',
  },
  filterHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },
  filterTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.xl,
  },
  filterSectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  filterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  filterChip: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    backgroundColor: Colors.backgroundSecondary,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: FontSize.sm + 1,
    fontWeight: '600',
    color: Colors.text,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  filterChipDesc: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  filterChipDescActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  ratingChipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },

  // ── Filter Actions ───────────────────────────────────────────
  filterActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xxl,
  },
  filterClearButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterClearText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterApplyButton: {
    flex: 2,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md + 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  filterApplyText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
