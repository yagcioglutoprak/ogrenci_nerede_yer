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
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useMessageStore } from '../../stores/messageStore';
import { useAuthStore } from '../../stores/authStore';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../../lib/constants';
import { haptic } from '../../lib/haptics';
import { getRelativeTime } from '../../lib/utils';
import { useThemeColors, useIsDarkMode } from '../../hooks/useThemeColors';
import Avatar from '../../components/ui/Avatar';
import ScreenHeader from '../../components/ui/ScreenHeader';
import type { Conversation } from '../../types';

export default function MessageRequestsScreen() {
  const colors = useThemeColors();
  const isDark = useIsDarkMode();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const messageRequests = useMessageStore((s) => s.messageRequests);
  const loading = useMessageStore((s) => s.loading);
  const fetchMessageRequests = useMessageStore((s) => s.fetchMessageRequests);

  useEffect(() => {
    if (user) fetchMessageRequests(user.id);
  }, [user?.id]);

  const handleRefresh = useCallback(() => {
    if (user) fetchMessageRequests(user.id);
  }, [user?.id]);

  const renderRequest = useCallback(({ item }: { item: Conversation }) => {
    return (
      <View>
        <TouchableOpacity
          style={[styles.requestCard, {
            backgroundColor: colors.background,
            borderColor: colors.borderLight,
          }]}
          onPress={() => { haptic.light(); router.push(`/chat/${item.id}`); }}
          activeOpacity={0.65}
        >
          <View style={styles.avatarContainer}>
            <Avatar
              uri={item.other_user?.avatar_url}
              name={item.other_user?.full_name || item.other_user?.username || '?'}
              size={52}
            />
          </View>

          <View style={styles.requestBody}>
            <View style={styles.requestTop}>
              <Text
                style={[styles.requestName, { color: colors.text }]}
                numberOfLines={1}
              >
                {item.other_user?.full_name || item.other_user?.username || 'Kullanici'}
              </Text>
              <Text style={[styles.requestTime, { color: colors.textTertiary }]}>
                {getRelativeTime(item.last_message_at)}
              </Text>
            </View>

            {item.other_user?.university && (
              <Text style={[styles.requestUniversity, { color: colors.textTertiary }]} numberOfLines={1}>
                {item.other_user.university}
              </Text>
            )}

            <Text
              style={[styles.requestPreview, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {item.last_message_text || 'Mesaj istegi'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  }, [colors, router]);

  if (!user) {
    router.replace('/auth/login');
    return null;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScreenHeader
        title="Mesaj Istekleri"
        compact
        leftAction={{ icon: 'chevron-back', onPress: () => router.back() }}
      />

      {/* Info banner */}
      <View style={[styles.infoBanner, { backgroundColor: isDark ? colors.surface : colors.backgroundSecondary }]}>
        <Ionicons name="information-circle-outline" size={18} color={colors.textTertiary} />
        <Text style={[styles.infoBannerText, { color: colors.textSecondary }]}>
          Takiplesmedigin kisilerden gelen mesaj istekleri
        </Text>
      </View>

      <FlatList
        data={messageRequests}
        keyExtractor={(item) => item.id}
        renderItem={renderRequest}
        contentContainerStyle={messageRequests.length === 0 ? styles.emptyList : styles.listContent}
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
          <View style={styles.emptyState}>
            <View style={[styles.emptyCircle, { backgroundColor: isDark ? colors.surface : colors.backgroundSecondary }]}>
              <Ionicons name="mail-open-outline" size={36} color={colors.textTertiary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Mesaj istegi yok
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              Takiplesmedigin kisilerden gelen mesajlar burada gorunur
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  infoBannerText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    lineHeight: 18,
  },
  listContent: {
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xxxl * 3,
  },
  emptyList: {
    flexGrow: 1,
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md + 2,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    gap: Spacing.md,
  },
  avatarContainer: {
    position: 'relative',
  },
  requestBody: {
    flex: 1,
    gap: 2,
  },
  requestTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  requestName: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
    flex: 1,
    marginRight: Spacing.sm,
  },
  requestTime: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
  },
  requestUniversity: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
  },
  requestPreview: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    lineHeight: 18,
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxxl,
    gap: Spacing.md,
  },
  emptyCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.headingBold,
  },
  emptySubtitle: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    textAlign: 'center',
    lineHeight: 20,
  },
});
