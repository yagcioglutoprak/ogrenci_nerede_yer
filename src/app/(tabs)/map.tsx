import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
  FlatList,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import GlassView from '../../components/ui/GlassView';
import VenueBottomSheet from '../../components/venue/VenueBottomSheet';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useVenueStore } from '../../stores/venueStore';
import { useDebounce } from '../../hooks/useDebounce';
import { useThemeColors, useIsDarkMode } from '../../hooks/useThemeColors';
import {
  Colors,
  DEFAULT_REGION,
  MapConfig,
  PriceRanges,
  Spacing,
  BorderRadius,
  FontSize,
  FontFamily,
} from '../../lib/constants';
import { MOCK_GOOGLE_PLACES_VENUES } from '../../lib/mockData';
import { haptic } from '../../lib/haptics';
import type { Venue } from '../../types';

// Native marker images — rendered by Apple Maps / Google Maps natively,
// completely bypassing React's view hierarchy (avoids Fabric crash).
// Native marker image — rendered by Apple Maps / Google Maps natively,
// bypassing React's view hierarchy (avoids Fabric AIRMapMarker crash).
const MARKER_LOGO = require('../../../assets/logo-icon.png');

// ── Clustering types ──
interface ClusterGroup {
  id: string;
  latitude: number;
  longitude: number;
  venues: Venue[];
}
type ClusterItem =
  | { type: 'venue'; venue: Venue }
  | { type: 'cluster'; cluster: ClusterGroup };

// ── Grid-based clustering ──

function clusterVenues(venues: Venue[], region: Region): ClusterItem[] {
  // Only cluster non-google_places venues
  const onyVenues = venues.filter((v) => v.source !== 'google_places');
  const googleVenues = venues.filter((v) => v.source === 'google_places');

  const items: ClusterItem[] = [];

  // Google Places venues are never clustered (they're tiny dots)
  for (const v of googleVenues) {
    items.push({ type: 'venue' as const, venue: v });
  }

  if (region.latitudeDelta < MapConfig.CLUSTER_ZOOM_THRESHOLD) {
    for (const v of onyVenues) {
      items.push({ type: 'venue' as const, venue: v });
    }
    return items;
  }

  const cellSize = region.latitudeDelta / 4;
  const buckets = new Map<string, Venue[]>();

  for (const v of onyVenues) {
    const cellX = Math.floor(v.latitude / cellSize);
    const cellY = Math.floor(v.longitude / cellSize);
    const key = `${cellX}_${cellY}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(v);
    } else {
      buckets.set(key, [v]);
    }
  }

  for (const [key, group] of buckets) {
    if (group.length === 1) {
      items.push({ type: 'venue', venue: group[0] });
    } else {
      const lat = group.reduce((s, v) => s + v.latitude, 0) / group.length;
      const lng = group.reduce((s, v) => s + v.longitude, 0) / group.length;
      items.push({
        type: 'cluster',
        cluster: { id: `cluster_${key}`, latitude: lat, longitude: lng, venues: group },
      });
    }
  }
  return items;
}

// 3-tier marker system
type MarkerTier = 'google_places' | 'unreviewed' | 'reviewed';

const getMarkerTier = (venue: Venue): MarkerTier => {
  if (venue.source === 'google_places') return 'google_places';
  if (venue.total_reviews > 0) return 'reviewed';
  return 'unreviewed';
};


export default function MapScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const colors = useThemeColors();
  const isDark = useIsDarkMode();
  const insets = useSafeAreaInsets();

  const { venues, loading, error, fetchVenues, searchVenues, filters, setFilters, clearError } =
    useVenueStore();

  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);

  // Filter state
  const [filterPrice, setFilterPrice] = useState<number[]>([]);
  const [filterMinRating, setFilterMinRating] = useState(0);

  const hasActiveFilters = filterPrice.length > 0 || filterMinRating > 0;

  const debouncedSearch = useDebounce(searchQuery, 300);

  // ── Merge ONY venues with Google Places, filtered to visible region ──
  const visibleVenues = useMemo(() => {
    const all = [...venues, ...MOCK_GOOGLE_PLACES_VENUES];
    const latHalf = region.latitudeDelta / 2 + 0.005; // small buffer
    const lngHalf = region.longitudeDelta / 2 + 0.005;
    return all.filter(
      (v) =>
        v.latitude >= region.latitude - latHalf &&
        v.latitude <= region.latitude + latHalf &&
        v.longitude >= region.longitude - lngHalf &&
        v.longitude <= region.longitude + lngHalf,
    );
  }, [venues, region]);

  // ── Memoized clusters ──
  const clusteredItems = useMemo(
    () => clusterVenues(visibleVenues, region),
    [visibleVenues, region],
  );

  const handleClusterPress = useCallback(
    (cluster: ClusterGroup) => {
      haptic.light();
      // Compute bounding box of cluster venues
      let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
      for (const v of cluster.venues) {
        if (v.latitude < minLat) minLat = v.latitude;
        if (v.latitude > maxLat) maxLat = v.latitude;
        if (v.longitude < minLng) minLng = v.longitude;
        if (v.longitude > maxLng) maxLng = v.longitude;
      }
      const pad = MapConfig.CLUSTER_PADDING;
      mapRef.current?.animateToRegion(
        {
          latitude: (minLat + maxLat) / 2,
          longitude: (minLng + maxLng) / 2,
          latitudeDelta: Math.max(maxLat - minLat + pad, MapConfig.MIN_CLUSTER_DELTA),
          longitudeDelta: Math.max(maxLng - minLng + pad, MapConfig.MIN_CLUSTER_DELTA),
        },
        600,
      );
    },
    [],
  );

  useEffect(() => {
    requestLocationPermission();
    fetchVenues();
  }, []);

  // Debounced search effect
  useEffect(() => {
    if (debouncedSearch.trim()) {
      searchVenues(debouncedSearch);
      setShowSearchResults(true);
    } else {
      setShowSearchResults(false);
    }
  }, [debouncedSearch]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        // Harita her zaman Istanbul'da baslar, konum sadece "beni bul" butonu icin saklanir
      }
    } catch {
      // Konum alinamazsa Istanbul'a fallback
    }
  };

  const handleMarkerPress = (venue: Venue) => {
    haptic.light();
    setSelectedVenue(venue);
    mapRef.current?.animateToRegion(
      {
        latitude: venue.latitude,
        longitude: venue.longitude,
        latitudeDelta: MapConfig.DEFAULT_ZOOM_DELTA,
        longitudeDelta: MapConfig.DEFAULT_ZOOM_DELTA,
      },
      MapConfig.MARKER_ANIMATION_DURATION,
    );
  };

  const handleSelectSearchResult = (venue: Venue) => {
    haptic.selection();
    setSearchQuery(venue.name);
    setShowSearchResults(false);
    mapRef.current?.animateToRegion(
      {
        latitude: venue.latitude,
        longitude: venue.longitude,
        latitudeDelta: MapConfig.DEFAULT_ZOOM_DELTA,
        longitudeDelta: MapConfig.DEFAULT_ZOOM_DELTA,
      },
      800,
    );
  };

  const applyFilters = () => {
    haptic.success();
    setFilters({
      ...filters,
      priceRange: filterPrice.length > 0 ? filterPrice : undefined,
      minRating: filterMinRating > 0 ? filterMinRating : undefined,
    });
    setShowFilters(false);
  };

  const clearFilters = () => {
    haptic.light();
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
        userInterfaceStyle={isDark ? 'dark' : 'light'}
        mapPadding={{ top: insets.top + 60, right: 0, bottom: insets.bottom + 60, left: 0 }}
        onPress={() => {
          if (selectedVenue) setSelectedVenue(null);
        }}
      >
        {clusteredItems.map((item) => {
          if (item.type === 'cluster') {
            const { cluster } = item;
            const count = cluster.venues.length;
            return (
              <React.Fragment key={cluster.id}>
                {/* Logo — tappable, zooms into cluster area */}
                <Marker
                  coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
                  image={MARKER_LOGO}
                  onPress={() => handleClusterPress(cluster)}
                  tracksViewChanges={false}
                  anchor={{ x: 0.5, y: 0.5 }}
                />
                {/* Count label below the logo */}
                <Marker
                  coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
                  tracksViewChanges={false}
                  anchor={{ x: 0.5, y: 0.5 }}
                  centerOffset={{ x: 0, y: 28 }}
                  tappable={false}
                >
                  <View style={styles.clusterCountBadge}>
                    <Text style={styles.clusterCountText}>{count}</Text>
                  </View>
                </Marker>
              </React.Fragment>
            );
          }

          const venue = item.venue;
          const tier = getMarkerTier(venue);

          // ── Tier 1: Google Places — tiny grey dot ──
          if (tier === 'google_places') {
            return (
              <Marker
                key={venue.id}
                coordinate={{ latitude: venue.latitude, longitude: venue.longitude }}
                tracksViewChanges={false}
                onPress={() => handleMarkerPress(venue)}
              >
                <View style={styles.greyDot} />
              </Marker>
            );
          }

          // ── Tier 2: Unreviewed ONY venue — grey tag ──
          if (tier === 'unreviewed') {
            return (
              <Marker
                key={venue.id}
                coordinate={{ latitude: venue.latitude, longitude: venue.longitude }}
                onPress={() => handleMarkerPress(venue)}
                tracksViewChanges={false}
              >
                <View style={styles.tagWrapper}>
                  <View style={[styles.tagUnreviewed, { backgroundColor: colors.tagUnreviewed, borderColor: colors.tagUnreviewedBorder }]}>
                    <Text style={[styles.tagUnreviewedText, { color: colors.textMuted }]} numberOfLines={1}>
                      {venue.name}
                    </Text>
                  </View>
                  <View style={[styles.tagPointer, { borderTopColor: colors.tagUnreviewed }]} />
                </View>
              </Marker>
            );
          }

          // ── Tier 3: Reviewed ONY venue — native logo marker ──
          // `image` prop renders natively, bypassing Fabric AIRMapMarker crash.
          // Tap → zoom to venue + open bottom sheet.
          return (
          <Marker
            key={venue.id}
            coordinate={{
              latitude: venue.latitude,
              longitude: venue.longitude,
            }}
            image={MARKER_LOGO}
            onPress={() => handleMarkerPress(venue)}
            tracksViewChanges={false}
          />
          );
        })}
      </MapView>

      {/* Liquid Glass Search Bar */}
      <SafeAreaView edges={['top']} style={styles.searchBarSafe}>
        <GlassView style={[styles.searchBarBlur, { borderColor: colors.glass.border }]} effect="regular" interactive>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={colors.textTertiary} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Mekan veya semt ara..."
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              selectionColor={Colors.primary}
              accessibilityLabel="Mekan veya semt ara"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setShowSearchResults(false);
                  fetchVenues();
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Aramayi temizle"
                accessibilityRole="button"
              >
                <Ionicons name="close-circle-outline" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
            <View style={[styles.searchDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setShowFilters(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Filtreleri ac"
              accessibilityRole="button"
            >
              <Ionicons
                name={hasActiveFilters ? 'options' : 'options-outline'}
                size={20}
                color={hasActiveFilters ? colors.primary : colors.textSecondary}
              />
              {hasActiveFilters && <View style={styles.filterBadgeDot} />}
            </TouchableOpacity>
          </View>
        </GlassView>

        {/* Search results dropdown */}
        {showSearchResults && debouncedSearch.trim().length > 0 && (
          <GlassView
            style={[styles.searchDropdown, { borderColor: colors.glass.border }]}
            effect="clear"
            fallbackColor={isDark ? 'rgba(30,30,30,0.92)' : 'rgba(255,255,255,0.92)'}
          >
            {venues.length === 0 ? (
              <View style={styles.searchDropdownEmpty}>
                <Text style={[styles.searchDropdownEmptyText, { color: colors.textTertiary }]}>Sonuc bulunamadi</Text>
              </View>
            ) : (
              <FlatList
                data={venues.slice(0, MapConfig.MAX_SEARCH_RESULTS)}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.searchDropdownItem, { borderBottomColor: colors.borderLight }]}
                    onPress={() => handleSelectSearchResult(item)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.searchDropdownIcon, { backgroundColor: colors.primarySoft }]}>
                      <Ionicons name="restaurant-outline" size={14} color={Colors.primary} />
                    </View>
                    <View style={styles.searchDropdownInfo}>
                      <Text style={[styles.searchDropdownName, { color: colors.text }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={[styles.searchDropdownAddr, { color: colors.textSecondary }]} numberOfLines={1}>
                        {item.address}
                      </Text>
                    </View>
                    <View style={styles.searchDropdownRating}>
                      <Ionicons name="star" size={12} color={Colors.star} />
                      <Text style={[styles.searchDropdownRatingText, { color: colors.text }]}>
                        {item.overall_rating.toFixed(1)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </GlassView>
        )}
      </SafeAreaView>

      {/* Error banner — Liquid Glass on iOS */}
      {error && (
        <GlassView
          style={styles.errorBanner}
          fallbackColor={isDark ? colors.glass.background : 'rgba(255,255,255,0.88)'}
        >
          <Ionicons name="alert-circle" size={16} color={Colors.error} />
          <Text style={[styles.errorBannerText, { color: colors.text }]}>{error}</Text>
          <TouchableOpacity onPress={clearError}>
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </GlassView>
      )}

      {/* Loading Indicator — Liquid Glass on iOS */}
      {loading && (
        <GlassView
          style={styles.loadingPill}
          fallbackColor={isDark ? colors.glass.background : 'rgba(255,255,255,0.8)'}
        >
          <ActivityIndicator size="small" color={Colors.primary} />
        </GlassView>
      )}

      {/* Buddy FAB */}
      <TouchableOpacity
        style={[styles.buddyFab, { bottom: Math.max(insets.bottom, 8) + 110 }]}
        onPress={() => router.push('/buddy')}
        activeOpacity={0.8}
        accessibilityLabel="Yemek arkadasi bul"
        accessibilityRole="button"
      >
        <LinearGradient colors={['#06B6D4', '#0891B2']} style={styles.buddyFabGradient}>
          <Ionicons name="people" size={20} color="#FFF" />
        </LinearGradient>
      </TouchableOpacity>

      {/* My Location — Liquid Glass */}
      {userLocation && (
        <GlassView style={[styles.myLocationBlur, { bottom: Math.max(insets.bottom, 8) + 80, borderColor: colors.glass.border }]}>
          <TouchableOpacity
            style={styles.myLocationButton}
            onPress={centerOnUser}
            activeOpacity={0.7}
            accessibilityLabel="Konumuma git"
            accessibilityRole="button"
          >
            <Ionicons name="location" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </GlassView>
      )}

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
          <TouchableOpacity activeOpacity={1} style={[styles.filterSheet, { backgroundColor: colors.background }]}>
            <GlassView style={styles.filterHandleArea} fallbackColor="transparent">
              <View style={[styles.filterHandle, { backgroundColor: colors.border }]} />
            </GlassView>
            <Text style={[styles.filterTitle, { color: colors.text }]}>Filtreler</Text>

            <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
              {/* Price Range */}
              <Text style={[styles.filterSectionTitle, { color: colors.text }]}>Fiyat Araligi</Text>
              <View style={styles.filterChipsRow}>
                {PriceRanges.map((price) => {
                  const isActive = filterPrice.includes(price.value);
                  return (
                    <TouchableOpacity
                      key={price.value}
                      style={[styles.filterChip, isActive && styles.filterChipActive, !isActive && { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                      onPress={() => {
                        setFilterPrice((prev) =>
                          prev.includes(price.value)
                            ? prev.filter((p) => p !== price.value)
                            : [...prev, price.value],
                        );
                      }}
                      activeOpacity={0.7}
                      accessibilityLabel={price.label + ' ' + price.description}
                      accessibilityState={{ selected: isActive }}
                    >
                      <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive, !isActive && { color: colors.text }]}>
                        {price.label}
                      </Text>
                      <Text style={[styles.filterChipDesc, isActive && styles.filterChipDescActive, !isActive && { color: colors.textSecondary }]}>
                        {price.description}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Min Rating */}
              <Text style={[styles.filterSectionTitle, { color: colors.text }]}>Minimum Puan</Text>
              <View style={styles.filterChipsRow}>
                {[0, 2, 3, 3.5, 4, 4.5].map((rating) => {
                  const isActive = filterMinRating === rating;
                  return (
                    <TouchableOpacity
                      key={rating}
                      style={[styles.filterChip, isActive && styles.filterChipActive, !isActive && { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                      onPress={() => setFilterMinRating(rating)}
                      activeOpacity={0.7}
                      accessibilityLabel={rating > 0 ? 'Minimum ' + rating + ' puan' : 'Tum puanlar'}
                      accessibilityState={{ selected: isActive }}
                    >
                      <View style={styles.ratingChipContent}>
                        {rating > 0 ? (
                          <>
                            <Ionicons name="star" size={14} color={isActive ? '#FFFFFF' : Colors.star} />
                            <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive, !isActive && { color: colors.text }]}>
                              {rating}+
                            </Text>
                          </>
                        ) : (
                          <>
                            <Ionicons name="checkmark-circle" size={14} color={isActive ? '#FFFFFF' : colors.textSecondary} />
                            <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive, !isActive && { color: colors.text }]}>
                              Tumu
                            </Text>
                          </>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.filterActions}>
              <TouchableOpacity style={[styles.filterClearButton, { borderColor: colors.border }]} onPress={clearFilters} activeOpacity={0.7} accessibilityLabel="Filtreleri temizle" accessibilityRole="button">
                <Text style={[styles.filterClearText, { color: colors.textSecondary }]}>Temizle</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.filterApplyButton} onPress={applyFilters} activeOpacity={0.85} accessibilityLabel="Filtreleri uygula" accessibilityRole="button">
                <Text style={styles.filterApplyText}>Uygula</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Venue Bottom Sheet */}
      <VenueBottomSheet
        venue={selectedVenue}
        onDismiss={() => setSelectedVenue(null)}
      />
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

  // Search Bar — Liquid Glass
  searchBarSafe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  searchBarBlur: {
    borderRadius: 22,
    borderWidth: 0.5,
    borderColor: Colors.glass.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    height: 44,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.sm + 1,
    color: Colors.text,
    paddingVertical: 0,
    letterSpacing: -0.1,
  },
  searchDivider: {
    width: 0.5,
    height: 20,
    backgroundColor: 'rgba(0,0,0,0.12)',
    marginHorizontal: Spacing.sm,
  },
  filterButton: {
    padding: Spacing.xs,
    position: 'relative',
  },
  filterBadgeDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.primary,
  },

  // Search dropdown — Liquid Glass
  searchDropdown: {
    marginTop: Spacing.sm,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: Colors.glass.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    maxHeight: 250,
  },
  searchDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  searchDropdownIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchDropdownInfo: {
    flex: 1,
  },
  searchDropdownName: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  searchDropdownAddr: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  searchDropdownRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  searchDropdownRatingText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  searchDropdownEmpty: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  searchDropdownEmptyText: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
  },

  // Error banner — Liquid Glass
  errorBanner: {
    position: 'absolute',
    top: 120,
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: 14,
    padding: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.error,
    borderWidth: 0.5,
    borderColor: Colors.glass.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    zIndex: 5,
  },
  errorBannerText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.text,
  },

  // ── Tag markers ──
  tagWrapper: {
    alignItems: 'center',
  },
  // Unreviewed ONY — light grey tag
  tagUnreviewed: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    maxWidth: 140,
    borderWidth: 0.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  tagUnreviewedText: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  // Shared pointer triangle
  tagPointer: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: Colors.primary,
    marginTop: -1,
  },
  // Tier 1: Grey dot (Google Places)
  greyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#9CA3AF',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.8)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  // Loading — Liquid Glass
  loadingPill: {
    position: 'absolute',
    top: 120,
    alignSelf: 'center',
    borderRadius: 20,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderWidth: 0.5,
    borderColor: Colors.glass.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },

  // Buddy FAB
  buddyFab: {
    position: 'absolute',
    right: 16,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  buddyFabGradient: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // My Location — Liquid Glass
  myLocationBlur: {
    position: 'absolute',
    right: Spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 0.5,
    borderColor: Colors.glass.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  myLocationButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Filter Modal
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
  filterHandleArea: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
  },
  filterHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },
  filterTitle: {
    fontSize: FontSize.xl,
    fontFamily: FontFamily.heading,
    color: Colors.text,
    marginBottom: Spacing.xl,
  },
  filterSectionTitle: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
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

  // Filter Actions
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
    fontFamily: FontFamily.headingBold,
    color: '#FFFFFF',
  },

  // Cluster count badge — positioned at top-right of the native logo marker
  clusterCountBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  clusterCountText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.heading,
    fontSize: 11,
    letterSpacing: -0.3,
  },
});
