import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { DEFAULT_REGION } from '../lib/constants';
import type { MapRegion } from '../types';

interface LocationState {
  location: Location.LocationObject | null;
  region: MapRegion;
  errorMsg: string | null;
  loading: boolean;
}

export function useLocation() {
  const [state, setState] = useState<LocationState>({
    location: null,
    region: DEFAULT_REGION,
    errorMsg: null,
    loading: true,
  });

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setState((prev) => ({
          ...prev,
          errorMsg: 'Konum izni verilmedi',
          loading: false,
        }));
        return;
      }

      try {
        // Try last known position first for instant display
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (lastKnown) {
          setState({
            location: lastKnown,
            region: {
              latitude: lastKnown.coords.latitude,
              longitude: lastKnown.coords.longitude,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            },
            errorMsg: null,
            loading: false,
          });
        }

        // Then get fresh position for accuracy
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        setState({
          location,
          region: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          },
          errorMsg: null,
          loading: false,
        });
      } catch {
        setState((prev) => ({
          ...prev,
          errorMsg: 'Konum alınamadı',
          loading: false,
        }));
      }
    })();
  }, []);

  return state;
}
