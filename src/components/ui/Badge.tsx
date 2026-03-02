import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../lib/constants';

type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  label: string;
  color?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  size?: BadgeSize;
}

export default function Badge({
  label,
  color = Colors.primary,
  icon,
  size = 'sm',
}: BadgeProps) {
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.container,
        isSmall ? styles.containerSm : styles.containerMd,
        { backgroundColor: hexToRgba(color, 0.12) },
      ]}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={isSmall ? 12 : 14}
          color={color}
          style={styles.icon}
        />
      )}
      <Text
        style={[
          styles.label,
          isSmall ? styles.labelSm : styles.labelMd,
          { color },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function hexToRgba(hex: string, alpha: number): string {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  containerSm: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  containerMd: {
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  icon: {
    marginRight: 4,
  },
  label: {
    fontWeight: '600',
  },
  labelSm: {
    fontSize: 11,
  },
  labelMd: {
    fontSize: 13,
  },
});
