import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '../../lib/constants';

type BadgeSize = 'sm' | 'md';
type BadgeVariant = 'default' | 'verified';

interface BadgeProps {
  label: string;
  color?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  size?: BadgeSize;
  variant?: BadgeVariant;
  style?: StyleProp<ViewStyle>;
}

export default function Badge({
  label,
  color = Colors.primary,
  icon,
  size = 'sm',
  variant = 'default',
  style,
}: BadgeProps) {
  const isSmall = size === 'sm';
  const isVerified = variant === 'verified';

  if (isVerified) {
    return (
      <View style={[styles.container, styles.verifiedContainer, isSmall ? styles.containerSm : styles.containerMd, style]}>
        <Ionicons
          name="checkmark-circle"
          size={isSmall ? 12 : 14}
          color={Colors.textOnPrimary}
          style={styles.icon}
        />
        <Text
          style={[
            styles.label,
            isSmall ? styles.labelSm : styles.labelMd,
            styles.verifiedLabel,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        isSmall ? styles.containerSm : styles.containerMd,
        { backgroundColor: hexToRgba(color, 0.12) },
        style,
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
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  containerSm: {
    height: 24,
    paddingHorizontal: Spacing.sm,
  },
  containerMd: {
    height: 30,
    paddingHorizontal: Spacing.md,
  },
  verifiedContainer: {
    backgroundColor: Colors.verified,
  },
  icon: {
    marginRight: Spacing.xs,
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  labelSm: {
    fontSize: FontSize.xs,
  },
  labelMd: {
    fontSize: FontSize.sm,
  },
  verifiedLabel: {
    color: Colors.textOnPrimary,
    fontWeight: '700',
  },
});
