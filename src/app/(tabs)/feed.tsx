import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFeedStore } from '../../stores/feedStore';
import { useVenueStore } from '../../stores/venueStore';
import { useAuthStore } from '../../stores/authStore';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';
import PostCard from '../../components/feed/PostCard';
import ErrorState from '../../components/ui/ErrorState';
import GlassView from '../../components/ui/GlassView';
import type { Post, FeedCategory } from '../../types';

const CATEGORIES: { key: FeedCategory; label: string }[] = [
  { key: 'all', label: 'Tumu' },
  { key: 'nearby', label: 'Yakinda' },
  { key: 'top', label: 'En Cok Begenilen' },
  { key: 'new', label: 'Yeni Eklenen' },
];

export default function FeedScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const {
    posts,
    loading,
    refreshing,
    loadingMore,
    error,
    category,
    hasMore,
    fetchPosts,
    fetchMorePosts,
    refreshFeed,
    toggleLike,
    setCategory,
    clearError,
  } = useFeedStore();
  const { toggleFavorite } = useVenueStore();
  const user = useAuthStore((s) => s.user);

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

  const handleComment = useCallback((postId: string) => {
    router.push(`/post/${postId}`);
  }, []);

  const handleVenuePress = useCallback((venueId: string) => {
    router.push(`/venue/${venueId}`);
  }, []);

  const handleUserPress = useCallback((userId: string) => {
    router.push(`/user/${userId}`);
  }, []);

  const handleBookmark = useCallback(
    (postId: string) => {
      if (!user) {
        router.push('/auth/login');
        return;
      }
      const post = posts.find((p) => p.id === postId);
      if (post?.venue_id) {
        toggleFavorite(post.venue_id, user.id);
      }
    },
    [user, posts],
  );

  const handleCategoryChange = useCallback((cat: FeedCategory) => {
    setCategory(cat);
  }, []);

  const handleEndReached = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchMorePosts();
    }
  }, [loadingMore, hasMore]);

  const renderPost = useCallback(
    ({ item }: { item: Post }) => (
      <PostCard
        post={item}
        onLike={handleLike}
        onComment={handleComment}
        onBookmark={handleBookmark}
        onVenuePress={handleVenuePress}
        onUserPress={handleUserPress}
      />
    ),
    [handleLike, handleComment, handleBookmark, handleVenuePress, handleUserPress],
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Colors.primary} />
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>Daha fazla yukleniyor...</Text>
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) return null;
    if (error) {
      return (
        <ErrorState
          message={error}
          onRetry={() => {
            clearError();
            fetchPosts();
          }}
        />
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <View style={[styles.emptyIconCircle, { backgroundColor: colors.primarySoft }]}>
          <Ionicons name="restaurant-outline" size={48} color={Colors.primary} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Henuz gonderi yok</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
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
    <View style={[styles.categoryRow, { borderBottomColor: colors.borderLight }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryScroll}
      >
        {CATEGORIES.map((cat) => {
          const isActive = category === cat.key;
          return (
            <TouchableOpacity
              key={cat.key}
              style={[
                styles.categoryChip,
                isActive && styles.categoryChipActive,
                !isActive && { backgroundColor: colors.backgroundSecondary },
              ]}
              onPress={() => handleCategoryChange(cat.key)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.categoryChipText,
                  isActive && styles.categoryChipTextActive,
                  !isActive && { color: colors.textSecondary },
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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <View style={styles.headerBrand}>
          <Image source={require('../../../assets/logo.png')} style={styles.headerLogo} resizeMode="contain" />
          <Text style={[styles.headerTitle, { color: colors.primaryDark }]}>Keşfet</Text>
        </View>
        <TouchableOpacity
          style={[styles.headerIconButton, { backgroundColor: colors.backgroundSecondary }]}
          onPress={() => {}}
          activeOpacity={0.7}
        >
          <Ionicons name="notifications-outline" size={24} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* Feed */}
      {loading && posts.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Gonderiler yukleniyor...</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={renderPost}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={posts.length === 0 ? styles.emptyList : undefined}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
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
      {Platform.OS === 'ios' ? (
        <GlassView
          style={styles.floatingCreateButtonGlass}
          tintColor={Colors.primary}
          fallbackColor="rgba(226, 55, 68, 0.85)"
        >
          <TouchableOpacity
            style={styles.floatingCreateButtonInner}
            onPress={() => router.push('/(tabs)/add')}
            activeOpacity={0.85}
          >
            <Ionicons name="create-outline" size={26} color="#FFFFFF" />
          </TouchableOpacity>
        </GlassView>
      ) : (
        <TouchableOpacity
          style={styles.floatingCreateButton}
          onPress={() => router.push('/(tabs)/add')}
          activeOpacity={0.85}
        >
          <Ionicons name="create-outline" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Header
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
    fontFamily: FontFamily.heading,
    color: Colors.primaryDark,
    letterSpacing: -0.5,
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerLogo: {
    width: 32,
    height: 32,
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Category Chips
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

  // Loading
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

  // Footer loader
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
  },
  footerText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },

  // Empty State
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
    fontFamily: FontFamily.headingBold,
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
    fontFamily: FontFamily.headingBold,
    color: '#FFFFFF',
  },

  // Floating Create Button
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
  floatingCreateButtonGlass: {
    position: 'absolute',
    right: Spacing.xl,
    bottom: Spacing.xxl,
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
  },
  floatingCreateButtonInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
