import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useMessageStore } from '../../stores/messageStore';
import { useAuthStore } from '../../stores/authStore';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';
import Avatar from '../../components/ui/Avatar';
import { haptic } from '../../lib/haptics';
import type { User } from '../../types';

type UserResult = User & { mutual_followers: number };

const DEBOUNCE_MS = 300;

export default function NewDMScreen() {
  const colors = useThemeColors();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const searchUsers = useMessageStore((s) => s.searchUsers);
  const fetchOrCreateConversation = useMessageStore((s) => s.fetchOrCreateConversation);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback((text: string) => {
    setQuery(text);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!text.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      if (!user) return;
      setSearching(true);
      const found = await searchUsers(text, user.id);
      setResults(found);
      setHasSearched(true);
      setSearching(false);
    }, DEBOUNCE_MS);
  }, [user?.id]);

  const handleSelectUser = useCallback(async (selectedUser: UserResult) => {
    if (!user || navigating) return;
    haptic.selection();
    setNavigating(true);

    const convId = await fetchOrCreateConversation(user.id, selectedUser.id);
    if (convId) {
      router.replace(`/chat/${convId}`);
    } else {
      setNavigating(false);
    }
  }, [user?.id, navigating]);

  const renderUserRow = useCallback(({ item, index }: { item: UserResult; index: number }) => (
    <Animated.View entering={FadeInDown.delay(Math.min(index * 40, 200)).springify().damping(18)}>
      <TouchableOpacity
        style={[styles.userRow, { backgroundColor: colors.background }]}
        onPress={() => handleSelectUser(item)}
        activeOpacity={0.7}
        disabled={navigating}
      >
        <Avatar
          uri={item.avatar_url}
          name={item.full_name || item.username}
          size={44}
        />
        <View style={styles.userInfo}>
          <View style={styles.userNameRow}>
            <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
              {item.full_name}
            </Text>
            <Text style={[styles.userHandle, { color: colors.textTertiary }]} numberOfLines={1}>
              @{item.username}
            </Text>
          </View>
          <View style={styles.userMeta}>
            {item.university && (
              <Text style={[styles.userUniversity, { color: colors.textSecondary }]} numberOfLines={1}>
                {item.university}
              </Text>
            )}
            {item.mutual_followers > 0 && (
              <Text style={[styles.mutualCount, { color: colors.textTertiary }]}>
                {' \u00b7 '}{item.mutual_followers} ortak takipci
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  ), [colors, navigating]);

  const renderSeparator = useCallback(() => (
    <View style={[styles.separator, { backgroundColor: colors.borderLight }]} />
  ), [colors.borderLight]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <Animated.View entering={FadeIn.duration(300)} style={[styles.header, { borderBottomColor: colors.borderLight }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Yeni Mesaj</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </Animated.View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.backgroundSecondary }]}>
        <Ionicons name="search" size={18} color={colors.textTertiary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          value={query}
          onChangeText={handleSearch}
          placeholder="Kullanici ara..."
          placeholderTextColor={colors.textTertiary}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          selectionColor={Colors.primary}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Results */}
      {searching ? (
        <View style={styles.centeredState}>
          <ActivityIndicator size="small" color={Colors.primary} />
        </View>
      ) : hasSearched && results.length === 0 ? (
        <View style={styles.centeredState}>
          <Ionicons name="person-outline" size={40} color={colors.textTertiary} />
          <Text style={[styles.stateText, { color: colors.textSecondary }]}>
            Sonuc bulunamadi
          </Text>
        </View>
      ) : !hasSearched ? (
        <View style={styles.centeredState}>
          <Ionicons name="search-outline" size={40} color={colors.textTertiary} />
          <Text style={[styles.stateText, { color: colors.textSecondary }]}>
            Bir kullanici ara...
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderUserRow}
          ItemSeparatorComponent={renderSeparator}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}

      {navigating && (
        <View style={styles.navigatingOverlay}>
          <ActivityIndicator size="small" color="#FFF" />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.headingBold,
  },
  closeButton: {
    position: 'absolute',
    right: Spacing.xl,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.xl,
    marginVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 9999,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    paddingVertical: Spacing.xs,
  },
  listContent: {
    paddingBottom: Spacing.xxxl,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: Spacing.lg,
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  userName: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
    flexShrink: 1,
  },
  userHandle: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userUniversity: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
    flexShrink: 1,
  },
  mutualCount: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: Spacing.xl + 44 + Spacing.lg,
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingBottom: Spacing.xxxl * 3,
  },
  stateText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
  },
  navigatingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
