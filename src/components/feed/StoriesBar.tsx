import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Colors, Spacing, FontSize, FontFamily } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { Story } from '../../types';

// TODO: Fetch stories from Supabase
const stories: Story[] = [];

const CIRCLE_SIZE = 68;
const BORDER_WIDTH = 2.5;
const STORY_ITEM_WIDTH = CIRCLE_SIZE + 8;
const GRADIENT_COLORS: [string, string] = [Colors.primary, Colors.accent];

export default function StoriesBar() {
  const colors = useThemeColors();
  const router = useRouter();
  const [watchedIds, setWatchedIds] = useState<Set<string>>(new Set());

  const handleStoryPress = useCallback((index: number) => {
    const story = stories[index];
    setWatchedIds((prev) => new Set(prev).add(story.id));
    router.push({ pathname: '/reels', params: { index: String(index) } });
  }, [router]);

  const renderStory = useCallback(
    ({ item, index }: { item: Story; index: number }) => {
      const isWatched = watchedIds.has(item.id);

      return (
        <TouchableOpacity
          style={styles.storyItem}
          onPress={() => handleStoryPress(index)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`${item.title} hikayesini izle`}
        >
          <LinearGradient
            colors={GRADIENT_COLORS}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.gradientBorder, isWatched && { opacity: 0.4 }]}
          >
            <View style={[styles.imageWrapper, { backgroundColor: colors.background, borderColor: colors.background }]}>
              <Image source={{ uri: item.thumbnail_url }} style={styles.thumbnail} />
            </View>
          </LinearGradient>
          <Text
            style={[styles.title, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
        </TouchableOpacity>
      );
    },
    [watchedIds, colors],
  );

  const getItemLayout = useCallback(
    (_data: ArrayLike<Story> | null | undefined, index: number) => ({
      length: STORY_ITEM_WIDTH,
      offset: STORY_ITEM_WIDTH * index,
      index,
    }),
    [],
  );

  if (stories.length === 0) return null;

  return (
    <View style={styles.container}>
      <FlatList
        data={stories}
        keyExtractor={(item) => item.id}
        renderItem={renderStory}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        getItemLayout={getItemLayout}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: Spacing.md,
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  storyItem: {
    alignItems: 'center',
    width: CIRCLE_SIZE + 8,
  },
  gradientBorder: {
    width: CIRCLE_SIZE + BORDER_WIDTH * 2,
    height: CIRCLE_SIZE + BORDER_WIDTH * 2,
    borderRadius: (CIRCLE_SIZE + BORDER_WIDTH * 2) / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrapper: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFFFFF', // overridden inline with colors.background
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemiBold,
    marginTop: Spacing.xs,
    textAlign: 'center',
    maxWidth: CIRCLE_SIZE + 8,
  },
});
