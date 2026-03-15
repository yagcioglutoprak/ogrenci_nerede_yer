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
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import GlassView from '../../components/ui/GlassView';
import { GlassBar, GlassContainer } from '../../components/glass';
import VenueBottomSheet from '../../components/venue/VenueBottomSheet';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useVenueStore } from '../../stores/venueStore';
import { useAuthStore } from '../../stores/authStore';
import { useDebounce } from '../../hooks/useDebounce';
import { useThemeColors, useIsDarkMode } from '../../hooks/useThemeColors';
import { supabase } from '../../lib/supabase';
import {
  Colors,
  DEFAULT_REGION,
  FeatureColors,
  MapConfig,
  PriceRanges,
  Spacing,
  BorderRadius,
  FontSize,
  FontFamily,
  SpringConfig,
} from '../../lib/constants';
import { haptic } from '../../lib/haptics';
import ReAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import type { Venue } from '../../types';

// Native marker images — rendered by Apple Maps / Google Maps natively,
// completely bypassing React's view hierarchy (avoids Fabric crash).
// Native marker image — rendered by Apple Maps / Google Maps natively,
// bypassing React's view hierarchy (avoids Fabric AIRMapMarker crash).
const MARKER_LOGO = require('../../../assets/logo-icon.png');
const SCRAPED_PIN = require('../../../assets/scraped-pin.png');
const SCRAPED_PIN_SELECTED = require('../../../assets/scraped-pin-selected.png');

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

function clusterVenues(venues: Venue[], cellSize: number): ClusterItem[] {
  const items: ClusterItem[] = [];

  // ONY (reviewed) venues are NEVER clustered — always visible individually
  const onyVenues = venues.filter((v) => v.source !== 'scraped');
  const scrapedVenues = venues.filter((v) => v.source === 'scraped');

  for (const v of onyVenues) {
    items.push({ type: 'venue' as const, venue: v });
  }

  // Scraped venues: show individually only when zoomed in enough
  if (cellSize <= 0) {
    for (const v of scrapedVenues) {
      items.push({ type: 'venue' as const, venue: v });
    }
    return items;
  }

  // Cluster scraped venues using a fixed grid (stable across pans)
  const buckets = new Map<string, Venue[]>();

  for (const v of scrapedVenues) {
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
    if (group.length <= 4) {
      for (const v of group) {
        items.push({ type: 'venue', venue: v });
      }
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
type MarkerTier = 'scraped' | 'unreviewed' | 'reviewed';

const getMarkerTier = (venue: Venue): MarkerTier => {
  if (venue.source === 'scraped') return 'scraped';
  if (venue.total_reviews > 0) return 'reviewed';
  return 'unreviewed';
};


// Subtle spring-in animation when a marker becomes selected
function SelectedPop({ children }: { children: React.ReactNode }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withSequence(
      withTiming(1.15, { duration: 100 }),
      withSpring(1, SpringConfig.bouncy),
    );
  }, []);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <ReAnimated.View style={animStyle}>
      {children}
    </ReAnimated.View>
  );
}

export default function MapScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const colors = useThemeColors();
  const isDark = useIsDarkMode();
  const insets = useSafeAreaInsets();

  const venues = useVenueStore((s) => s.venues);
  const loading = useVenueStore((s) => s.loading);
  const error = useVenueStore((s) => s.error);
  const fetchVenues = useVenueStore((s) => s.fetchVenues);
  const filters = useVenueStore((s) => s.filters);
  const setFilters = useVenueStore((s) => s.setFilters);
  const clearError = useVenueStore((s) => s.clearError);
  const nearbyScrapedVenues = useVenueStore((s) => s.nearbyScrapedVenues);
  const nearbyScrapedCount = useVenueStore((s) => s.nearbyScrapedCount);
  const fetchNearbyScraped = useVenueStore((s) => s.fetchNearbyScraped);
  const countNearbyScraped = useVenueStore((s) => s.countNearbyScraped);

  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const authUser = useAuthStore((s) => s.user);
  const initialRegion = useMemo(() => {
    if (authUser?.school_lat && authUser?.school_lng) {
      return {
        latitude: authUser.school_lat,
        longitude: authUser.school_lng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
    }
    return DEFAULT_REGION;
  }, [authUser?.school_lat, authUser?.school_lng]);
  const [region, setRegion] = useState<Region>(initialRegion);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const markerPressedRef = useRef(false);

  // Debounce region for fetches only
  const debouncedRegion = useDebounce(region, 500);

  // Zoom thresholds (instant from current region state)
  const isDistrictZoom = region.latitudeDelta < 0.08;
  const isNeighborhoodZoom = region.latitudeDelta < 0.05;

  // Unified search results (Supabase combined)
  const [searchResults, setSearchResults] = useState<Venue[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Filter state
  const [filterPrice, setFilterPrice] = useState<number[]>([]);
  const [filterMinRating, setFilterMinRating] = useState(0);

  const hasActiveFilters = filterPrice.length > 0 || filterMinRating > 0;

  const debouncedSearch = useDebounce(searchQuery, 300);

  // ── Merge ONY venues with scraped venues (only when zoomed in), deduplicated ──
  // Scraped venues are viewport-filtered (2x buffer) so stale pins from a
  // previous fetch don't linger on the edge after a big pan.
  const visibleVenues = useMemo(() => {
    if (!isNeighborhoodZoom) return [...venues];
    const bufLat = region.latitudeDelta;
    const bufLng = region.longitudeDelta;
    const scrapedToShow = nearbyScrapedVenues.filter(
      (v) =>
        v.latitude >= region.latitude - bufLat &&
        v.latitude <= region.latitude + bufLat &&
        v.longitude >= region.longitude - bufLng &&
        v.longitude <= region.longitude + bufLng,
    );
    const seen = new Set(venues.map((v) => v.id));
    const uniqueScraped = scrapedToShow.filter((v) => !seen.has(v.id));
    return [...venues, ...uniqueScraped];
  }, [venues, nearbyScrapedVenues, isNeighborhoodZoom, region]);

  // ── Stable cell size: quantized to powers of 2 so the grid doesn't shift
  // on every tiny zoom change. Only recomputes when zoom crosses a band.
  // Returns 0 when zoomed past the cluster threshold (show individual pins).
  const stableCellSize = useMemo(() => {
    if (region.latitudeDelta < MapConfig.CLUSTER_ZOOM_THRESHOLD) return 0;
    const raw = region.latitudeDelta / 3;
    return Math.pow(2, Math.round(Math.log2(raw)));
  }, [region.latitudeDelta]);

  // ── Memoized clusters — only recomputes on zoom band change or venue list change,
  // NOT on every pan (panning doesn't change stableCellSize).
  const clusteredItems = useMemo(
    () => clusterVenues(visibleVenues, stableCellSize),
    [visibleVenues, stableCellSize],
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
    if (venues.length === 0) fetchVenues();
  }, []);

  // Load nearby scraped venues when zoomed in enough, debounced
  useEffect(() => {
    const { latitude, longitude, latitudeDelta, longitudeDelta } = debouncedRegion;
    if (latitudeDelta < 0.08) {
      countNearbyScraped(latitude, longitude, latitudeDelta, longitudeDelta);
    }
    if (latitudeDelta < 0.05) {
      fetchNearbyScraped(latitude, longitude, latitudeDelta, longitudeDelta);
    }
  }, [debouncedRegion]);

  // Debounced search — queries Supabase for both ONY and scraped venues
  useEffect(() => {
    if (!debouncedSearch.trim()) {
      setShowSearchResults(false);
      setSearchResults([]);
      return;
    }

    setShowSearchResults(true);
    setSearchLoading(true);

    let cancelled = false;
    (async () => {
      try {
        // Split query into words so "kofteci ramiz beylikduzu" matches
        // venues where each word appears in either name or address
        const sanitized = debouncedSearch.trim().replace(/[,()]/g, '');
        const words = sanitized.split(/\s+/).filter((w) => w.length >= 2);
        if (words.length === 0) return;

        let query = supabase.from('venues').select('*');
        for (const word of words) {
          query = query.or(`name.ilike.%${word}%,address.ilike.%${word}%`);
        }
        const { data } = await query
          .order('source', { ascending: true }) // 'ony' before 'scraped'
          .order('overall_rating', { ascending: false })
          .limit(15);

        if (cancelled) return;
        setSearchResults((data as Venue[]) || []);
      } catch {
        // Keep existing results on failure
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
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
    markerPressedRef.current = true;
    haptic.light();
    setSelectedVenue(venue);
    mapRef.current?.animateToRegion(
      {
        latitude: venue.latitude,
        longitude: venue.longitude,
        latitudeDelta: region.latitudeDelta,
        longitudeDelta: region.longitudeDelta,
      },
      MapConfig.MARKER_ANIMATION_DURATION,
    );
  };

  const handleSelectSearchResult = (venue: Venue) => {
    haptic.selection();
    setSearchQuery(venue.name);
    setShowSearchResults(false);
    setSelectedVenue(venue);
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
        initialRegion={initialRegion}
        onRegionChangeComplete={setRegion}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        userInterfaceStyle={isDark ? 'dark' : 'light'}
        mapPadding={{ top: insets.top + 60, right: 0, bottom: insets.bottom + 60, left: 0 }}
        onPress={() => {
          if (markerPressedRef.current) {
            markerPressedRef.current = false;
            return;
          }
          if (selectedVenue) setSelectedVenue(null);
        }}
      >
        {clusteredItems.map((item) => {
          if (item.type === 'cluster') {
            const { cluster } = item;
            const count = cluster.venues.length;
            const hasOnyVenue = cluster.venues.some((v) => v.source !== 'scraped');

            // ONY clusters: logo + red count badge
            if (hasOnyVenue) {
              return (
                <React.Fragment key={cluster.id}>
                  <Marker
                    coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
                    image={MARKER_LOGO}
                    onPress={() => handleClusterPress(cluster)}
                    tracksViewChanges={false}
                    anchor={{ x: 0.5, y: 0.5 }}
                  />
                  <Marker
                    coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
                    tracksViewChanges={false}
                    anchor={{ x: 0.5, y: 0.5 }}
                    centerOffset={{ x: 0, y: 37 }}
                    tappable={false}
                  >
                    <View style={styles.clusterCountBadge}>
                      <Text style={styles.clusterCountText}>{count}</Text>
                    </View>
                  </Marker>
                </React.Fragment>
              );
            }

            // Scraped venue clusters: grey dot with count
            return (
              <Marker
                key={cluster.id}
                coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
                onPress={() => handleClusterPress(cluster)}
                tracksViewChanges={false}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={styles.greyClusterBadge}>
                  <Text style={styles.greyClusterText}>{count}</Text>
                </View>
              </Marker>
            );
          }

          const venue = item.venue;
          const tier = getMarkerTier(venue);

          const isSelected = selectedVenue?.id === venue.id;

          // ── Tier 1: Unreviewed external venue ──
          // Non-selected: native image (zero React overhead for 200+ pins)
          // Selected: React view with spring animation (only 1 at a time)
          if (tier === 'scraped') {
            if (isSelected) {
              return (
                <Marker
                  key={venue.id}
                  coordinate={{ latitude: venue.latitude, longitude: venue.longitude }}
                  tracksViewChanges={true}
                  onPress={() => handleMarkerPress(venue)}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <SelectedPop>
                    <View style={styles.osmPinSelected}>
                      <Ionicons name="restaurant" size={14} color="#FFF" />
                    </View>
                  </SelectedPop>
                </Marker>
              );
            }
            return (
              <Marker
                key={venue.id}
                coordinate={{ latitude: venue.latitude, longitude: venue.longitude }}
                image={SCRAPED_PIN}
                tracksViewChanges={false}
                onPress={() => handleMarkerPress(venue)}
                anchor={{ x: 0.5, y: 0.5 }}
              />
            );
          }

          // ── Tier 2: Unreviewed ONY venue — grey tag ──
          if (tier === 'unreviewed') {
            const tagContent = (
              <View style={styles.tagWrapper}>
                <View style={[
                  styles.tagUnreviewed,
                  isSelected
                    ? { backgroundColor: Colors.primary, borderColor: Colors.primary }
                    : { backgroundColor: colors.tagUnreviewed, borderColor: colors.tagUnreviewedBorder },
                ]}>
                  <Text style={[styles.tagUnreviewedText, { color: isSelected ? '#FFFFFF' : colors.textMuted }]} numberOfLines={1}>
                    {venue.name}
                  </Text>
                </View>
                <View style={[styles.tagPointer, { borderTopColor: isSelected ? Colors.primary : colors.tagUnreviewed }]} />
              </View>
            );
            return (
              <Marker
                key={venue.id}
                coordinate={{ latitude: venue.latitude, longitude: venue.longitude }}
                onPress={() => handleMarkerPress(venue)}
                tracksViewChanges={isSelected}
              >
                {isSelected ? <SelectedPop>{tagContent}</SelectedPop> : tagContent}
              </Marker>
            );
          }

          // ── Tier 3: Reviewed ONY venue — native logo marker ──
          return (
            <Marker
              key={venue.id}
              coordinate={{ latitude: venue.latitude, longitude: venue.longitude }}
              onPress={() => handleMarkerPress(venue)}
              tracksViewChanges={isSelected}
              anchor={{ x: 0.5, y: isSelected ? 1 : 0.5 }}
            >
              {isSelected ? (
                <SelectedPop>
                  <View style={styles.selectedLogoWrap}>
                    <Image source={MARKER_LOGO} style={styles.selectedLogoImage} />
                  </View>
                </SelectedPop>
              ) : (
                <Image source={MARKER_LOGO} style={{ width: 40, height: 40 }} />
              )}
            </Marker>
          );
        })}
      </MapView>

      {/* Liquid Glass Search Bar — hidden when sheet is expanded */}
      {!sheetExpanded && <SafeAreaView edges={['top']} style={styles.searchBarSafe}>
        <GlassContainer spacing={8}>
        <GlassBar style={[styles.searchBarBlur, { borderColor: colors.glass.border }]}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Mekan veya semt ara..."
              placeholderTextColor={colors.textSecondary}
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
        </GlassBar>

        {/* Search results dropdown */}
        {showSearchResults && debouncedSearch.trim().length > 0 && (
          <GlassView
            style={[styles.searchDropdown, { borderColor: colors.glass.border }]}
            fallbackColor={isDark ? 'rgba(30,30,30,0.92)' : 'rgba(255,255,255,0.92)'}
          >
            {searchResults.length === 0 && !searchLoading ? (
              <View style={styles.searchDropdownEmpty}>
                <Text style={[styles.searchDropdownEmptyText, { color: colors.textTertiary }]}>Sonuc bulunamadi</Text>
              </View>
            ) : (
              <FlatList
                data={searchResults.slice(0, 8)}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                ListHeaderComponent={
                  searchLoading ? (
                    <View style={styles.searchDropdownLoading}>
                      <ActivityIndicator size="small" color={Colors.primary} />
                    </View>
                  ) : null
                }
                renderItem={({ item }) => {
                  const isAppVenue = item.source !== 'scraped';
                  return (
                    <TouchableOpacity
                      style={[styles.searchDropdownItem, { borderBottomColor: colors.borderLight }]}
                      onPress={() => handleSelectSearchResult(item)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.searchDropdownIcon,
                          {
                            backgroundColor: isAppVenue
                              ? colors.primarySoft
                              : isDark
                                ? 'rgba(255,255,255,0.08)'
                                : 'rgba(0,0,0,0.05)',
                          },
                        ]}
                      >
                        <Ionicons
                          name={isAppVenue ? 'restaurant-outline' : 'location-outline'}
                          size={14}
                          color={isAppVenue ? Colors.primary : colors.textSecondary}
                        />
                      </View>
                      <View style={styles.searchDropdownInfo}>
                        <Text style={[styles.searchDropdownName, { color: colors.text }]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={[styles.searchDropdownAddr, { color: colors.textSecondary }]} numberOfLines={1}>
                          {item.address}
                        </Text>
                      </View>
                      {isAppVenue && item.overall_rating > 0 ? (
                        <View style={styles.searchDropdownRating}>
                          <Ionicons name="star" size={12} color={Colors.star} />
                          <Text style={[styles.searchDropdownRatingText, { color: colors.text }]}>
                            {item.overall_rating.toFixed(1)}
                          </Text>
                        </View>
                      ) : (
                        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </GlassView>
        )}
        </GlassContainer>
      </SafeAreaView>}

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

      {/* Right FAB stack — location + buddy, stacked vertically */}
      <View style={[styles.fabStack, { bottom: Math.max(insets.bottom, 8) + 90 }]}>
        <TouchableOpacity
          style={styles.buddyFab}
          onPress={() => router.push('/buddy')}
          activeOpacity={0.8}
          accessibilityLabel="Yemek arkadasi bul"
          accessibilityRole="button"
        >
          <LinearGradient colors={[FeatureColors.meetup, FeatureColors.buddyDark]} style={styles.buddyFabGradient}>
            <Ionicons name="people" size={20} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>

        {userLocation && (
          <GlassView style={[styles.myLocationBlur, { borderColor: colors.glass.border }]} interactive>
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
      </View>

      {/* Discovery Pill — nudge to zoom in */}
      {isDistrictZoom && !isNeighborhoodZoom && nearbyScrapedCount > 0 && !selectedVenue && !sheetExpanded && (
        <GlassView
          style={[styles.discoveryPill, { bottom: Math.max(insets.bottom, 8) + 90, borderColor: colors.glass.border }]}
        >
          <TouchableOpacity
            style={styles.discoveryPillInner}
            onPress={() => {
              haptic.light();
              mapRef.current?.animateToRegion(
                {
                  latitude: region.latitude,
                  longitude: region.longitude,
                  latitudeDelta: 0.008,
                  longitudeDelta: 0.008,
                },
                600,
              );
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="compass-outline" size={16} color={Colors.primary} />
            <Text style={[styles.discoveryPillText, { color: colors.text }]}>
              Yakinlastir ve yeni mekanlar kesfet
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
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
          <TouchableOpacity activeOpacity={1} style={styles.filterSheetOuter}>
            <GlassView style={styles.filterSheet} fallbackColor={isDark ? 'rgba(30,30,30,0.92)' : 'rgba(255,255,255,0.88)'}>
              <View style={styles.filterHandleArea}>
                <View style={[styles.filterHandle, { backgroundColor: colors.border }]} />
              </View>
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
            </GlassView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Venue Bottom Sheet */}
      <VenueBottomSheet
        venue={selectedVenue}
        onDismiss={() => setSelectedVenue(null)}
        onExpandChange={setSheetExpanded}
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
  searchDropdownLoading: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
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
  // Tier 1: Scraped restaurant pin
  osmPin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(100,110,125,0.7)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  osmPinSelected: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  // Selected reviewed logo
  selectedLogoWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(226, 55, 68, 0.12)',
    borderWidth: 2.5,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  selectedLogoImage: {
    width: 46,
    height: 45,
    resizeMode: 'contain',
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

  // Right FAB stack container
  fabStack: {
    position: 'absolute',
    right: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  // Buddy FAB
  buddyFab: {
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
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  filterSheetOuter: {
    maxHeight: '70%',
  },
  filterSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.xxl,
    paddingTop: Spacing.md,
    overflow: 'hidden',
  },
  filterHandleArea: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
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
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(226,55,68,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  clusterCountText: {
    color: 'rgba(255,255,255,0.95)',
    fontFamily: FontFamily.heading,
    fontSize: 12,
    letterSpacing: -0.3,
  },

  // Grey cluster for unreviewed scraped venues — liquid glass style
  greyClusterBadge: {
    minWidth: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(140,145,155,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  greyClusterText: {
    color: 'rgba(255,255,255,0.9)',
    fontFamily: FontFamily.heading,
    fontSize: 13,
    letterSpacing: -0.3,
  },

  // Discovery Pill — floating CTA for nearby unreviewed venues
  discoveryPill: {
    position: 'absolute',
    left: Spacing.lg,
    right: 76,
    borderRadius: BorderRadius.xl,
    borderWidth: 0.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  discoveryPillInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  discoveryPillText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    letterSpacing: -0.2,
  },
});
