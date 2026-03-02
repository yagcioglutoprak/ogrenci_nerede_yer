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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Callout, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useVenueStore } from '../../stores/venueStore';
import { Colors, DEFAULT_REGION, PriceRanges } from '../../lib/constants';
import type { Venue } from '../../types';

export default function MapScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);

  const { venues, loading, fetchVenues, filters, setFilters } = useVenueStore();

  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Filter state
  const [filterPrice, setFilterPrice] = useState<number[]>([]);
  const [filterMinRating, setFilterMinRating] = useState(0);

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
        mapRef.current?.animateToRegion({
          ...coords,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }, 1000);
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
    mapRef.current?.animateToRegion({
      latitude: venue.latitude,
      longitude: venue.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }, 500);
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
      mapRef.current?.animateToRegion({
        ...userLocation,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 800);
    }
  }, [userLocation]);

  const getPriceLabel = (priceRange: number) => {
    return PriceRanges.find((p) => p.value === priceRange)?.label ?? '';
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
            <View style={[
              styles.markerContainer,
              venue.is_verified && styles.markerVerified,
            ]}>
              <Ionicons
                name="restaurant"
                size={16}
                color="#FFFFFF"
              />
            </View>
            <View style={styles.markerArrow} />

            <Callout
              tooltip
              onPress={() => handleCalloutPress(venue)}
            >
              <View style={styles.callout}>
                <Text style={styles.calloutName} numberOfLines={1}>
                  {venue.name}
                </Text>
                <View style={styles.calloutRow}>
                  <Ionicons name="star" size={13} color={Colors.star} />
                  <Text style={styles.calloutRating}>
                    {venue.overall_rating.toFixed(1)}
                  </Text>
                  <Text style={styles.calloutDivider}>|</Text>
                  <Text style={styles.calloutPrice}>
                    {getPriceLabel(venue.price_range)}
                  </Text>
                </View>
                <Text style={styles.calloutHint}>Detaylar icin dokun</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {/* Search Bar */}
      <SafeAreaView edges={['top']} style={styles.searchBarContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Mekan ara..."
            placeholderTextColor={Colors.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
            selectionColor={Colors.primary}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={Colors.textLight} />
            </TouchableOpacity>
          )}
          <View style={styles.searchDivider} />
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilters(true)}
          >
            <Ionicons
              name="options"
              size={20}
              color={
                (filterPrice.length > 0 || filterMinRating > 0)
                  ? Colors.primary
                  : Colors.textSecondary
              }
            />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Loading */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color={Colors.primary} />
        </View>
      )}

      {/* My Location Button */}
      {userLocation && (
        <TouchableOpacity style={styles.myLocationButton} onPress={centerOnUser}>
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

      {/* Filter Modal */}
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
            <View style={styles.filterHandle} />
            <Text style={styles.filterTitle}>Filtreler</Text>

            {/* Price Range */}
            <Text style={styles.filterSectionTitle}>Fiyat Araligi</Text>
            <View style={styles.filterChipsRow}>
              {PriceRanges.map((price) => {
                const isActive = filterPrice.includes(price.value);
                return (
                  <TouchableOpacity
                    key={price.value}
                    style={[styles.filterChip, isActive && styles.filterChipActive]}
                    onPress={() => {
                      setFilterPrice((prev) =>
                        prev.includes(price.value)
                          ? prev.filter((p) => p !== price.value)
                          : [...prev, price.value]
                      );
                    }}
                  >
                    <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                      {price.label}
                    </Text>
                    <Text style={[styles.filterChipDesc, isActive && styles.filterChipDescActive]}>
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
                    style={[styles.filterChip, isActive && styles.filterChipActive]}
                    onPress={() => setFilterMinRating(rating)}
                  >
                    <View style={styles.ratingChipContent}>
                      {rating > 0 ? (
                        <>
                          <Ionicons name="star" size={14} color={isActive ? '#FFFFFF' : Colors.star} />
                          <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                            {rating}+
                          </Text>
                        </>
                      ) : (
                        <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                          Hepsi
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Action Buttons */}
            <View style={styles.filterActions}>
              <TouchableOpacity style={styles.filterClearButton} onPress={clearFilters}>
                <Text style={styles.filterClearText}>Temizle</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.filterApplyButton} onPress={applyFilters}>
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
  // Search Bar
  searchBarContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    marginLeft: 10,
    paddingVertical: 0,
  },
  searchDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.borderLight,
    marginHorizontal: 10,
  },
  filterButton: {
    padding: 4,
  },
  // Marker
  markerContainer: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  markerVerified: {
    backgroundColor: Colors.verified,
  },
  markerArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
    alignSelf: 'center',
    marginTop: -2,
  },
  // Callout
  callout: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    minWidth: 160,
    maxWidth: 220,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  calloutName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  calloutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  calloutRating: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  calloutDivider: {
    color: Colors.textLight,
    fontSize: 13,
  },
  calloutPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.secondary,
  },
  calloutHint: {
    fontSize: 11,
    color: Colors.textLight,
    textAlign: 'center',
  },
  // Loading
  loadingOverlay: {
    position: 'absolute',
    top: 110,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  // My Location
  myLocationButton: {
    position: 'absolute',
    right: 16,
    bottom: 90,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  // FAB
  fab: {
    position: 'absolute',
    left: 16,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    gap: 8,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  // Filter Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  filterSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 12,
  },
  filterHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderLight,
    alignSelf: 'center',
    marginBottom: 16,
  },
  filterTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 20,
  },
  filterSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 10,
    marginTop: 8,
  },
  filterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  filterChip: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Colors.surface,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  filterChipDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  filterChipDescActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  ratingChipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filterActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  filterClearButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  filterClearText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  filterApplyButton: {
    flex: 2,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  filterApplyText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
