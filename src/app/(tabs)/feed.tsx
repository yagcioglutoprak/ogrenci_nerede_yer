import React, { useEffect, useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Platform,
  LayoutChangeEvent,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { useFeedStore } from '../../stores/feedStore';
import { useVenueStore } from '../../stores/venueStore';
import { useAuthStore } from '../../stores/authStore';
import { useEventStore } from '../../stores/eventStore';
import { useMessageStore } from '../../stores/messageStore';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';
import PostCard from '../../components/feed/PostCard';
import EventCard from '../../components/feed/EventCard';
import QuestionCard from '../../components/feed/QuestionCard';
import MomentCard from '../../components/feed/MomentCard';
import ErrorState from '../../components/ui/ErrorState';
import EmptyState from '../../components/ui/EmptyState';
import { PostCardSkeleton } from '../../components/ui/Skeleton';
import GlassView from '../../components/ui/GlassView';
import ScreenHeader from '../../components/ui/ScreenHeader';
import StoriesBar from '../../components/feed/StoriesBar';
import { MOCK_RECOMMENDATION_ANSWERS } from '../../lib/mockData';
import type { Post, FeedCategory } from '../../types';

const CATEGORIES: { key: FeedCategory; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'Tumu', icon: 'apps-outline' },
  { key: 'meetups', label: 'Bulusmalar', icon: 'people-outline' },
  { key: 'moments', label: 'Anlik', icon: 'flash-outline' },
  { key: 'questions', label: 'Oneriler', icon: 'help-circle-outline' },
  { key: 'top', label: 'Populer', icon: 'trending-up-outline' },
  { key: 'new', label: 'Yeni', icon: 'time-outline' },
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
  const { joinEvent } = useEventStore();
  const user = useAuthStore((s) => s.user);

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showBuddyBanner, setShowBuddyBanner] = useState(true);

  // Animated chip indicator
  const chipLayouts = useRef<Record<string, { x: number; width: number }>>({});
  const indicatorX = useSharedValue(0);
  const indicatorW = useSharedValue(60);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorW.value,
  }));

  useEffect(() => {
    fetchPosts();
  }, []);

  // Update indicator when category changes
  useEffect(() => {
    const layout = chipLayouts.current[category];
    if (layout) {
      indicatorX.value = withSpring(layout.x, { damping: 18, stiffness: 200 });
      indicatorW.value = withSpring(layout.width, { damping: 18, stiffness: 200 });
    }
  }, [category]);

  const handleChipLayout = useCallback((key: string, event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    chipLayouts.current[key] = { x, width };
    // Initialize indicator position for the default active chip
    if (key === 'all' && indicatorX.value === 0) {
      indicatorX.value = x;
      indicatorW.value = width;
    }
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

  const handleJoinEvent = useCallback(
    (eventId: string) => {
      if (!user) {
        router.push('/auth/login');
        return;
      }
      // Optimistic update: add user to attendees locally
      const updatedPosts = posts.map((p) => {
        if (p.event && p.event.id === eventId) {
          const alreadyJoined = p.event.attendees?.some((a) => a.user_id === user.id);
          if (alreadyJoined) return p;
          const newAttendee = {
            event_id: eventId,
            user_id: user.id,
            status: 'confirmed' as const,
            joined_at: new Date().toISOString(),
            user,
          };
          return {
            ...p,
            event: {
              ...p.event,
              attendees: [...(p.event.attendees || []), newAttendee],
              attendee_count: (p.event.attendee_count ?? 0) + 1,
            },
          };
        }
        return p;
      });
      useFeedStore.setState({ posts: updatedPosts });
      // Also fire the store action (fire-and-forget)
      joinEvent(eventId, user.id);
    },
    [user, posts],
  );

  const handleAnswer = useCallback((postId: string) => {
    router.push(`/post/${postId}`);
  }, []);

  const handleJoinMoment = useCallback((postId: string) => {
    router.push(`/post/${postId}`);
  }, []);

  const handleMessage = useCallback(async (userId: string) => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    const convId = await useMessageStore.getState().fetchOrCreateConversation(user.id, userId);
    if (convId) {
      router.push(`/chat/${convId}`);
    }
  }, [user]);

  const handleCategoryChange = useCallback((cat: FeedCategory) => {
    setCategory(cat);
  }, []);

  const handleEndReached = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchMorePosts();
    }
  }, [loadingMore, hasMore]);

  // Client-side filter: filter posts by search query
  const filteredPosts = searchQuery.trim().length > 0
    ? posts.filter((p) => {
        const q = searchQuery.toLowerCase();
        const captionMatch = p.caption?.toLowerCase().includes(q);
        const venueMatch = p.venue?.name?.toLowerCase().includes(q);
        const usernameMatch = p.user?.username?.toLowerCase().includes(q);
        return captionMatch || venueMatch || usernameMatch;
      })
    : posts;

  const renderPost = useCallback(
    ({ item, index }: { item: Post; index: number }) => {
      const animDelay = Math.min(index * 80, 400);

      let card;
      switch (item.post_type) {
        case 'meetup':
          if (item.event) {
            card = (
              <EventCard
                post={item}
                event={item.event}
                currentUserId={user?.id}
                onJoin={handleJoinEvent}
                onUserPress={handleUserPress}
                onVenuePress={handleVenuePress}
                onPress={() => router.push(`/event/${item.event!.id}`)}
              />
            );
          } else {
            card = (
              <PostCard
                post={item}
                onLike={handleLike}
                onComment={handleComment}
                onBookmark={handleBookmark}
                onVenuePress={handleVenuePress}
                onUserPress={handleUserPress}
                onMessage={handleMessage}
                currentUserId={user?.id}
              />
            );
          }
          break;
        case 'question':
          card = (
            <QuestionCard
              post={item}
              topAnswers={MOCK_RECOMMENDATION_ANSWERS.filter((a) => a.post_id === item.id).slice(0, 2)}
              onAnswer={handleAnswer}
              onUserPress={handleUserPress}
              onVenuePress={handleVenuePress}
              onPress={() => router.push(`/post/${item.id}`)}
            />
          );
          break;
        case 'moment':
          card = (
            <MomentCard
              post={item}
              onLike={handleLike}
              onJoinMoment={handleJoinMoment}
              onUserPress={handleUserPress}
              onVenuePress={handleVenuePress}
            />
          );
          break;
        case 'discovery':
        default:
          card = (
            <PostCard
              post={item}
              onLike={handleLike}
              onComment={handleComment}
              onBookmark={handleBookmark}
              onVenuePress={handleVenuePress}
              onUserPress={handleUserPress}
            />
          );
          break;
      }

      return (
        <Animated.View entering={FadeInDown.delay(animDelay).springify().damping(18)}>
          {card}
        </Animated.View>
      );
    },
    [handleLike, handleComment, handleBookmark, handleVenuePress, handleUserPress, handleJoinEvent, handleAnswer, handleJoinMoment, handleMessage, user?.id],
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <PostCardSkeleton />
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
      <EmptyState
        variant="feed"
        title="Henuz gonderi yok"
        subtitle={'Kesfetmeye basla! Yeni mekanlar ekle\nve deneyimlerini paylas.'}
        actionLabel="Ilk gonderiyi paylas"
        onAction={() => router.push('/(tabs)/add')}
      />
    );
  };

  const renderHeader = () => (
    <>
      <StoriesBar />
      <View style={styles.categoryRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          <View style={styles.chipContainer}>
            <Animated.View
              style={[
                styles.chipIndicator,
                { backgroundColor: Colors.primary },
                indicatorStyle,
              ]}
            />
            {CATEGORIES.map((cat) => {
              const isActive = category === cat.key;
              return (
                <TouchableOpacity
                  key={cat.key}
                  onLayout={(e) => handleChipLayout(cat.key, e)}
                  style={styles.categoryChip}
                  onPress={() => handleCategoryChange(cat.key)}
                  activeOpacity={0.7}
                  accessibilityRole="tab"
                  accessibilityLabel={cat.label + ' kategorisi'}
                  accessibilityState={{ selected: isActive }}
                >
                  <Ionicons
                    name={cat.icon}
                    size={14}
                    color={isActive ? '#FFFFFF' : colors.textTertiary}
                  />
                  <Text
                    style={[
                      styles.categoryChipText,
                      isActive ? styles.categoryChipTextActive : { color: colors.textSecondary },
                    ]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Warm background gradient */}
      <LinearGradient
        colors={[colors.background, colors.backgroundSecondary]}
        style={StyleSheet.absoluteFill}
      />

      <ScreenHeader
        title="Akis"
        rightAction={{
          icon: showSearch ? 'close' : 'search',
          onPress: () => setShowSearch(!showSearch),
          color: showSearch ? Colors.primary : undefined,
        }}
      />

      {/* Search Bar */}
      {showSearch && (
        <Animated.View entering={FadeInDown.duration(300)} style={styles.searchBarContainer}>
          <View style={[styles.searchBar, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
            <Ionicons name="search" size={18} color={colors.textTertiary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Mekan veya gonderi ara..."
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              selectionColor={Colors.primary}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      )}

      {/* Buddy Banner */}
      {showBuddyBanner && (
        <TouchableOpacity
          style={{ marginHorizontal: Spacing.lg, marginBottom: Spacing.md, borderRadius: BorderRadius.md, overflow: 'hidden' }}
          onPress={() => router.push('/buddy')}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#06B6D4', '#0891B2']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={{ flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, gap: Spacing.md }}
          >
            <Ionicons name="people" size={24} color="#FFF" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: FontSize.md, fontFamily: FontFamily.headingBold, color: '#FFF' }}>
                Yalniz yemek yeme!
              </Text>
              <Text style={{ fontSize: FontSize.xs, fontFamily: FontFamily.body, color: 'rgba(255,255,255,0.8)' }}>
                Yakininda yemek arkadasi bul
              </Text>
            </View>
            <TouchableOpacity onPress={(e) => { e.stopPropagation(); setShowBuddyBanner(false); }}>
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Feed */}
      {loading && posts.length === 0 ? (
        <View style={styles.skeletonContainer}>
          <PostCardSkeleton />
          <PostCardSkeleton />
          <PostCardSkeleton />
        </View>
      ) : (
        <FlatList
          data={filteredPosts}
          keyExtractor={(item) => item.id}
          renderItem={renderPost}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={filteredPosts.length === 0 ? styles.emptyList : { paddingBottom: 100 }}
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
  },


  // Search Bar
  searchBarContainer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    paddingVertical: 0,
  },

  // Category Chips with animated indicator
  categoryRow: {
    paddingBottom: Spacing.md,
  },
  categoryScroll: {
    paddingHorizontal: Spacing.xl,
  },
  chipContainer: {
    flexDirection: 'row',
    position: 'relative',
    gap: Spacing.sm,
  },
  chipIndicator: {
    position: 'absolute',
    top: 0,
    height: '100%',
    borderRadius: BorderRadius.xxl,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.xxl,
  },
  categoryChipText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodySemiBold,
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },

  // Skeleton loading
  skeletonContainer: {
    flex: 1,
    paddingTop: Spacing.md,
  },

  // Footer loader
  footerLoader: {
    paddingVertical: Spacing.md,
  },

  // Empty State
  emptyList: {
    flexGrow: 1,
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
