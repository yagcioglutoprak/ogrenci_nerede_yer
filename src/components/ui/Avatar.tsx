import React, { useState } from 'react';
import { View, Image, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Colors } from '../../lib/constants';

interface AvatarProps {
  uri?: string | null;
  name: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export default function Avatar({
  uri,
  name,
  size = 40,
  style,
}: AvatarProps) {
  const [hasError, setHasError] = useState(false);

  const initials = getInitials(name);
  const backgroundColor = getWarmColorFromName(name);
  const fontSize = Math.round(size * 0.36);
  const borderRadius = size / 2;
  const borderWidth = Math.max(1.5, size * 0.05);

  const containerStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius,
    borderWidth,
    borderColor: Colors.background,
  };

  if (uri && !hasError) {
    return (
      <View style={[styles.container, styles.shadow, containerStyle, style]}>
        <Image
          source={{ uri }}
          style={[
            styles.image,
            {
              width: size - borderWidth * 2,
              height: size - borderWidth * 2,
              borderRadius: (size - borderWidth * 2) / 2,
            },
          ]}
          onError={() => setHasError(true)}
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        styles.fallback,
        styles.shadow,
        containerStyle,
        { backgroundColor },
        style,
      ]}
    >
      <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
    </View>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// Warm-tone palette only: reds, oranges, warm pinks, corals
function getWarmColorFromName(name: string): string {
  const warmPalette = [
    '#E23744', // rich red
    '#FF6B35', // warm orange
    '#C62828', // deep red
    '#E55A2B', // dark orange
    '#FF5252', // light red
    '#FF8F66', // light orange
    '#D84315', // burnt orange
    '#E53935', // medium red
    '#FF7043', // coral orange
    '#EF5350', // soft red
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return warmPalette[Math.abs(hash) % warmPalette.length];
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shadow: {
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 3,
  },
  image: {
    resizeMode: 'cover',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: Colors.textOnPrimary,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
