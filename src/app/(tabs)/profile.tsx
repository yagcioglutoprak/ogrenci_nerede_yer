import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  useWindowDimensions,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { useAuthStore } from '../../stores/authStore';
import { useListStore } from '../../stores/listStore';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontSize,
  FontFamily,
} from '../../lib/constants';
import { haptic } from '../../lib/haptics';
import Avatar from '../../components/ui/Avatar';
import GlassView from '../../components/ui/GlassView';
import EmptyState from '../../components/ui/EmptyState';
import BadgeCard from '../../components/ui/BadgeCard';
import ScreenHeader from '../../components/ui/ScreenHeader';
import { ProfileSkeleton } from '../../components/ui/Skeleton';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { Venue, Post, Badge } from '../../types';
import { supabase } from '../../lib/supabase';
import { MOCK_BADGES, MOCK_VENUES, MOCK_POSTS, MOCK_POST_IMAGES } from '../../lib/mockData';

const COVER_HEIGHT = 160;

type ProfileTab = 'favorites' | 'posts' | 'lists';

// Animated stat counter that springs to value
function AnimatedStat({ value, label, icon, color, delay }: {
  value: number;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  delay: number;
}) {
  const colors = useThemeColors();
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withSpring(1, { damping: 15, stiffness: 120 }));
  }, [value]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [12, 0]) },
      { scale: interpolate(progress.value, [0, 1], [0.8, 1]) },
    ],
  }));

  return (
    <Animated.View style={[styles.statItem, animStyle]}>
      <View style={[styles.statIconCircle, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textTertiary }]}>{label}</Text>
    </Animated.View>
  );
}

// XP Progress Bar
function XPProgressBar({ xp, colors }: { xp: number; colors: any }) {
  const progress = useSharedValue(0);
  const nextLevel = Math.ceil(xp / 500) * 500;
  const currentLevelBase = nextLevel - 500;
  const pct = Math.min((xp - currentLevelBase) / 500, 1);

  useEffect(() => {
    progress.value = withDelay(600, withSpring(pct, { damping: 18, stiffness: 100 }));
  }, [xp]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%` as any,
  }));

  return (
    <View style={styles.xpContainer}>
      <View style={styles.xpHeader}>
        <View style={styles.xpLabelRow}>
          <Ionicons name="flash" size={14} color={Colors.accent} />
          <Text style={[styles.xpLabel, { color: colors.text }]}>{xp} XP</Text>
        </View>
        <Text style={[styles.xpNext, { color: colors.textTertiary }]}>
          Sonraki: {nextLevel} XP
        </Text>
      </View>
      <View style={[styles.xpTrack, { backgroundColor: colors.border }]}>
        <Animated.View style={[styles.xpFill, barStyle]}>
          <LinearGradient
            colors={[Colors.accent, Colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const colors = useThemeColors();
  const { userLists, fetchUserLists } = useListStore();

  const [activeTab, setActiveTab] = useState<ProfileTab>('favorites');
  const [favorites, setFavorites] = useState<Venue[]>([]);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState({ venues: 0, reviews: 0, followers: 0, following: 0 });
  const [badges, setBadges] = useState<{badge: Badge; earned: boolean; earned_at?: string}[]>([]);
  const [loading, setLoading] = useState(false);

  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const TAB_THIRD = (screenWidth - Spacing.lg * 2) / 3;
  const GRID_ITEM_WIDTH = (screenWidth - Spacing.lg * 2 - Spacing.md) / 2;

  // Tab indicator animation
  const tabIndicatorX = useSharedValue(0);
  const tabIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tabIndicatorX.value }],
  }));

  useEffect(() => {
    tabIndicatorX.value = withSpring(
      activeTab === 'favorites' ? 0 : activeTab === 'posts' ? TAB_THIRD : TAB_THIRD * 2,
      { damping: 18, stiffness: 200 },
    );
  }, [activeTab, TAB_THIRD]);

  useEffect(() => {
    if (user) {
      loadProfile();
      fetchUserLists(user.id);
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data: favData } = await supabase
        .from('favorites')
        .select('*, venue:venues(*)')
        .eq('user_id', user.id);

      if (favData) {
        setFavorites(favData.map((f: any) => f.venue).filter(Boolean));
      }

      const { data: postsData } = await supabase
        .from('posts')
        .select('*, images:post_images(*), venue:venues(id, name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (postsData) {
        setUserPosts(postsData as Post[]);
      }

      const [{ count: venuesCount }, { count: reviewsCount }, { count: followersCount }, { count: followingCount }] =
        await Promise.all([
          supabase
            .from('venues')
            .select('*', { count: 'exact', head: true })
            .eq('created_by', user.id),
          supabase
            .from('reviews')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id),
          supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('following_id', user.id),
          supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('follower_id', user.id),
        ]);

      setStats({
        venues: venuesCount ?? 0,
        reviews: reviewsCount ?? 0,
        followers: followersCount ?? 0,
        following: followingCount ?? 0,
      });

      // Fetch badges
      const { data: allBadges } = await supabase
        .from('badges')
        .select('*');
      const { data: userBadges } = await supabase
        .from('user_badges')
        .select('*')
        .eq('user_id', user.id);

      const earnedIds = new Set((userBadges || []).map((ub: any) => ub.badge_id));
      const badgeList = (allBadges || MOCK_BADGES).map((b: Badge) => ({
        badge: b,
        earned: earnedIds.has(b.id),
        earned_at: (userBadges || []).find((ub: any) => ub.badge_id === b.id)?.earned_at,
      }));
      setBadges(badgeList);
    } catch {
      // Only set mock data if we haven't loaded any real data yet
      if (favorites.length === 0) {
        setFavorites(MOCK_VENUES.slice(0, 4));
      }

      if (userPosts.length === 0) {
        const mockUserPosts = MOCK_POSTS
          .slice(0, 4)
          .map((p) => ({
            ...p,
            images: MOCK_POST_IMAGES.filter((img) => img.post_id === p.id),
          }));
        setUserPosts(mockUserPosts as Post[]);
      }

      if (stats.venues === 0 && stats.reviews === 0) {
        setStats({
          venues: 3,
          reviews: 7,
          followers: 12,
          following: 5,
        });
      }

      if (badges.length === 0) {
        const mockBadgeList = MOCK_BADGES.map((b, i) => ({
          badge: b,
          earned: i < 2,
          earned_at: i < 2 ? new Date().toISOString() : undefined,
        }));
        setBadges(mockBadgeList);
      }
    }

    setLoading(false);
  };

  const handleSignOut = () => {
    Alert.alert('Cikis Yap', 'Hesabinizdan cikis yapmak istediginize emin misiniz?', [
      { text: 'Iptal', style: 'cancel' },
      {
        text: 'Cikis Yap',
        style: 'destructive',
        onPress: () => signOut(),
      },
    ]);
  };

  // =============================================
  // NOT LOGGED IN
  // =============================================
  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <LinearGradient
          colors={[colors.background, colors.backgroundSecondary]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.loginPrompt}>
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <LinearGradient
              colors={[Colors.primary, Colors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.loginIconCircle}
            >
              <Ionicons name="person-outline" size={36} color="#FFFFFF" />
            </LinearGradient>
          </Animated.View>

          <Animated.Text
            entering={FadeInDown.delay(200).springify()}
            style={[styles.loginTitle, { color: colors.text }]}
          >
            Hesabina Giris Yap
          </Animated.Text>
          <Animated.Text
            entering={FadeInDown.delay(300).springify()}
            style={[styles.loginSubtitle, { color: colors.textSecondary }]}
          >
            Favori mekanlarini kaydet, yorumlarini paylas{'\n'}ve topluluga katil!
          </Animated.Text>

          <Animated.View entering={FadeInUp.delay(400).springify()} style={{ width: '100%' }}>
            <TouchableOpacity
              style={styles.loginButton}
              onPress={() => router.push('/auth/login')}
              activeOpacity={0.8}
            >
              <Ionicons name="log-in-outline" size={20} color="#FFFFFF" />
              <Text style={styles.loginButtonText}>Giris Yap</Text>
            </TouchableOpacity>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(500).springify()}>
            <TouchableOpacity
              onPress={() => router.push('/auth/register')}
              style={styles.registerRow}
            >
              <Text style={[styles.registerText, { color: colors.textSecondary }]}>
                Hesabin yok mu?{' '}
                <Text style={styles.registerTextBold}>Kayit Ol</Text>
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </SafeAreaView>
    );
  }

  // =============================================
  // LOGGED IN
  // =============================================
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <LinearGradient
        colors={[colors.background, colors.backgroundSecondary]}
        style={StyleSheet.absoluteFill}
      />

      <ScreenHeader
        title="Profil"
        rightAction={{
          icon: 'settings-outline',
          onPress: () => router.push('/settings'),
        }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 80 + insets.bottom }]}
      >
        {loading ? (
          <ProfileSkeleton />
        ) : (
          <>
            {/* Cover + Avatar Section */}
            <Animated.View entering={FadeInDown.delay(0).springify()}>
              <View style={styles.coverSection}>
                <LinearGradient
                  colors={[Colors.primary, Colors.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.coverGradient}
                >
                  {/* Decorative circles */}
                  <View style={[styles.coverCircle, { top: -20, right: -20, opacity: 0.12 }]} />
                  <View style={[styles.coverCircle, { bottom: -30, left: 20, opacity: 0.08, width: 80, height: 80 }]} />
                </LinearGradient>

                {/* Avatar overlapping */}
                <View style={styles.avatarContainer}>
                  <View style={[styles.avatarRing, { borderColor: colors.background }]}>
                    <Avatar
                      uri={user.avatar_url}
                      name={user.full_name || user.username}
                      size={76}
                    />
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* Name + Info */}
            <Animated.View
              entering={FadeInDown.delay(100).springify()}
              style={styles.profileInfo}
            >
              <Text style={[styles.profileName, { color: colors.text }]}>{user.full_name}</Text>
              <Text style={[styles.profileUsername, { color: colors.textSecondary }]}>@{user.username}</Text>

              {user.university && (
                <View style={[styles.universityRow, { backgroundColor: colors.backgroundSecondary }]}>
                  <Ionicons name="school-outline" size={13} color={colors.textSecondary} />
                  <Text style={[styles.universityText, { color: colors.textSecondary }]}>{user.university}</Text>
                </View>
              )}

              {user.bio && (
                <Text style={[styles.bioText, { color: colors.text }]}>{user.bio}</Text>
              )}
            </Animated.View>

            {/* XP Progress Bar */}
            <Animated.View entering={FadeInDown.delay(200).springify()}>
              <View style={{ paddingHorizontal: Spacing.lg, marginTop: Spacing.md }}>
                <XPProgressBar xp={user.xp_points || 250} colors={colors} />
              </View>
            </Animated.View>

            {/* Stats Row — animated counters */}
            <Animated.View entering={FadeInDown.delay(300).springify()}>
              <GlassView
                style={[styles.statsCard, Platform.OS === 'ios' && styles.statsCardGlass, { backgroundColor: colors.background, borderColor: colors.border }]}
                fallbackColor={colors.background}
              >
                <AnimatedStat value={stats.venues} label="Kesif" icon="compass-outline" color={Colors.primary} delay={400} />
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <AnimatedStat value={stats.reviews} label="Yorum" icon="chatbubble-outline" color={Colors.accent} delay={500} />
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <AnimatedStat value={stats.followers} label="Takipci" icon="people-outline" color="#8B5CF6" delay={600} />
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <AnimatedStat value={stats.following} label="Takip" icon="person-add-outline" color="#14B8A6" delay={700} />
              </GlassView>
            </Animated.View>

            {/* Tab Switch — with animated indicator */}
            <Animated.View entering={FadeInDown.delay(400).springify()}>
              <View style={[styles.tabContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Animated.View
                  style={[
                    styles.tabIndicator,
                    { backgroundColor: Colors.primary },
                    tabIndicatorStyle,
                    { width: TAB_THIRD },
                  ]}
                />
                <TouchableOpacity
                  style={styles.tabButton}
                  onPress={() => { haptic.selection(); setActiveTab('favorites'); }}
                  activeOpacity={0.7}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeTab === 'favorites' }}
                >
                  <Ionicons
                    name={activeTab === 'favorites' ? 'heart' : 'heart-outline'}
                    size={16}
                    color={activeTab === 'favorites' ? '#FFFFFF' : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.tabText,
                      activeTab === 'favorites' ? styles.tabTextActive : { color: colors.textSecondary },
                    ]}
                  >
                    Favorilerim
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.tabButton}
                  onPress={() => { haptic.selection(); setActiveTab('posts'); }}
                  activeOpacity={0.7}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeTab === 'posts' }}
                >
                  <Ionicons
                    name={activeTab === 'posts' ? 'grid' : 'grid-outline'}
                    size={16}
                    color={activeTab === 'posts' ? '#FFFFFF' : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.tabText,
                      activeTab === 'posts' ? styles.tabTextActive : { color: colors.textSecondary },
                    ]}
                  >
                    Gonderilerim
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.tabButton}
                  onPress={() => { haptic.selection(); setActiveTab('lists'); }}
                  activeOpacity={0.7}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: activeTab === 'lists' }}
                >
                  <Ionicons
                    name={activeTab === 'lists' ? 'list' : 'list-outline'}
                    size={16}
                    color={activeTab === 'lists' ? '#FFFFFF' : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.tabText,
                      activeTab === 'lists' ? styles.tabTextActive : { color: colors.textSecondary },
                    ]}
                  >
                    Listelerim
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>

            {/* Badges Section */}
            {badges.length > 0 && (
              <Animated.View entering={FadeInDown.delay(450).springify()}>
                <View style={styles.badgesSection}>
                  <View style={styles.badgesSectionHeader}>
                    <Ionicons name="trophy" size={18} color={Colors.accent} />
                    <Text style={[styles.badgesSectionTitle, { color: colors.text }]}>Rozetlerim</Text>
                    <Text style={[styles.badgesSectionCount, { color: colors.textTertiary }]}>
                      {badges.filter(b => b.earned).length}/{badges.length}
                    </Text>
                  </View>
                  <View style={styles.badgesList}>
                    {badges.map((item) => (
                      <BadgeCard
                        key={item.badge.id}
                        badge={item.badge}
                        earned={item.earned}
                        earnedAt={item.earned_at}
                      />
                    ))}
                  </View>
                </View>
              </Animated.View>
            )}

            {/* Content Area */}
            {activeTab === 'favorites' ? (
              favorites.length === 0 ? (
                <EmptyState
                  variant="favorites"
                  title="Henuz favori mekanin yok"
                  subtitle="Mekanlari kesfet ve favorilerine ekle!"
                />
              ) : (
                <View style={styles.gridContainer}>
                  {favorites.map((venue, index) => (
                    <Animated.View
                      key={venue.id}
                      entering={FadeInDown.delay(Math.min(index * 60, 300)).springify()}
                    >
                      <TouchableOpacity
                        style={[styles.gridItem, { width: GRID_ITEM_WIDTH }, { backgroundColor: colors.background, borderColor: colors.border }]}
                        onPress={() => router.push(`/venue/${venue.id}`)}
                        activeOpacity={0.85}
                      >
                        <View style={styles.gridImageWrapper}>
                          {venue.cover_image_url ? (
                            <Image
                              source={{ uri: venue.cover_image_url }}
                              style={styles.gridImage}
                            />
                          ) : (
                            <View style={[styles.gridImage, styles.gridImagePlaceholder, { backgroundColor: colors.backgroundSecondary }]}>
                              <Ionicons
                                name="restaurant-outline"
                                size={28}
                                color={colors.textTertiary}
                              />
                            </View>
                          )}
                        </View>
                        <View style={styles.gridItemInfo}>
                          <Text style={[styles.gridItemName, { color: colors.text }]} numberOfLines={1}>
                            {venue.name}
                          </Text>
                          <View style={styles.gridItemRating}>
                            <Ionicons name="star" size={12} color={Colors.star} />
                            <Text style={[styles.gridItemRatingText, { color: colors.textSecondary }]}>
                              {venue.overall_rating.toFixed(1)}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    </Animated.View>
                  ))}
                </View>
              )
            ) : activeTab === 'posts' ? (
              userPosts.length === 0 ? (
                <EmptyState
                  variant="posts"
                  title="Henuz gonderin yok"
                  subtitle="Deneyimlerini paylasmaya basla!"
                />
              ) : (
                <View style={styles.gridContainer}>
                  {userPosts.map((post, index) => {
                    const firstImage = post.images?.[0]?.image_url;
                    return (
                      <Animated.View
                        key={post.id}
                        entering={FadeInDown.delay(Math.min(index * 60, 300)).springify()}
                      >
                        <TouchableOpacity
                          style={[styles.gridItem, { width: GRID_ITEM_WIDTH }, { backgroundColor: colors.background, borderColor: colors.border }]}
                          onPress={() => router.push(`/post/${post.id}`)}
                          activeOpacity={0.85}
                        >
                          <View style={styles.gridImageWrapper}>
                            {firstImage ? (
                              <Image
                                source={{ uri: firstImage }}
                                style={styles.gridImage}
                              />
                            ) : (
                              <View style={[styles.gridImage, styles.gridImagePlaceholder, { backgroundColor: colors.backgroundSecondary }]}>
                                <Ionicons
                                  name="document-text-outline"
                                  size={28}
                                  color={colors.textTertiary}
                                />
                              </View>
                            )}
                            {post.images && post.images.length > 1 && (
                              <View style={styles.multiImageBadge}>
                                <Ionicons name="copy-outline" size={12} color="#FFFFFF" />
                                <Text style={styles.multiImageCount}>{post.images.length}</Text>
                              </View>
                            )}
                          </View>
                          <View style={styles.gridItemInfo}>
                            <Text style={[styles.gridItemCaption, { color: colors.text }]} numberOfLines={2}>
                              {post.caption || 'Gonderi'}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      </Animated.View>
                    );
                  })}
                </View>
              )
            ) : (
              <View style={{ paddingHorizontal: Spacing.lg, gap: Spacing.md }}>
                <TouchableOpacity
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                    padding: Spacing.md, borderRadius: BorderRadius.md,
                    borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.primary,
                    gap: Spacing.sm,
                  }}
                  onPress={() => router.push('/list/create')}
                >
                  <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                  <Text style={{ color: Colors.primary, fontFamily: FontFamily.bodySemiBold, fontSize: FontSize.md }}>
                    Yeni Liste Olustur
                  </Text>
                </TouchableOpacity>
                {userLists.map((list) => (
                  <TouchableOpacity
                    key={list.id}
                    style={{
                      flexDirection: 'row', alignItems: 'center',
                      padding: Spacing.md, borderRadius: BorderRadius.md,
                      backgroundColor: colors.backgroundSecondary, borderWidth: 1, borderColor: colors.border,
                      gap: Spacing.md,
                    }}
                    onPress={() => router.push(`/list/${list.id}`)}
                  >
                    {list.cover_image_url ? (
                      <Image source={{ uri: list.cover_image_url }} style={{ width: 50, height: 50, borderRadius: BorderRadius.sm }} />
                    ) : (
                      <View style={{ width: 50, height: 50, borderRadius: BorderRadius.sm, backgroundColor: Colors.primarySoft, justifyContent: 'center', alignItems: 'center' }}>
                        <Ionicons name="list" size={20} color={Colors.primary} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontFamily: FontFamily.bodySemiBold, fontSize: FontSize.md }}>{list.title}</Text>
                      <Text style={{ color: colors.textSecondary, fontFamily: FontFamily.body, fontSize: FontSize.xs }}>
                        {list.venues?.length || 0} mekan
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// =============================================
// STYLES
// =============================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Scroll
  scrollContent: {},

  // =========================================
  // LOGIN PROMPT (not logged in)
  // =========================================
  loginPrompt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxxl + 8,
  },
  loginIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xxl,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  loginTitle: {
    fontSize: FontSize.xxl,
    fontFamily: FontFamily.heading,
    marginBottom: Spacing.sm,
  },
  loginSubtitle: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xxl,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    width: '100%',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: Spacing.lg,
  },
  loginButtonText: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.headingBold,
    color: '#FFFFFF',
  },
  registerRow: {
    paddingVertical: Spacing.sm,
  },
  registerText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
  },
  registerTextBold: {
    color: Colors.primary,
    fontFamily: FontFamily.headingBold,
  },

  // =========================================
  // COVER + AVATAR
  // =========================================
  coverSection: {
    height: COVER_HEIGHT + 44, // extra space for avatar overlap
    position: 'relative',
  },
  coverGradient: {
    height: COVER_HEIGHT,
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  coverCircle: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFFFFF',
  },
  avatarContainer: {
    position: 'absolute',
    bottom: 0,
    alignSelf: 'center',
  },
  avatarRing: {
    borderWidth: 4,
    borderRadius: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },

  // =========================================
  // PROFILE INFO
  // =========================================
  profileInfo: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.sm,
  },
  profileName: {
    fontSize: 22,
    fontFamily: FontFamily.heading,
    letterSpacing: -0.3,
  },
  profileUsername: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodyMedium,
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
    fontFamily: FontFamily.bodyMedium,
  },
  bioText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },

  // =========================================
  // XP PROGRESS BAR
  // =========================================
  xpContainer: {
    gap: Spacing.sm,
  },
  xpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  xpLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  xpLabel: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.headingBold,
  },
  xpNext: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
  },
  xpTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    borderRadius: 3,
    overflow: 'hidden',
  },

  // =========================================
  // STATS CARD
  // =========================================
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  statsCardGlass: {
    borderWidth: 0,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: FontSize.xl,
    fontFamily: FontFamily.heading,
  },
  statLabel: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodyMedium,
  },
  statDivider: {
    width: 1,
    height: 36,
  },

  // =========================================
  // TAB SWITCH
  // =========================================
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  tabIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    borderRadius: BorderRadius.lg - 1,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md + 2,
    zIndex: 1,
  },
  tabText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodySemiBold,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontFamily: FontFamily.headingBold,
  },

  // =========================================
  // BADGES SECTION
  // =========================================
  badgesSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  badgesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  badgesSectionTitle: {
    flex: 1,
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
  },
  badgesSectionCount: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodySemiBold,
  },
  badgesList: {
    gap: Spacing.sm,
  },

  // =========================================
  // GRID
  // =========================================
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
    shadowColor: '#000',
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
  gridItemName: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.headingBold,
  },
  gridItemRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: Spacing.xs,
  },
  gridItemRatingText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemiBold,
  },
  gridItemCaption: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    lineHeight: 18,
  },
  multiImageBadge: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  multiImageCount: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemiBold,
    color: '#FFFFFF',
  },
});
