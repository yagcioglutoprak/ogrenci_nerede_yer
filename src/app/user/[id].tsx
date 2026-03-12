import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { useMessageStore } from '../../stores/messageStore';
import { supabase } from '../../lib/supabase';
import { MOCK_USERS, MOCK_POSTS, MOCK_POST_IMAGES } from '../../lib/mockData';
import { Spacing, BorderRadius, FontSize, FontFamily } from '../../lib/constants';
import Avatar from '../../components/ui/Avatar';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { User, Post } from '../../types';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const currentUser = useAuthStore((s) => s.user);
  const GRID_ITEM_WIDTH = (screenWidth - Spacing.lg * 2 - Spacing.md) / 2;

  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState({ posts: 0, followers: 0, following: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) loadUserProfile(id);
  }, [id]);

  const loadUserProfile = async (userId: string) => {
    setLoading(true);

    try {
      // Fetch user profile
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userData) {
        setProfileUser(userData as User);
      } else {
        // Mock fallback
        const mockUser = MOCK_USERS.find((u) => u.id === userId) || null;
        setProfileUser(mockUser);
      }

      // Fetch user posts
      const { data: postsData } = await supabase
        .from('posts')
        .select('*, images:post_images(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (postsData && postsData.length > 0) {
        setUserPosts(postsData as Post[]);
      } else {
        // Mock fallback
        const mockPosts = MOCK_POSTS
          .filter((p) => p.user_id === userId)
          .map((p) => ({
            ...p,
            images: MOCK_POST_IMAGES.filter((img) => img.post_id === p.id),
          }));
        setUserPosts(mockPosts as Post[]);
      }

      // Fetch stats
      const [{ count: postsCount }, { count: followersCount }, { count: followingCount }] =
        await Promise.all([
          supabase.from('posts').select('*', { count: 'exact', head: true }).eq('user_id', userId),
          supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
          supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
        ]);

      setStats({
        posts: postsCount ?? 0,
        followers: followersCount ?? 0,
        following: followingCount ?? 0,
      });

      // Check if current user follows this user
      if (currentUser) {
        const { data: followData } = await supabase
          .from('follows')
          .select('*')
          .eq('follower_id', currentUser.id)
          .eq('following_id', userId)
          .single();
        setIsFollowing(!!followData);
      }
    } catch {
      // Mock fallback
      const mockUser = MOCK_USERS.find((u) => u.id === userId) || null;
      setProfileUser(mockUser);
      const mockPosts = MOCK_POSTS
        .filter((p) => p.user_id === userId)
        .map((p) => ({
          ...p,
          images: MOCK_POST_IMAGES.filter((img) => img.post_id === p.id),
        }));
      setUserPosts(mockPosts as Post[]);
    }

    setLoading(false);
  };

  const handleFollowToggle = async () => {
    if (!currentUser || !id) {
      router.push('/auth/login');
      return;
    }

    const prevFollowing = isFollowing;
    const prevStats = { ...stats };

    if (isFollowing) {
      // Optimistic update
      setIsFollowing(false);
      setStats((s) => ({ ...s, followers: Math.max(0, s.followers - 1) }));

      supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUser.id)
        .eq('following_id', id)
        .then(({ error }) => {
          if (error) {
            // Rollback on failure
            setIsFollowing(prevFollowing);
            setStats(prevStats);
          }
        });
    } else {
      // Optimistic update
      setIsFollowing(true);
      setStats((s) => ({ ...s, followers: s.followers + 1 }));

      supabase
        .from('follows')
        .insert({
          follower_id: currentUser.id,
          following_id: id,
        })
        .then(({ error }) => {
          if (error) {
            // Rollback on failure
            setIsFollowing(prevFollowing);
            setStats(prevStats);
          }
        });
    }
  };

  const handleMessage = async () => {
    if (!currentUser || !id) {
      router.push('/auth/login');
      return;
    }
    const convId = await useMessageStore.getState().fetchOrCreateConversation(currentUser.id, id);
    if (convId) {
      router.push(`/chat/${convId}`);
    }
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={[styles.loadingScreen, { backgroundColor: colors.background }]} edges={['top']}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  // Not found state
  if (!profileUser) {
    return (
      <SafeAreaView style={[styles.loadingScreen, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.headerBar, { backgroundColor: colors.background, borderBottomColor: colors.borderLight }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Profil</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.notFoundContent}>
          <Ionicons name="person-outline" size={48} color={colors.textTertiary} />
          <Text style={[styles.notFoundText, { color: colors.textSecondary }]}>Kullanıcı bulunamadı</Text>
          <TouchableOpacity
            style={[styles.notFoundBackButton, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={styles.notFoundBackButtonText}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isOwnProfile = currentUser?.id === profileUser.id;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundSecondary }]} edges={['top']}>
      {/* Header bar */}
      <View style={[styles.headerBar, { backgroundColor: colors.background, borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{profileUser.username}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scrollContent, { paddingBottom: Spacing.xxl + insets.bottom }]}>
        {/* Profile card */}
        <View style={[styles.profileCard, { backgroundColor: colors.background, borderColor: colors.border, shadowColor: colors.shadow }]}>
          <Avatar
            uri={profileUser.avatar_url}
            name={profileUser.full_name || profileUser.username}
            size={72}
          />
          <Text style={[styles.profileName, { color: colors.text }]}>{profileUser.full_name}</Text>
          <Text style={[styles.profileUsername, { color: colors.textSecondary }]}>@{profileUser.username}</Text>

          {profileUser.university && (
            <View style={[styles.universityRow, { backgroundColor: colors.backgroundSecondary }]}>
              <Ionicons name="school-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.universityText, { color: colors.textSecondary }]}>{profileUser.university}</Text>
            </View>
          )}

          {profileUser.bio && (
            <Text style={[styles.bioText, { color: colors.text }]}>{profileUser.bio}</Text>
          )}

          {/* Action buttons */}
          {!isOwnProfile && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[
                  styles.followButton,
                  { backgroundColor: colors.primary, shadowColor: colors.primary },
                  isFollowing && { backgroundColor: colors.backgroundSecondary, borderWidth: 1.5, borderColor: colors.primary, shadowOpacity: 0, elevation: 0 },
                ]}
                onPress={handleFollowToggle}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={isFollowing ? 'checkmark' : 'person-add-outline'}
                  size={16}
                  color={isFollowing ? colors.primary : '#FFFFFF'}
                />
                <Text style={[styles.followButtonText, isFollowing && { color: colors.primary }]}>
                  {isFollowing ? 'Takip Ediliyor' : 'Takip Et'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.messageButton, { borderColor: colors.primary }]}
                onPress={handleMessage}
                activeOpacity={0.8}
              >
                <Ionicons name="chatbubble-outline" size={16} color={colors.primary} />
                <Text style={[styles.messageButtonText, { color: colors.primary }]}>Mesaj At</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={[styles.statsCard, { backgroundColor: colors.background, borderColor: colors.border, shadowColor: colors.shadow }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.posts}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Gönderi</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.followers}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Takipçi</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.following}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Takip</Text>
          </View>
        </View>

        {/* Posts grid */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Gönderiler</Text>
        </View>

        {userPosts.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIconCircle, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
              <Ionicons name="camera-outline" size={32} color={colors.textTertiary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Henüz gönderi yok</Text>
          </View>
        ) : (
          <View style={styles.gridContainer}>
            {userPosts.map((post) => {
              const firstImage = post.images?.[0]?.image_url;
              return (
                <TouchableOpacity
                  key={post.id}
                  style={[styles.gridItem, { width: GRID_ITEM_WIDTH, backgroundColor: colors.background, borderColor: colors.border, shadowColor: colors.shadow }]}
                  onPress={() => router.push(`/post/${post.id}`)}
                  activeOpacity={0.85}
                >
                  <View style={styles.gridImageWrapper}>
                    {firstImage ? (
                      <Image source={{ uri: firstImage }} style={styles.gridImage} />
                    ) : (
                      <View style={[styles.gridImage, styles.gridImagePlaceholder, { backgroundColor: colors.backgroundSecondary }]}>
                        <Ionicons name="document-text-outline" size={28} color={colors.textTertiary} />
                      </View>
                    )}
                    {post.images && post.images.length > 1 && (
                      <View style={styles.multiImageBadge}>
                        <Ionicons name="copy-outline" size={12} color="#FFFFFF" />
                      </View>
                    )}
                  </View>
                  <View style={styles.gridItemInfo}>
                    <Text style={[styles.gridItemCaption, { color: colors.text }]} numberOfLines={2}>
                      {post.caption || 'Gönderi'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Not found
  notFoundContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    paddingBottom: 80,
  },
  notFoundText: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.headingBold,
  },
  notFoundBackButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  notFoundBackButtonText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
    color: '#FFFFFF',
  },

  // Header
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.headingBold,
  },

  scrollContent: {
    paddingBottom: 40,
  },

  // Profile card
  profileCard: {
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  profileName: {
    fontSize: 22,
    fontFamily: FontFamily.heading,
    marginTop: Spacing.md,
    letterSpacing: -0.3,
  },
  profileUsername: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    marginTop: Spacing.xs,
  },
  universityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
  },
  universityText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  bioText: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderWidth: 1.5,
  },
  messageButtonText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
  },
  followButtonText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
    color: '#FFFFFF',
  },

  // Stats
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    paddingVertical: Spacing.lg + 2,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: FontSize.xl,
    fontFamily: FontFamily.heading,
  },
  statLabel: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    marginTop: Spacing.xs,
  },
  statDivider: {
    width: 1,
    height: 32,
  },

  // Section
  sectionHeader: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.headingBold,
  },

  // Empty
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: Spacing.xxxl,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.headingBold,
  },

  // Grid
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  gridItem: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  gridImageWrapper: {
    width: '100%',
    aspectRatio: 4 / 3,
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridItemInfo: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  gridItemCaption: {
    fontSize: FontSize.sm,
    lineHeight: 18,
  },
  multiImageBadge: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
});
