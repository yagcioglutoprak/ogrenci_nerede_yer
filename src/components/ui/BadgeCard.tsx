import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { Badge } from '../../types';

interface BadgeCardProps {
  badge: Badge;
  earned?: boolean;
  earnedAt?: string;
}

export default function BadgeCard({ badge, earned = false, earnedAt }: BadgeCardProps) {
  const colors = useThemeColors();

  return (
    <View style={[styles.container, { backgroundColor: earned ? badge.color + '15' : colors.backgroundSecondary, borderColor: earned ? badge.color + '40' : colors.border }]}>
      <View style={[styles.iconCircle, { backgroundColor: earned ? badge.color : colors.border }]}>
        <Ionicons
          name={(badge.icon_name as any) || 'trophy'}
          size={20}
          color={earned ? '#FFFFFF' : colors.textTertiary}
        />
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { color: earned ? colors.text : colors.textTertiary }]} numberOfLines={1}>
          {badge.name}
        </Text>
        <Text style={[styles.description, { color: earned ? colors.textSecondary : colors.textTertiary }]} numberOfLines={1}>
          {badge.description}
        </Text>
      </View>
      {earned && (
        <Ionicons name="checkmark-circle" size={20} color={badge.color} />
      )}
      {!earned && (
        <Ionicons name="lock-closed" size={16} color={colors.textTertiary} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.headingBold,
  },
  description: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
  },
});
