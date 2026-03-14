import React, { useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeIn, Layout } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, VENUE_TAGS } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';
import { haptic } from '../../lib/haptics';

interface TagSelectorProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
}

export default function TagSelector({ selectedTags, onTagsChange }: TagSelectorProps) {
  const colors = useThemeColors();
  const selectedTagSet = useMemo(() => new Set(selectedTags), [selectedTags]);

  const toggleTag = useCallback((tag: string) => {
    haptic.selection();
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter((t) => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  }, [selectedTags, onTagsChange]);

  return (
    <Animated.View style={styles.grid} layout={Layout.springify()}>
      {VENUE_TAGS.map((tag) => {
        const isActive = selectedTagSet.has(tag.key);
        return (
          <Animated.View key={tag.key} layout={Layout.springify()}>
            <TouchableOpacity
              style={[styles.chip, !isActive && { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }, isActive && [styles.chipActive, { backgroundColor: colors.accentSoft, borderColor: colors.accentLight }]]}
              onPress={() => toggleTag(tag.key)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={tag.icon as any}
                size={14}
                color={isActive ? Colors.accent : Colors.textSecondary}
              />
              <Text style={[styles.chipText, { color: colors.textSecondary }, isActive && styles.chipTextActive]}>
                {tag.label}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.backgroundSecondary,
  },
  chipActive: {
    backgroundColor: Colors.accentSoft,
    borderColor: Colors.accentLight,
  },
  chipText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  chipTextActive: {
    color: Colors.accentDark,
    fontWeight: '600',
  },
});
