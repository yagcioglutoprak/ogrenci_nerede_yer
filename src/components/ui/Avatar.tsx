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
  const backgroundColor = getColorFromName(name);
  const fontSize = Math.round(size * 0.38);
  const borderRadius = size / 2;

  const containerStyle: ViewStyle = {
    width: size,
    height: size,
    borderRadius,
  };

  if (uri && !hasError) {
    return (
      <View style={[styles.container, containerStyle, style]}>
        <Image
          source={{ uri }}
          style={[styles.image, { width: size, height: size, borderRadius }]}
          onError={() => setHasError(true)}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, styles.fallback, containerStyle, { backgroundColor }, style]}>
      <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
    </View>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getColorFromName(name: string): string {
  const palette = [
    '#FF6B35', '#2EC4B6', '#8B5CF6', '#EC4899',
    '#F59E0B', '#3B82F6', '#10B981', '#EF4444',
    '#6366F1', '#14B8A6',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  image: {
    resizeMode: 'cover',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
