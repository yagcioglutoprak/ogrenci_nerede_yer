import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Share, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../../lib/constants';
import { useListStore } from '../../stores/listStore';
import { useAuthStore } from '../../stores/authStore';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { ListVenue } from '../../types';

export default function ListDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const colors = useThemeColors();
  const { user } = useAuthStore();
  const { selectedList, loading, fetchListById, toggleListLike, toggleListFollow } = useListStore();
  const [isLiked, setIsLiked] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [likesCount, setLikesCount] = useState(0);

  useEffect(() => {
    if (id) fetchListById(id as string);
  }, [id]);

  useEffect(() => {
    if (selectedList) {
      setLikesCount(selectedList.likes_count || 0);
    }
  }, [selectedList]);

  const handleShare = async () => {
    if (!selectedList) return;
    await Share.share({
      message: `${selectedList.title} - Ogrenci Nerede Yer'de kesfet!`,
    });
  };

  if (loading || !selectedList) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Hero */}
      <View style={styles.hero}>
        {selectedList.cover_image_url ? (
          <Image source={{ uri: selectedList.cover_image_url }} style={styles.heroImage} />
        ) : (
          <LinearGradient colors={[Colors.primary, Colors.gradientEnd || '#FF6B6B']} style={styles.heroImage} />
        )}
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={styles.heroGradient}>
          <SafeAreaView edges={['top']} style={styles.heroHeader}>
            <TouchableOpacity onPress={() => router.back()} style={styles.glassBtn}>
              <Ionicons name="chevron-back" size={22} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare} style={styles.glassBtn}>
              <Ionicons name="share-outline" size={20} color="#FFF" />
            </TouchableOpacity>
          </SafeAreaView>
          <View style={styles.heroInfo}>
            <Text style={styles.heroTitle}>{selectedList.title}</Text>
            {selectedList.description && (
              <Text style={styles.heroDescription}>{selectedList.description}</Text>
            )}
          </View>
        </LinearGradient>
      </View>

      {/* Author + Stats */}
      <View style={[styles.authorRow, { borderColor: colors.border }]}>
        <TouchableOpacity
          style={styles.authorInfo}
          onPress={() => selectedList.user && router.push(`/user/${selectedList.user.id}`)}
        >
          {selectedList.user?.avatar_url ? (
            <Image source={{ uri: selectedList.user.avatar_url }} style={styles.authorAvatar} />
          ) : (
            <View style={[styles.authorAvatar, { backgroundColor: Colors.primarySoft }]}>
              <Ionicons name="person" size={16} color={Colors.primary} />
            </View>
          )}
          <Text style={[styles.authorName, { color: colors.text }]}>
            {selectedList.user?.full_name || 'Anonim'}
          </Text>
        </TouchableOpacity>
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={[styles.actionBtn, isLiked && { backgroundColor: Colors.primarySoft }]}
            onPress={async () => {
              if (!user) { router.push('/auth/login'); return; }
              const result = await toggleListLike(selectedList.id, user.id);
              if (result !== null) {
                setIsLiked(result);
                setLikesCount(prev => prev + (result ? 1 : -1));
              }
            }}
          >
            <Ionicons name={isLiked ? "heart" : "heart-outline"} size={18} color={Colors.primary} />
            <Text style={styles.actionBtnText}>{likesCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, isFollowing && { backgroundColor: Colors.primarySoft }]}
            onPress={async () => {
              if (!user) { router.push('/auth/login'); return; }
              const result = await toggleListFollow(selectedList.id, user.id);
              if (result !== null) setIsFollowing(result);
            }}
          >
            <Ionicons name={isFollowing ? "bookmark" : "bookmark-outline"} size={18} color={Colors.primary} />
            <Text style={styles.actionBtnText}>{isFollowing ? 'Takip' : 'Takip Et'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Venues */}
      <ScrollView contentContainerStyle={styles.venueList}>
        <Text style={[styles.venueCountText, { color: colors.textSecondary }]}>
          {selectedList.venues?.length || 0} mekan
        </Text>
        {selectedList.venues?.map((lv: ListVenue, index: number) => (
          <TouchableOpacity
            key={lv.id}
            style={[styles.venueCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
            onPress={() => lv.venue && router.push(`/venue/${lv.venue.id}`)}
            activeOpacity={0.8}
          >
            <View style={styles.venuePosition}>
              <Text style={styles.venuePositionText}>{index + 1}</Text>
            </View>
            {lv.venue?.cover_image_url ? (
              <Image source={{ uri: lv.venue.cover_image_url }} style={styles.venueImage} />
            ) : (
              <View style={[styles.venueImage, { backgroundColor: '#F0F0F0' }]}>
                <Ionicons name="restaurant" size={20} color="#CCC" />
              </View>
            )}
            <View style={styles.venueInfo}>
              <Text style={[styles.venueName, { color: colors.text }]} numberOfLines={1}>
                {lv.venue?.name || 'Mekan'}
              </Text>
              {lv.note && (
                <Text style={[styles.venueNote, { color: colors.textSecondary }]} numberOfLines={2}>
                  {lv.note}
                </Text>
              )}
              {lv.venue?.overall_rating ? (
                <View style={styles.venueRatingRow}>
                  <Ionicons name="star" size={12} color={Colors.accent} />
                  <Text style={styles.venueRatingText}>{lv.venue.overall_rating.toFixed(1)}</Text>
                </View>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        ))}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hero: { height: 220 },
  heroImage: { width: '100%', height: '100%' },
  heroGradient: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  glassBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center',
  },
  heroInfo: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg },
  heroTitle: { fontSize: FontSize.xxl, fontFamily: FontFamily.heading, color: '#FFF' },
  heroDescription: { fontSize: FontSize.sm, fontFamily: FontFamily.body, color: 'rgba(255,255,255,0.8)', marginTop: Spacing.xs },
  authorRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  authorInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  authorAvatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  authorName: { fontSize: FontSize.md, fontFamily: FontFamily.bodySemiBold },
  statsRow: { flexDirection: 'row', gap: Spacing.sm },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full, backgroundColor: '#F5F5F5',
  },
  actionBtnText: { fontSize: FontSize.sm, fontFamily: FontFamily.bodySemiBold, color: Colors.primary },
  venueList: { padding: Spacing.xl, gap: Spacing.md },
  venueCountText: { fontSize: FontSize.sm, fontFamily: FontFamily.bodySemiBold, marginBottom: Spacing.xs },
  venueCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, gap: Spacing.md,
  },
  venuePosition: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  venuePositionText: { fontSize: FontSize.sm, fontFamily: FontFamily.headingBold, color: '#FFF' },
  venueImage: { width: 50, height: 50, borderRadius: BorderRadius.sm, justifyContent: 'center', alignItems: 'center' },
  venueInfo: { flex: 1 },
  venueName: { fontSize: FontSize.md, fontFamily: FontFamily.bodySemiBold },
  venueNote: { fontSize: FontSize.xs, fontFamily: FontFamily.body, marginTop: 2 },
  venueRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  venueRatingText: { fontSize: FontSize.xs, fontFamily: FontFamily.bodySemiBold, color: Colors.accent },
});
