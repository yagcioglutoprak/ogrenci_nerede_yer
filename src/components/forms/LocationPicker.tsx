import React, { useRef, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MapView, { Marker, MapPressEvent } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, DEFAULT_REGION } from '../../lib/constants';
import { useThemeColors, useIsDarkMode } from '../../hooks/useThemeColors';

interface LocationPickerProps {
  location: { latitude: number; longitude: number } | null;
  onLocationChange: (location: { latitude: number; longitude: number }) => void;
}

function LocationPicker({ location, onLocationChange }: LocationPickerProps) {
  const colors = useThemeColors();
  const isDark = useIsDarkMode();
  const mapRef = useRef<MapView>(null);

  const handleMapPress = useCallback((e: MapPressEvent) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    onLocationChange({ latitude, longitude });
  }, [onLocationChange]);

  return (
    <View>
      <View style={[styles.mapContainer, { borderColor: colors.border }]}>
        <MapView
          ref={mapRef}
          style={styles.mapView}
          initialRegion={DEFAULT_REGION}
          onPress={handleMapPress}
          showsUserLocation
          userInterfaceStyle={isDark ? 'dark' : 'light'}
        >
          {location && (
            <Marker coordinate={location}>
              <View style={styles.marker}>
                <Ionicons name="restaurant" size={14} color="#FFFFFF" />
              </View>
            </Marker>
          )}
        </MapView>
      </View>
      {location && (
        <View style={styles.confirmRow}>
          <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
          <Text style={styles.confirmText}>Konum secildi</Text>
        </View>
      )}
    </View>
  );
}

export default React.memo(LocationPicker);

const styles = StyleSheet.create({
  mapContainer: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mapView: {
    width: '100%',
    height: 150,
  },
  marker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  confirmText: {
    fontSize: FontSize.sm,
    color: Colors.success,
    fontWeight: '600',
  },
});
