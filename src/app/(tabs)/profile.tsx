import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontSize,
} from '../../lib/constants';
import Avatar from '../../components/ui/Avatar';
import type { Venue, Post } from '../../types';
import { supabase } from '../../lib/supabase';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type ProfileTab = 'favorites' | 'posts';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuthStore();

  const [activeTab, setActiveTab] = useState<ProfileTab>('favorites');
  const [favorites, setFavorites] = useState<Venue[]>([]);
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState({ venues: 0, reviews: 0, followers: 0 });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch favorites
      const { data: favData } = await supabase
        .from('favorites')
        .select('*, venue:venues(*)')
        .eq('user_id', user.id);

      if (favData) {
        setFavorites(favData.map((f: any) => f.venue).filter(Boolean));
      }

      // Fetch user posts
      const { data: postsData } = await supabase
        .from('posts')
        .select('*, images:post_images(*), venue:venues(id, name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (postsData) {
        setUserPosts(postsData as Post[]);
      }

      // Fetch stats
      const [{ count: venuesCount }, { count: reviewsCount }, { count: followersCount }] =
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
        ]);

      setStats({
        venues: venuesCount ?? 0,
        reviews: reviewsCount ?? 0,
        followers: followersCount ?? 0,
      });
    } catch {
      // Silent fail
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
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loginPrompt}>
          <View style={styles.loginIconCircle}>
            <Ionicons name="person-outline" size={40} color="#FFFFFF" />
          </View>

          <Text style={styles.loginTitle}>Hesabina Giris Yap</Text>
          <Text style={styles.loginSubtitle}>
            Favori mekanlarini kaydet, yorumlarini paylas{'\n'}ve topluluga katil!
          </Text>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push('/auth/login')}
            activeOpacity={0.8}
          >
            <Ionicons name="log-in-outline" size={20} color="#FFFFFF" />
            <Text style={styles.loginButtonText}>Giris Yap</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/auth/register')}
            style={styles.registerRow}
          >
            <Text style={styles.registerText}>
              Hesabin yok mu?{' '}
              <Text style={styles.registerTextBold}>Kayit Ol</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // =============================================
  // LOGGED IN
  // =============================================
  const GRID_ITEM_WIDTH = (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.md) / 2;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header bar */}
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Profil</Text>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={handleSignOut}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="settings-outline" size={22} color={Colors.textTertiary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Header Card */}
        <View style={styles.profileCard}>
          <Avatar
            uri={user.avatar_url}
            name={user.full_name || user.username}
            size={72}
          />
          <Text style={styles.profileName}>{user.full_name}</Text>
          <Text style={styles.profileUsername}>@{user.username}</Text>

          {user.university && (
            <View style={styles.universityRow}>
              <Ionicons name="school-outline" size={14} color={Colors.textSecondary} />
              <Text style={styles.universityText}>{user.university}</Text>
            </View>
          )}

          {user.bio && (
            <Text style={styles.bioText}>{user.bio}</Text>
          )}

          {/* XP Badge */}
          <View style={styles.xpBadge}>
            <Ionicons name="star" size={14} color={Colors.accent} />
            <Text style={styles.xpText}>{user.xp_points || 250} XP</Text>
          </View>
        </View>

        {/* Stats Row */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.venues}</Text>
            <Text style={styles.statLabel}>Kesif</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.reviews}</Text>
            <Text style={styles.statLabel}>Yorum</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.followers}</Text>
            <Text style={styles.statLabel}>Takipci</Text>
          </View>
        </View>

        {/* Tab Switch */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'favorites' && styles.tabButtonActive]}
            onPress={() => setActiveTab('favorites')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === 'favorites' ? 'heart' : 'heart-outline'}
              size={18}
              color={activeTab === 'favorites' ? Colors.primary : Colors.textSecondary}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'favorites' && styles.tabTextActive,
              ]}
            >
              Favorilerim
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'posts' && styles.tabButtonActive]}
            onPress={() => setActiveTab('posts')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={activeTab === 'posts' ? 'grid' : 'grid-outline'}
              size={18}
              color={activeTab === 'posts' ? Colors.primary : Colors.textSecondary}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'posts' && styles.tabTextActive,
              ]}
            >
              Gonderilerim
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content Area */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : activeTab === 'favorites' ? (
          favorites.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="heart-outline" size={32} color={Colors.textTertiary} />
              </View>
              <Text style={styles.emptyTitle}>Henuz favori mekanin yok</Text>
              <Text style={styles.emptySubtitle}>
                Mekanlari kesfet ve favorilerine ekle!
              </Text>
            </View>
          ) : (
            <View style={styles.gridContainer}>
              {favorites.map((venue) => (
                <TouchableOpacity
                  key={venue.id}
                  style={[styles.gridItem, { width: GRID_ITEM_WIDTH }]}
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
                      <View style={[styles.gridImage, styles.gridImagePlaceholder]}>
                        <Ionicons
                          name="restaurant-outline"
                          size={28}
                          color={Colors.textTertiary}
                        />
                      </View>
                    )}
                  </View>
                  <View style={styles.gridItemInfo}>
                    <Text style={styles.gridItemName} numberOfLines={1}>
                      {venue.name}
                    </Text>
                    <View style={styles.gridItemRating}>
                      <Ionicons name="star" size={12} color={Colors.star} />
                      <Text style={styles.gridItemRatingText}>
                        {venue.overall_rating.toFixed(1)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )
        ) : userPosts.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="camera-outline" size={32} color={Colors.textTertiary} />
            </View>
            <Text style={styles.emptyTitle}>Henuz gonderin yok</Text>
            <Text style={styles.emptySubtitle}>
              Deneyimlerini paylasmaya basla!
            </Text>
          </View>
        ) : (
          <View style={styles.gridContainer}>
            {userPosts.map((post) => {
              const firstImage = post.images?.[0]?.image_url;
              return (
                <TouchableOpacity
                  key={post.id}
                  style={[styles.gridItem, { width: GRID_ITEM_WIDTH }]}
                  activeOpacity={0.85}
                >
                  <View style={styles.gridImageWrapper}>
                    {firstImage ? (
                      <Image
                        source={{ uri: firstImage }}
                        style={styles.gridImage}
                      />
                    ) : (
                      <View style={[styles.gridImage, styles.gridImagePlaceholder]}>
                        <Ionicons
                          name="document-text-outline"
                          size={28}
                          color={Colors.textTertiary}
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
                    <Text style={styles.gridItemCaption} numberOfLines={2}>
                      {post.caption || 'Gonderi'}
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

// =============================================
// STYLES
// =============================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundSecondary,
  },

  // Header Bar
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Scroll
  scrollContent: {
    paddingBottom: 40,
  },

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
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xxl,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  loginTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  loginSubtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
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
    fontWeight: '700',
    color: '#FFFFFF',
  },
  registerRow: {
    paddingVertical: Spacing.sm,
  },
  registerText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  registerTextBold: {
    color: Colors.primary,
    fontWeight: '700',
  },

  // =========================================
  // PROFILE CARD (logged in)
  // =========================================
  profileCard: {
    alignItems: 'center',
    backgroundColor: Colors.background,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    marginTop: Spacing.md,
    letterSpacing: -0.3,
  },
  profileUsername: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  universityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    marginTop: Spacing.md,
    backgroundColor: Colors.backgroundSecondary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
  },
  universityText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  bioText: {
    fontSize: FontSize.sm,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    marginTop: Spacing.lg,
    backgroundColor: Colors.accentSoft,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.accentLight + '40',
  },
  xpText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.accent,
  },

  // =========================================
  // STATS CARD
  // =========================================
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    paddingVertical: Spacing.lg + 2,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.shadow,
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
    fontWeight: '800',
    color: Colors.text,
  },
  statLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginTop: Spacing.xs,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.border,
  },

  // =========================================
  // TAB SWITCH
  // =========================================
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },

  // =========================================
  // LOADING
  // =========================================
  loadingBox: {
    paddingVertical: 60,
    alignItems: 'center',
  },

  // =========================================
  // EMPTY STATE
  // =========================================
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: Spacing.xxxl,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  emptySubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
    lineHeight: 20,
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
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.shadow,
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
    backgroundColor: Colors.backgroundSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridItemInfo: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  gridItemName: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  gridItemRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: Spacing.xs,
  },
  gridItemRatingText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  gridItemCaption: {
    fontSize: FontSize.sm,
    color: Colors.text,
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
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
