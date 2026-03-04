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
import GlassView from '../../components/ui/GlassView';
import RatingBar from '../../components/ui/RatingBar';
import CircleRating from '../../components/ui/CircleRating';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Callout, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useVenueStore } from '../../stores/venueStore';
import { useDebounce } from '../../hooks/useDebounce';
import { useThemeColors, useIsDarkMode } from '../../hooks/useThemeColors';
import {
  Colors,
  DEFAULT_REGION,
  PriceRanges,
  Spacing,
  BorderRadius,
  FontSize,
  FontFamily,
} from '../../lib/constants';
import { MOCK_GOOGLE_PLACES_VENUES } from '../../lib/mockData';
import type { Venue } from '../../types';

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
const CLUSTER_ZOOM_THRESHOLD = 0.012;

function clusterVenues(venues: Venue[], region: Region): ClusterItem[] {
  // Only cluster non-google_places venues
  const onyVenues = venues.filter((v) => v.source !== 'google_places');
  const googleVenues = venues.filter((v) => v.source === 'google_places');

  const items: ClusterItem[] = [];

  // Google Places venues are never clustered (they're tiny dots)
  for (const v of googleVenues) {
    items.push({ type: 'venue' as const, venue: v });
  }

  if (region.latitudeDelta < CLUSTER_ZOOM_THRESHOLD) {
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

const getPriceSymbol = (priceRange: number) => '₺'.repeat(priceRange);

export default function MapScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const colors = useThemeColors();
  const isDark = useIsDarkMode();

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

  // Filter state
  const [filterPrice, setFilterPrice] = useState<number[]>([]);
  const [filterMinRating, setFilterMinRating] = useState(0);

  const hasActiveFilters = filterPrice.length > 0 || filterMinRating > 0;

  const debouncedSearch = useDebounce(searchQuery, 300);

  // ── Merge ONY venues with Google Places ──
  const allVenues = useMemo(
    () => [...venues, ...MOCK_GOOGLE_PLACES_VENUES],
    [venues],
  );

  // ── Memoized clusters ──
  const clusteredItems = useMemo(
    () => clusterVenues(allVenues, region),
    [allVenues, region],
  );

  const handleClusterPress = useCallback(
    (cluster: ClusterGroup) => {
      // Compute bounding box of cluster venues
      let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
      for (const v of cluster.venues) {
        if (v.latitude < minLat) minLat = v.latitude;
        if (v.latitude > maxLat) maxLat = v.latitude;
        if (v.longitude < minLng) minLng = v.longitude;
        if (v.longitude > maxLng) maxLng = v.longitude;
      }
      const pad = 0.002;
      mapRef.current?.animateToRegion(
        {
          latitude: (minLat + maxLat) / 2,
          longitude: (minLng + maxLng) / 2,
          latitudeDelta: Math.max(maxLat - minLat + pad, 0.005),
          longitudeDelta: Math.max(maxLng - minLng + pad, 0.005),
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

  const handleSelectSearchResult = (venue: Venue) => {
    setSearchQuery(venue.name);
    setShowSearchResults(false);
    mapRef.current?.animateToRegion(
      {
        latitude: venue.latitude,
        longitude: venue.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      800,
    );
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
    return (
      <RatingBar rating={rating} size="sm" color={Colors.primary} showValue={false} barWidth={60} />
    );
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
        userInterfaceStyle={isDark ? 'dark' : 'light'}
        mapPadding={{ top: 100, right: 0, bottom: 80, left: 0 }}
      >
        {clusteredItems.map((item) => {
          if (item.type === 'cluster') {
            const { cluster } = item;
            const count = cluster.venues.length;
            const size = Math.min(40 + count * 2, 56);
            return (
              <Marker
                key={cluster.id}
                coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
                onPress={() => handleClusterPress(cluster)}
                tracksViewChanges={false}
              >
                <View style={[styles.clusterBubble, { width: size, height: size, borderRadius: size / 2 }]}>
                  <Text style={styles.clusterText}>{count}</Text>
                </View>
              </Marker>
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
              >
                <View style={styles.greyDot} />

                <Callout tooltip onPress={() => handleCalloutPress(venue)}>
                  <View style={styles.calloutContainer}>
                    <View style={[styles.callout, { backgroundColor: isDark ? 'rgba(30,30,30,0.95)' : 'rgba(255,255,255,0.92)', borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.6)' }]}>
                      <View style={styles.greyDotCallout}>
                        <Text style={[styles.greyDotCalloutName, { color: colors.text }]} numberOfLines={1}>
                          {venue.name}
                        </Text>
                        {venue.google_rating != null && (
                          <View style={styles.greyDotCalloutRating}>
                            <Ionicons name="logo-google" size={12} color="#4285F4" />
                            <Text style={[styles.greyDotCalloutScore, { color: colors.textSecondary }]}>
                              {venue.google_rating.toFixed(1)}
                            </Text>
                          </View>
                        )}
                        <View style={styles.greyDotCalloutCta}>
                          <Ionicons name="add-circle" size={14} color={Colors.primary} />
                          <Text style={styles.greyDotCalloutCtaText}>Ilk degerlendirmeyi yap!</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </Callout>
              </Marker>
            );
          }

          // ── Tier 2: Unreviewed ONY venue — muted pill ──
          if (tier === 'unreviewed') {
            return (
              <Marker
                key={venue.id}
                coordinate={{ latitude: venue.latitude, longitude: venue.longitude }}
                onPress={() => handleMarkerPress(venue)}
                tracksViewChanges={false}
              >
                <View style={styles.markerWrapper}>
                  <View style={[styles.mutedPill, { backgroundColor: isDark ? 'rgba(40,40,40,0.75)' : 'rgba(245,245,245,0.85)', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}>
                    <Text style={[styles.mutedPillText, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)' }]} numberOfLines={1}>
                      {venue.name}
                    </Text>
                  </View>
                  <View style={[styles.mutedStem, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }]} />
                  <View style={[styles.mutedAnchor, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)', borderColor: isDark ? 'rgba(60,60,60,0.9)' : 'rgba(255,255,255,0.9)' }]} />
                </View>

                <Callout tooltip onPress={() => handleCalloutPress(venue)}>
                  <View style={styles.calloutContainer}>
                    <View style={[styles.callout, { backgroundColor: isDark ? 'rgba(30,30,30,0.95)' : 'rgba(255,255,255,0.92)', borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.6)' }]}>
                      <View style={styles.greyDotCallout}>
                        <Text style={[styles.greyDotCalloutName, { color: colors.text }]} numberOfLines={1}>
                          {venue.name}
                        </Text>
                        <Text style={[styles.mutedCalloutAddr, { color: colors.textTertiary }]} numberOfLines={1}>
                          {venue.address}
                        </Text>
                        <View style={styles.greyDotCalloutCta}>
                          <Ionicons name="star-outline" size={14} color={Colors.primary} />
                          <Text style={styles.greyDotCalloutCtaText}>Degerlendir</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                </Callout>
              </Marker>
            );
          }

          // ── Tier 3: Reviewed ONY venue — full liquid glass card ──
          const hasEditorial = venue.editorial_rating != null;
          return (
          <Marker
            key={venue.id}
            coordinate={{
              latitude: venue.latitude,
              longitude: venue.longitude,
            }}
            onPress={() => handleMarkerPress(venue)}
            tracksViewChanges={false}
          >
            <View style={styles.markerWrapper}>
              {/* Liquid Glass card */}
              <View style={[styles.markerGlass, { backgroundColor: isDark ? 'rgba(30,30,30,0.85)' : 'rgba(255,255,255,0.82)', borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.7)' }]}>
                <View style={styles.markerGlassInner}>
                  {/* Top row: dot + name */}
                  <View style={styles.markerHeader}>
                    {hasEditorial ? (
                      <Image source={require('../../../assets/logo.png')} style={styles.markerLogo} resizeMode="contain" />
                    ) : (
                      <View style={[styles.markerDot, { backgroundColor: Colors.primary }]} />
                    )}
                    <Text style={[styles.markerName, { color: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)' }]} numberOfLines={1}>
                      {venue.name}
                    </Text>
                  </View>
                  {/* Bottom row: rating + price + editorial */}
                  <View style={styles.markerMeta}>
                    <Text style={[styles.markerScore, { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)' }]}>
                      {venue.overall_rating.toFixed(1)}
                    </Text>
                    <View style={[styles.markerMetaDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }]} />
                    <Text style={[styles.markerPrice, { color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)' }]}>
                      {getPriceSymbol(venue.price_range)}
                    </Text>
                    {hasEditorial && (
                      <>
                        <View style={[styles.markerMetaDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }]} />
                        <Image source={require('../../../assets/logo.png')} style={styles.markerMetaLogo} resizeMode="contain" />
                        <Text style={styles.markerOnyScore}>{venue.editorial_rating}</Text>
                      </>
                    )}
                  </View>
                </View>
              </View>
              {/* Stem */}
              <View style={[styles.markerStem, { backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }]} />
              <View style={[styles.markerAnchor, { backgroundColor: isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.2)', borderColor: isDark ? 'rgba(60,60,60,0.9)' : 'rgba(255,255,255,0.9)' }]} />
            </View>

            <Callout tooltip onPress={() => handleCalloutPress(venue)}>
              <View style={styles.calloutContainer}>
                <View style={[styles.callout, { backgroundColor: isDark ? 'rgba(30,30,30,0.95)' : 'rgba(255,255,255,0.92)', borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.6)' }]}>
                  <View style={styles.calloutBody}>
                    {venue.cover_image_url && (
                      <Image
                        source={{ uri: venue.cover_image_url }}
                        style={styles.calloutImage}
                      />
                    )}
                    <View style={styles.calloutInfo}>
                      <Text style={[styles.calloutName, { color: colors.text }]} numberOfLines={1}>{venue.name}</Text>
                      <View style={styles.calloutRatingRow}>
                        <Image source={require('../../../assets/logo.png')} style={styles.calloutLogoIcon} resizeMode="contain" />
                        <View style={styles.calloutStars}>{renderStars(venue.overall_rating)}</View>
                        <Text style={[styles.calloutRatingText, { color: colors.text }]}>{venue.overall_rating.toFixed(1)}</Text>
                      </View>
                      <View style={styles.calloutBadges}>
                        <View style={[styles.calloutPriceBadge, { backgroundColor: colors.primarySoft }]}>
                          <Text style={styles.calloutPriceText}>{getPriceLabel(venue.price_range)}</Text>
                        </View>
                        {venue.editorial_rating != null && (
                          <CircleRating score={venue.editorial_rating} size="sm" color={Colors.accent} />
                        )}
                        <View style={styles.calloutDetailLink}>
                          <Text style={styles.calloutDetailText}>Detaylar</Text>
                          <Ionicons name="chevron-forward" size={12} color={Colors.primary} />
                        </View>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            </Callout>
          </Marker>
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
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setShowSearchResults(false);
                  fetchVenues();
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle-outline" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
            <View style={styles.searchDivider} />
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setShowFilters(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
                data={venues.slice(0, 5)}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.searchDropdownItem}
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

      {/* My Location — Liquid Glass */}
      {userLocation && (
        <GlassView style={[styles.myLocationBlur, { borderColor: colors.glass.border }]}>
          <TouchableOpacity
            style={styles.myLocationButton}
            onPress={centerOnUser}
            activeOpacity={0.7}
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
                          <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive, !isActive && { color: colors.text }]}>
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
              <TouchableOpacity style={[styles.filterClearButton, { borderColor: colors.border }]} onPress={clearFilters} activeOpacity={0.7}>
                <Text style={[styles.filterClearText, { color: colors.textSecondary }]}>Temizle</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.filterApplyButton} onPress={applyFilters} activeOpacity={0.85}>
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

  // Markers — Liquid Glass inspired
  markerWrapper: {
    alignItems: 'center',
  },
  markerGlass: {
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.7)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    maxWidth: 150,
  },
  markerGlassInner: {
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  markerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  markerDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  markerName: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(0,0,0,0.85)',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  markerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
    paddingLeft: 12,
  },
  markerScore: {
    fontSize: 11,
    fontFamily: FontFamily.headingBold,
    color: 'rgba(0,0,0,0.6)',
    letterSpacing: -0.2,
  },
  markerMetaDivider: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  markerPrice: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(0,0,0,0.45)',
  },
  markerLogo: {
    width: 14,
    height: 14,
  },
  markerMetaLogo: {
    width: 11,
    height: 11,
  },
  markerOnyScore: {
    fontSize: 10,
    fontFamily: FontFamily.heading,
    color: Colors.accent,
    letterSpacing: -0.2,
    marginLeft: 1,
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
  greyDotCallout: {
    padding: Spacing.md,
    gap: Spacing.xs,
    minWidth: 180,
  },
  greyDotCalloutName: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
  },
  greyDotCalloutRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  greyDotCalloutScore: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodySemiBold,
  },
  greyDotCalloutCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  greyDotCalloutCtaText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodySemiBold,
    color: Colors.primary,
  },

  // Tier 2: Muted pill (unreviewed ONY venue)
  mutedPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 0.5,
    maxWidth: 120,
  },
  mutedPillText: {
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  mutedStem: {
    width: 1,
    height: 4,
  },
  mutedAnchor: {
    width: 4,
    height: 4,
    borderRadius: 2,
    borderWidth: 1,
  },
  mutedCalloutAddr: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },

  markerStem: {
    width: 1.5,
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  markerAnchor: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.9)',
  },

  // Callout — Liquid Glass
  calloutContainer: {
    minWidth: 240,
    maxWidth: 300,
  },
  callout: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  calloutBody: {
    flexDirection: 'row',
  },
  calloutImage: {
    width: 72,
    height: '100%' as any,
    minHeight: 80,
    backgroundColor: Colors.shimmer,
  },
  calloutInfo: {
    flex: 1,
    padding: Spacing.md,
  },
  calloutName: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
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
  calloutBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  calloutPriceBadge: {
    backgroundColor: Colors.primarySoft,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  calloutPriceText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.headingBold,
    color: Colors.primary,
  },
  calloutOnyBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: Colors.accentSoft,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  calloutOnyLabel: {
    fontSize: 9,
    fontFamily: FontFamily.heading,
    color: Colors.accent,
    marginRight: 3,
  },
  calloutOnyScore: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.heading,
    color: Colors.accent,
  },
  calloutOnyMax: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.accentLight,
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
  calloutEditorialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  calloutLogoIcon: {
    width: 22,
    height: 22,
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

  // My Location — Liquid Glass
  myLocationBlur: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: 100,
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

  // Cluster marker styles
  clusterBubble: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  clusterText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.heading,
    fontSize: 15,
    letterSpacing: -0.3,
  },
});
