import React, { useEffect, useCallback, useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, {
  FadeInDown,
  FadeInRight,
  FadeIn,
  SlideInRight,
} from 'react-native-reanimated';
import { useMessageStore } from '../../stores/messageStore';
import { useAuthStore } from '../../stores/authStore';
import { useBuddyStore } from '../../stores/buddyStore';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily, AnimationConfig } from '../../lib/constants';
import { haptic } from '../../lib/haptics';
import { getRelativeTime } from '../../lib/utils';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useIsDarkMode } from '../../hooks/useThemeColors';
import Avatar from '../../components/ui/Avatar';
import type { Conversation } from '../../types';

const BUDDY_COLOR = '#06B6D4';
const BUDDY_COLOR_DARK = '#0891B2';


export default function MessagesScreen() {
  const colors = useThemeColors();
  const isDark = useIsDarkMode();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [searchQuery, setSearchQuery] = useState('');

  const conversations = useMessageStore((s) => s.conversations);
  const loading = useMessageStore((s) => s.loading);
  const fetchConversations = useMessageStore((s) => s.fetchConversations);
  const subscribeToConversations = useMessageStore((s) => s.subscribeToConversations);
  const unsubscribeChannel = useMessageStore((s) => s.unsubscribeChannel);

  // Buddy match state
  const activeMatch = useBuddyStore((s) => s.activeMatch);
  const fetchActiveMatch = useBuddyStore((s) => s.fetchActiveMatch);

  useEffect(() => {
    if (!user) return;

    fetchConversations(user.id);
    fetchActiveMatch(user.id);
    const channel = subscribeToConversations(user.id);
    return () => { if (channel) unsubscribeChannel(channel); };
  }, [user?.id]);

  const handleRefresh = useCallback(() => {
    if (user) {
      fetchConversations(user.id);
      fetchActiveMatch(user.id);
    }
  }, [user?.id]);

  const filteredConversations = useMemo(() =>
    conversations.filter((c) => {
      if (!searchQuery.trim()) return true;
      const name = (c.other_user?.full_name || c.other_user?.username || '').toLowerCase();
      return name.includes(searchQuery.toLowerCase());
    }),
    [conversations, searchQuery]
  );

  const recentActive = useMemo(() =>
    conversations.filter((c) => (c.unread_count ?? 0) > 0).slice(0, 6),
    [conversations]
  );

  const renderActiveRow = () => {
    if (recentActive.length === 0) return null;
    return (
      <Animated.View entering={FadeIn.delay(100).duration(500)}>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>Aktif</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.activeRow}
        >
          {recentActive.map((c, i) => (
            <Animated.View key={c.id} entering={FadeInRight.delay(i * 60).springify().damping(14)}>
              <TouchableOpacity
                style={styles.activeItem}
                onPress={() => router.push(`/chat/${c.id}`)}
                activeOpacity={0.7}
              >
                <View style={styles.activeAvatarWrap}>
                  <LinearGradient
                    colors={[Colors.primary, Colors.accent]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.activeRing}
                  />
                  <View style={[styles.activeAvatarInner, { backgroundColor: colors.background }]}>
                    <Avatar
                      uri={c.other_user?.avatar_url}
                      name={c.other_user?.full_name || c.other_user?.username || '?'}
                      size={48}
                    />
                  </View>
                  {(c.unread_count ?? 0) > 0 && (
                    <View style={[styles.activeBadge, { borderColor: colors.background }]}>
                      <Text style={styles.activeBadgeText}>
                        {c.unread_count! > 9 ? '9+' : c.unread_count}
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  style={[styles.activeName, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {(c.other_user?.full_name || c.other_user?.username || '').split(' ')[0]}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </ScrollView>
      </Animated.View>
    );
  };

  const renderBuddyMatch = () => {
    if (!activeMatch || !user) return null;
    const otherBuddy = activeMatch.requester?.user_id === user.id ? activeMatch.target : activeMatch.requester;
    const otherUser = otherBuddy?.user;

    return (
      <Animated.View entering={FadeInDown.delay(50).springify().damping(16)}>
        <Text style={[styles.sectionLabel, { color: BUDDY_COLOR }]}>Yemek Buddy</Text>
        <TouchableOpacity
          style={[styles.buddyMatchCard, {
            backgroundColor: isDark ? 'rgba(6,182,212,0.08)' : 'rgba(6,182,212,0.05)',
            borderColor: isDark ? 'rgba(6,182,212,0.2)' : 'rgba(6,182,212,0.15)',
          }]}
          onPress={() => { haptic.light(); router.push('/buddy'); }}
          activeOpacity={0.65}
        >
          {/* Blue accent bar */}
          <LinearGradient
            colors={[BUDDY_COLOR, BUDDY_COLOR_DARK]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.buddyAccentBar}
          />

          <View style={styles.buddyAvatarWrap}>
            <LinearGradient
              colors={[BUDDY_COLOR, BUDDY_COLOR_DARK]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.buddyAvatarRing}
            />
            <View style={[styles.buddyAvatarInner, { backgroundColor: isDark ? colors.surface : '#FAFEFF' }]}>
              <Avatar
                uri={otherUser?.avatar_url}
                name={otherUser?.full_name || otherUser?.username || '?'}
                size={44}
              />
            </View>
          </View>

          <View style={styles.buddyMatchBody}>
            <View style={styles.buddyMatchTop}>
              <Text style={[styles.buddyMatchName, { color: colors.text }]} numberOfLines={1}>
                {otherUser?.full_name || otherUser?.username || 'Yemek Buddy'}
              </Text>
              <View style={styles.buddyLiveBadge}>
                <View style={styles.buddyLiveDot} />
                <Text style={styles.buddyLiveText}>Aktif</Text>
              </View>
            </View>
            <Text style={[styles.buddyMatchPreview, { color: colors.textSecondary }]} numberOfLines={1}>
              Yemek buddy eslesmesi - Mesaj gonder!
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={18} color={BUDDY_COLOR} />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderConversation = useCallback(({ item, index }: { item: Conversation; index: number }) => {
    const hasUnread = (item.unread_count ?? 0) > 0;
    const isMySent = item.last_message_sender_id === user?.id;
    const previewText = item.last_message_text
      ? isMySent
        ? `Sen: ${item.last_message_text}`
        : item.last_message_text
      : 'Henuz mesaj yok';

    const staggerDelay = Math.min(index * AnimationConfig.staggerInterval, AnimationConfig.maxStaggerDelay);

    const cardBg = hasUnread ? colors.messageUnreadBg : colors.background;

    const cardBorder = hasUnread ? colors.messageUnreadBorder : colors.borderLight;

    return (
      <Animated.View entering={FadeInDown.delay(staggerDelay).springify().damping(16).stiffness(120)}>
        <TouchableOpacity
          style={[
            styles.conversationCard,
            {
              backgroundColor: cardBg,
              borderColor: cardBorder,
            },
          ]}
          onPress={() => { haptic.light(); router.push(`/chat/${item.id}`); }}
          activeOpacity={0.65}
          accessibilityRole="button"
          accessibilityLabel={(item.other_user?.full_name || 'Kullanici') + ' ile sohbet' + (hasUnread ? ', ' + item.unread_count + ' okunmamis mesaj' : '')}
        >
          {/* Unread accent bar */}
          {hasUnread && (
            <LinearGradient
              colors={[Colors.primary, Colors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.unreadAccent}
            />
          )}

          <View style={styles.avatarContainer}>
            <Avatar
              uri={item.other_user?.avatar_url}
              name={item.other_user?.full_name || item.other_user?.username || '?'}
              size={52}
            />
            {hasUnread && (
              <View style={[styles.onlineDot, { borderColor: cardBg }]} />
            )}
          </View>

          <View style={styles.conversationBody}>
            <View style={styles.conversationTop}>
              <Text
                style={[
                  styles.conversationName,
                  { color: colors.text },
                  hasUnread && styles.conversationNameUnread,
                ]}
                numberOfLines={1}
              >
                {item.other_user?.full_name || item.other_user?.username || 'Kullanici'}
              </Text>
              <Text style={[
                styles.conversationTime,
                { color: hasUnread ? Colors.primary : colors.textTertiary },
              ]}>
                {getRelativeTime(item.last_message_at)}
              </Text>
            </View>

            <View style={styles.previewRow}>
              <Text
                style={[
                  styles.conversationPreview,
                  { color: hasUnread ? colors.text : colors.textSecondary },
                  hasUnread && styles.conversationPreviewUnread,
                ]}
                numberOfLines={1}
              >
                {previewText}
              </Text>
              {hasUnread && (item.unread_count ?? 0) > 0 && (
                <LinearGradient
                  colors={[Colors.primary, Colors.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.unreadBadge}
                >
                  <Text style={styles.unreadBadgeText}>
                    {item.unread_count! > 99 ? '99+' : item.unread_count}
                  </Text>
                </LinearGradient>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }, [user?.id, colors]);

  const renderSkeletonRow = () => (
    <View style={[styles.conversationCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
      <View style={[styles.skeletonAvatar, { backgroundColor: colors.backgroundSecondary }]} />
      <View style={styles.conversationBody}>
        <View style={[styles.skeletonName, { backgroundColor: colors.backgroundSecondary }]} />
        <View style={[styles.skeletonPreview, { backgroundColor: colors.backgroundSecondary }]} />
      </View>
    </View>
  );

  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.centeredState}>
          <View style={[styles.lockCircle, { backgroundColor: isDark ? colors.surface : colors.backgroundSecondary }]}>
            <Ionicons name="lock-closed-outline" size={32} color={colors.textTertiary} />
          </View>
          <Text style={[styles.stateTitle, { color: colors.text }]}>Giris Yap</Text>
          <Text style={[styles.stateSubtitle, { color: colors.textSecondary }]}>
            Mesajlarini gormek icin giris yapman gerekiyor
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/auth/login')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[Colors.primary, Colors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryAction}
            >
              <Text style={styles.primaryActionText}>Giris Yap</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const showSkeleton = loading && conversations.length === 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400).springify().damping(18)} style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Mesajlar</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textTertiary }]}>
            {conversations.length > 0
              ? `${conversations.length} sohbet`
              : 'Sohbetlerin burada'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/chat/new')}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={[Colors.primary, Colors.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.composeButton}
          >
            <Ionicons name="create-outline" size={20} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* Search bar */}
      <Animated.View entering={FadeInDown.delay(80).springify().damping(16)} style={styles.searchWrap}>
        <View style={[styles.searchBar, { backgroundColor: isDark ? colors.surface : colors.backgroundSecondary, borderColor: isDark ? colors.border : 'transparent' }]}>
          <Ionicons name="search" size={18} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Sohbet ara..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {showSkeleton ? (
        <View style={styles.listContent}>
          {renderSkeletonRow()}
          {renderSkeletonRow()}
          {renderSkeletonRow()}
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversation}
          ListHeaderComponent={!searchQuery ? () => (
            <>
              {renderBuddyMatch()}
              {renderActiveRow()}
            </>
          ) : null}
          contentContainerStyle={filteredConversations.length === 0 ? styles.emptyList : styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.centeredState}>
              <View style={[styles.emptyCircle, { backgroundColor: isDark ? colors.surface : colors.backgroundSecondary }]}>
                <Ionicons name="chatbubbles-outline" size={36} color={colors.textTertiary} />
              </View>
              <Text style={[styles.stateTitle, { color: colors.text }]}>
                {searchQuery ? 'Sonuc bulunamadi' : 'Henuz mesajin yok'}
              </Text>
              <Text style={[styles.stateSubtitle, { color: colors.textSecondary }]}>
                {searchQuery
                  ? 'Baska bir isimle aramayı dene'
                  : 'Birinin profiline gidip mesaj atarak sohbete baslayabilirsin'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  headerTitle: {
    fontSize: FontSize.xxxl,
    fontFamily: FontFamily.heading,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    marginTop: 2,
  },
  composeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },

  // Search
  searchWrap: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 22,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    paddingVertical: 0,
  },

  // Active / Stories row
  sectionLabel: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemiBold,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    paddingHorizontal: Spacing.xxl,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  activeRow: {
    paddingHorizontal: Spacing.xxl,
    gap: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  activeItem: {
    alignItems: 'center',
    width: 64,
  },
  activeAvatarWrap: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 29,
  },
  activeAvatarInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  activeBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontFamily: FontFamily.headingBold,
  },
  activeName: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodyMedium,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },

  // Conversation card
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md + 2,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    gap: Spacing.md,
    overflow: 'hidden',
  },
  unreadAccent: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
  },
  avatarContainer: {
    position: 'relative',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.success,
    borderWidth: 2.5,
  },
  conversationBody: {
    flex: 1,
    gap: 3,
  },
  conversationTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  conversationName: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.bodyMedium,
    flex: 1,
    marginRight: Spacing.sm,
  },
  conversationNameUnread: {
    fontFamily: FontFamily.headingBold,
  },
  conversationTime: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  conversationPreview: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    lineHeight: 18,
    flex: 1,
  },
  conversationPreviewUnread: {
    fontFamily: FontFamily.bodyMedium,
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontFamily: FontFamily.headingBold,
  },
  listContent: {
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xxxl * 3,
  },

  // Skeleton
  skeletonAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  skeletonName: {
    width: 120,
    height: 14,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  skeletonPreview: {
    width: 200,
    height: 12,
    borderRadius: BorderRadius.sm,
  },

  // States
  emptyList: {
    flexGrow: 1,
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxxl,
    gap: Spacing.md,
  },
  lockCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  stateTitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.headingBold,
  },
  stateSubtitle: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    textAlign: 'center',
    lineHeight: 20,
  },
  primaryAction: {
    paddingHorizontal: Spacing.xxl + 4,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
  },
  primaryActionText: {
    color: '#FFF',
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
  },

  // Buddy match card
  buddyMatchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md + 2,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    gap: Spacing.md,
    overflow: 'hidden',
  },
  buddyAccentBar: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
  },
  buddyAvatarWrap: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buddyAvatarRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 26,
  },
  buddyAvatarInner: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buddyMatchBody: {
    flex: 1,
    gap: 3,
  },
  buddyMatchTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  buddyMatchName: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
    flex: 1,
    marginRight: Spacing.sm,
  },
  buddyLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(6,182,212,0.12)',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  buddyLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: BUDDY_COLOR,
  },
  buddyLiveText: {
    fontSize: 10,
    fontFamily: FontFamily.bodySemiBold,
    color: BUDDY_COLOR,
  },
  buddyMatchPreview: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    lineHeight: 18,
  },
});
