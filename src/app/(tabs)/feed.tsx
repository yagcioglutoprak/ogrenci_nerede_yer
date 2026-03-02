import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFeedStore } from '../../stores/feedStore';
import { useAuthStore } from '../../stores/authStore';
import { Colors, Spacing, BorderRadius, FontSize } from '../../lib/constants';
import PostCard from '../../components/feed/PostCard';
import type { Post } from '../../types';

const CATEGORIES = [
  { key: 'all', label: 'Tumu' },
  { key: 'nearby', label: 'Yakinda' },
  { key: 'top', label: 'En Cok Begenilen' },
  { key: 'new', label: 'Yeni Eklenen' },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]['key'];

export default function FeedScreen() {
  const router = useRouter();
  const { posts, loading, refreshing, fetchPosts, refreshFeed, toggleLike } =
    useFeedStore();
  const user = useAuthStore((s) => s.user);
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('all');

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleLike = useCallback(
    (postId: string) => {
      if (user) {
        toggleLike(postId, user.id);
      } else {
        router.push('/auth/login');
      }
    },
    [user],
  );

  const handleComment = useCallback((_postId: string) => {
    // Navigate to post detail / comment section
  }, []);

  const handleVenuePress = useCallback((venueId: string) => {
    router.push(`/venue/${venueId}`);
  }, []);

  const handleUserPress = useCallback((_userId: string) => {
    // Navigate to user profile
  }, []);

  const renderPost = useCallback(
    ({ item }: { item: Post }) => (
      <PostCard
        post={item}
        onLike={handleLike}
        onComment={handleComment}
        onVenuePress={handleVenuePress}
        onUserPress={handleUserPress}
      />
    ),
    [handleLike, handleComment, handleVenuePress, handleUserPress],
  );

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyContainer}>
        {/* Illustration circle */}
        <View style={styles.emptyIconCircle}>
          <Ionicons
            name="restaurant-outline"
            size={48}
            color={Colors.primary}
          />
        </View>

        <Text style={styles.emptyTitle}>Henuz gonderi yok</Text>
        <Text style={styles.emptySubtitle}>
          Kesfetmeye basla! Yeni mekanlar ekle{'\n'}ve deneyimlerini paylas.
        </Text>

        <TouchableOpacity
          style={styles.emptyButton}
          onPress={() => router.push('/(tabs)/add')}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle" size={20} color="#FFFFFF" />
          <Text style={styles.emptyButtonText}>Ilk gonderiyi paylas</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.categoryRow}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryScroll}
      >
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.key;
          return (
            <TouchableOpacity
              key={cat.key}
              style={[styles.categoryChip, isActive && styles.categoryChipActive]}
              onPress={() => setActiveCategory(cat.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  isActive && styles.categoryChipTextActive,
                ]}
              >
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ogrenci Nerede Yer?</Text>
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={() => {
            // Notification screen placeholder
          }}
          activeOpacity={0.7}
        >
          <Ionicons
            name="notifications-outline"
            size={24}
            color={Colors.textTertiary}
          />
        </TouchableOpacity>
      </View>

      {/* Feed */}
      {loading && posts.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Gonderiler yukleniyor...</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderPost}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={
            posts.length === 0 ? styles.emptyList : undefined
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refreshFeed}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
        />
      )}

      {/* Floating Create Post Button */}
      <TouchableOpacity
        style={styles.floatingCreateButton}
        onPress={() => router.push('/(tabs)/add')}
        activeOpacity={0.85}
      >
        <Ionicons name="create-outline" size={26} color="#FFFFFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // ── Header ───────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.background,
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Category Chips ───────────────────────────────────────────
  categoryRow: {
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  categoryScroll: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.xxl,
    backgroundColor: Colors.backgroundSecondary,
  },
  categoryChipActive: {
    backgroundColor: Colors.primary,
  },
  categoryChipText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },

  // ── Loading ──────────────────────────────────────────────────
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: FontSize.sm + 1,
    color: Colors.textSecondary,
  },

  // ── Empty State ──────────────────────────────────────────────
  emptyList: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxxl + 8,
    paddingBottom: 80,
  },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xxl,
  },
  emptyTitle: {
    fontSize: FontSize.xxl - 2,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xxl,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md + 2,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  emptyButtonText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ── Floating Create Button ───────────────────────────────────
  floatingCreateButton: {
    position: 'absolute',
    right: Spacing.xl,
    bottom: Spacing.xxl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 8,
  },
});
