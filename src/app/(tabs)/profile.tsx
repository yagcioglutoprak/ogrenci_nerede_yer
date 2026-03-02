import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../stores/authStore';
import { Colors } from '../../lib/constants';
import Avatar from '../../components/ui/Avatar';
import Button from '../../components/ui/Button';
import type { Venue, Post } from '../../types';
import { supabase } from '../../lib/supabase';

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
          supabase.from('venues').select('*', { count: 'exact', head: true }).eq('created_by', user.id),
          supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
          supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id),
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

  // Not logged in state
  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loginPrompt}>
          <View style={styles.loginIllustration}>
            <Ionicons name="person-circle-outline" size={80} color={Colors.borderLight} />
          </View>
          <Text style={styles.loginTitle}>Hesabina Giris Yap</Text>
          <Text style={styles.loginSubtitle}>
            Favori mekanlarini kaydet, yorumlarini paylas{'\n'}ve topluluga katil!
          </Text>
          <Button
            title="Giris Yap"
            onPress={() => router.push('/auth/login')}
            icon="log-in-outline"
            style={styles.loginButton}
          />
          <TouchableOpacity onPress={() => router.push('/auth/register')}>
            <Text style={styles.registerLink}>
              Hesabin yok mu? <Text style={styles.registerLinkBold}>Kayit Ol</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profil</Text>
          <TouchableOpacity style={styles.settingsButton} onPress={handleSignOut}>
            <Ionicons name="settings-outline" size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>

        {/* Profile Info */}
        <View style={styles.profileSection}>
          <Avatar
            uri={user.avatar_url}
            name={user.full_name || user.username}
            size={80}
          />
          <Text style={styles.username}>@{user.username}</Text>
          <Text style={styles.fullName}>{user.full_name}</Text>
          {user.university && (
            <View style={styles.universityRow}>
              <Ionicons name="school-outline" size={16} color={Colors.textSecondary} />
              <Text style={styles.universityText}>{user.university}</Text>
            </View>
          )}
          {user.bio && (
            <Text style={styles.bio}>{user.bio}</Text>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
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

        {/* XP Badge */}
        <View style={styles.xpBadge}>
          <Ionicons name="flash" size={18} color={Colors.star} />
          <Text style={styles.xpText}>{user.xp_points} XP</Text>
        </View>

        {/* Tab Switch */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'favorites' && styles.tabButtonActive]}
            onPress={() => setActiveTab('favorites')}
          >
            <Ionicons
              name={activeTab === 'favorites' ? 'heart' : 'heart-outline'}
              size={20}
              color={activeTab === 'favorites' ? Colors.primary : Colors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === 'favorites' && styles.tabTextActive]}>
              Favorilerim
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'posts' && styles.tabButtonActive]}
            onPress={() => setActiveTab('posts')}
          >
            <Ionicons
              name={activeTab === 'posts' ? 'grid' : 'grid-outline'}
              size={20}
              color={activeTab === 'posts' ? Colors.primary : Colors.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === 'posts' && styles.tabTextActive]}>
              Gonderilerim
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : activeTab === 'favorites' ? (
          favorites.length === 0 ? (
            <View style={styles.emptyContent}>
              <Ionicons name="heart-outline" size={48} color={Colors.borderLight} />
              <Text style={styles.emptyText}>Henuz favori mekanin yok</Text>
              <Text style={styles.emptySubtext}>
                Mekanlari kesfet ve favorilerine ekle!
              </Text>
            </View>
          ) : (
            <View style={styles.gridContainer}>
              {favorites.map((venue) => (
                <TouchableOpacity
                  key={venue.id}
                  style={styles.gridItem}
                  onPress={() => router.push(`/venue/${venue.id}`)}
                  activeOpacity={0.85}
                >
                  {venue.cover_image_url ? (
                    <Image source={{ uri: venue.cover_image_url }} style={styles.gridImage} />
                  ) : (
                    <View style={[styles.gridImage, styles.gridImagePlaceholder]}>
                      <Ionicons name="restaurant-outline" size={24} color={Colors.textLight} />
                    </View>
                  )}
                  <View style={styles.gridItemOverlay}>
                    <Text style={styles.gridItemName} numberOfLines={1}>{venue.name}</Text>
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
          <View style={styles.emptyContent}>
            <Ionicons name="camera-outline" size={48} color={Colors.borderLight} />
            <Text style={styles.emptyText}>Henuz gonderin yok</Text>
            <Text style={styles.emptySubtext}>
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
                  style={styles.gridItem}
                  activeOpacity={0.85}
                >
                  {firstImage ? (
                    <Image source={{ uri: firstImage }} style={styles.gridImage} />
                  ) : (
                    <View style={[styles.gridImage, styles.gridImagePlaceholder]}>
                      <Ionicons name="document-text-outline" size={24} color={Colors.textLight} />
                    </View>
                  )}
                  {post.images && post.images.length > 1 && (
                    <View style={styles.multiImageBadge}>
                      <Ionicons name="copy" size={12} color="#FFFFFF" />
                    </View>
                  )}
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
    backgroundColor: Colors.background,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
  },
  settingsButton: {
    padding: 4,
  },
  // Profile Info
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: Colors.surface,
  },
  username: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginTop: 10,
  },
  fullName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 2,
  },
  universityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  universityText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  bio: {
    fontSize: 14,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 10,
    paddingHorizontal: 20,
  },
  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.borderLight,
  },
  // XP Badge
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  xpText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.star,
  },
  // Tabs
  tabRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  // Loading
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  // Empty
  emptyContent: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
  },
  // Grid
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 2,
  },
  gridItem: {
    width: '33.33%',
    aspectRatio: 1,
    padding: 2,
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
    borderRadius: 4,
  },
  gridImagePlaceholder: {
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridItemOverlay: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    padding: 6,
  },
  gridItemName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  gridItemRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  gridItemRatingText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  multiImageBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 4,
    padding: 3,
  },
  // Login prompt
  loginPrompt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  loginIllustration: {
    marginBottom: 8,
  },
  loginTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  loginSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  loginButton: {
    width: '100%',
    marginBottom: 16,
  },
  registerLink: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  registerLinkBold: {
    color: Colors.primary,
    fontWeight: '700',
  },
});
