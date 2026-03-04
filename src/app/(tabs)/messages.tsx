import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useMessageStore } from '../../stores/messageStore';
import { useAuthStore } from '../../stores/authStore';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../../lib/constants';
import { getRelativeTime } from '../../lib/utils';
import { useThemeColors } from '../../hooks/useThemeColors';
import Avatar from '../../components/ui/Avatar';
import ScreenHeader from '../../components/ui/ScreenHeader';
import type { Conversation } from '../../types';

const MAX_STAGGER_DELAY = 200;
const STAGGER_INTERVAL = 40;

export default function MessagesScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const conversations = useMessageStore((s) => s.conversations);
  const loading = useMessageStore((s) => s.loading);
  const fetchConversations = useMessageStore((s) => s.fetchConversations);
  const subscribeToConversations = useMessageStore((s) => s.subscribeToConversations);
  const unsubscribeChannel = useMessageStore((s) => s.unsubscribeChannel);

  useEffect(() => {
    if (!user) return;

    fetchConversations(user.id);
    const channel = subscribeToConversations(user.id);
    return () => { if (channel) unsubscribeChannel(channel); };
  }, [user?.id]);

  const handleRefresh = useCallback(() => {
    if (user) fetchConversations(user.id);
  }, [user?.id]);

  const renderConversation = useCallback(({ item, index }: { item: Conversation; index: number }) => {
    const hasUnread = (item.unread_count ?? 0) > 0;
    const isMySent = item.last_message_sender_id === user?.id;
    const previewText = item.last_message_text
      ? isMySent
        ? `Sen: ${item.last_message_text}`
        : item.last_message_text
      : 'Henuz mesaj yok';

    const staggerDelay = Math.min(index * STAGGER_INTERVAL, MAX_STAGGER_DELAY);

    return (
      <Animated.View entering={FadeInDown.delay(staggerDelay).springify().damping(16).stiffness(120)}>
        <TouchableOpacity
          style={[styles.conversationRow, { backgroundColor: colors.background }]}
          onPress={() => router.push(`/chat/${item.id}`)}
          activeOpacity={0.7}
        >
          <View style={styles.avatarContainer}>
            <Avatar
              uri={item.other_user?.avatar_url}
              name={item.other_user?.full_name || item.other_user?.username || '?'}
              size={52}
            />
            {hasUnread && (
              <View style={[styles.unreadDot, { borderColor: colors.background }]} />
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
              <Text style={[styles.conversationTime, { color: hasUnread ? Colors.primary : colors.textTertiary }]}>
                {getRelativeTime(item.last_message_at)}
              </Text>
            </View>
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
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }, [user?.id, colors]);

  const renderSeparator = useCallback(() => (
    <View style={[styles.separator, { backgroundColor: colors.borderLight }]} />
  ), [colors.borderLight]);

  const renderSkeletonRow = () => (
    <View style={styles.conversationRow}>
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
          <Ionicons name="lock-closed-outline" size={48} color={colors.textTertiary} />
          <Text style={[styles.stateTitle, { color: colors.text }]}>Giris Yap</Text>
          <Text style={[styles.stateSubtitle, { color: colors.textSecondary }]}>
            Mesajlarini gormek icin giris yapman gerekiyor
          </Text>
          <TouchableOpacity
            style={styles.primaryAction}
            onPress={() => router.push('/auth/login')}
          >
            <Text style={styles.primaryActionText}>Giris Yap</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const showSkeleton = loading && conversations.length === 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <LinearGradient
        colors={[colors.background, colors.backgroundSecondary]}
        style={StyleSheet.absoluteFill}
      />

      <ScreenHeader
        title="Mesajlar"
        rightAction={{
          icon: 'create-outline',
          onPress: () => router.push('/chat/new'),
          color: Colors.primary,
        }}
      />

      {showSkeleton ? (
        <View>
          {renderSkeletonRow()}
          {renderSeparator()}
          {renderSkeletonRow()}
          {renderSeparator()}
          {renderSkeletonRow()}
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderConversation}
          ItemSeparatorComponent={renderSeparator}
          contentContainerStyle={conversations.length === 0 ? styles.emptyList : styles.listContent}
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
              <View style={[styles.stateIconCircle, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                <Ionicons name="chatbubbles-outline" size={36} color={colors.textTertiary} />
              </View>
              <Text style={[styles.stateTitle, { color: colors.text }]}>Henuz mesajin yok</Text>
              <Text style={[styles.stateSubtitle, { color: colors.textSecondary }]}>
                Birinin profiline gidip mesaj atarak sohbete baslayabilirsin
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


  // Conversation Row
  conversationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    gap: Spacing.lg,
  },
  avatarContainer: {
    position: 'relative',
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.primary,
    borderWidth: 2,
  },
  conversationBody: {
    flex: 1,
    gap: Spacing.xs,
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
  conversationPreview: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    lineHeight: 18,
  },
  conversationPreviewUnread: {
    fontFamily: FontFamily.bodyMedium,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Spacing.xl + 52 + Spacing.lg, // align with text, past avatar
  },
  listContent: {
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
  stateIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    borderWidth: 1,
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
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  primaryActionText: {
    color: '#FFF',
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
  },

  // Compose button
  composeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
