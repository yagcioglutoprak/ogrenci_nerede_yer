import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInUp, FadeOut } from 'react-native-reanimated';
import { useMessageStore } from '../../stores/messageStore';
import { useAuthStore } from '../../stores/authStore';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../../lib/constants';
import { useThemeColors, useIsDarkMode } from '../../hooks/useThemeColors';
import { haptic } from '../../lib/haptics';
import Avatar from '../../components/ui/Avatar';
import AttachmentSheet from '../../components/chat/AttachmentSheet';
import VenuePickerModal from '../../components/chat/VenuePickerModal';
import ImageBubble from '../../components/chat/ImageBubble';
import VenueBubble from '../../components/chat/VenueBubble';
import type { DirectMessage } from '../../types';

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Bugün';
  if (date.toDateString() === yesterday.toDateString()) return 'Dün';
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatScreen() {
  const { id: conversationId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const isDark = useIsDarkMode();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  const messages = useMessageStore((s) => s.messages);
  const fetchMessages = useMessageStore((s) => s.fetchMessages);
  const sendMessage = useMessageStore((s) => s.sendMessage);
  const markAsRead = useMessageStore((s) => s.markAsRead);
  const subscribeToMessages = useMessageStore((s) => s.subscribeToMessages);
  const unsubscribeChannel = useMessageStore((s) => s.unsubscribeChannel);
  const conversations = useMessageStore((s) => s.conversations);
  const messageRequests = useMessageStore((s) => s.messageRequests);

  const [draft, setDraft] = useState('');
  const [attachmentSheetVisible, setAttachmentSheetVisible] = useState(false);
  const [venuePickerVisible, setVenuePickerVisible] = useState(false);
  const flatListRef = useRef<FlatList<DirectMessage>>(null);
  const isNearBottom = useRef(true);

  // Look up in both accepted conversations AND pending requests
  const conversation = conversations.find((c) => c.id === conversationId)
    || messageRequests.find((c) => c.id === conversationId);
  const otherUser = conversation?.other_user;
  const otherUserId = conversation
    ? conversation.participant_1 === user?.id
      ? conversation.participant_2
      : conversation.participant_1
    : '';

  const isPending = conversation?.status === 'pending';
  const isRecipient = isPending && conversation?.initiated_by !== user?.id;
  const isSender = isPending && conversation?.initiated_by === user?.id;

  const acceptRequest = useMessageStore((s) => s.acceptRequest);
  const deleteRequest = useMessageStore((s) => s.deleteRequest);
  const blockFromRequest = useMessageStore((s) => s.blockFromRequest);

  useEffect(() => {
    if (!conversationId) return;

    fetchMessages(conversationId);
    if (user && !isPending) markAsRead(conversationId, user.id);

    const channel = subscribeToMessages(conversationId);
    return () => { if (channel) unsubscribeChannel(channel); };
  }, [conversationId]);

  const scrollToBottom = useCallback(() => {
    if (isNearBottom.current) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, []);

  const handleScroll = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    isNearBottom.current = distanceFromBottom < 100;
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed || !user || !conversationId) return;

    haptic.light();
    sendMessage(conversationId, user.id, trimmed, otherUserId);
    setDraft('');
  }, [draft, user, conversationId, otherUserId]);

  const handlePickPhotoDirectly = useCallback(async () => {
    if (!user || !conversationId) return;

    const ImagePicker = await import('expo-image-picker');
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      sendMessage(conversationId, user.id, '', otherUserId, 'image', { image_url: uri });
    }
  }, [user, conversationId, otherUserId, sendMessage]);

  const handlePickVenue = useCallback((venue: {
    venue_id: string;
    venue_name: string;
    venue_cover_url: string | null;
    venue_rating: number;
    venue_price_range: number;
  }) => {
    if (!user || !conversationId) return;

    sendMessage(conversationId, user.id, venue.venue_name, otherUserId, 'venue', {
      venue_id: venue.venue_id,
      venue_name: venue.venue_name,
      venue_cover_url: venue.venue_cover_url ?? undefined,
      venue_rating: venue.venue_rating,
      venue_price_range: venue.venue_price_range,
    });
  }, [user, conversationId, otherUserId, sendMessage]);

  // Check if previous message is from the same sender (for grouping)
  const isSameSenderAsPrev = useCallback((index: number) => {
    if (index === 0) return false;
    return messages[index - 1].sender_id === messages[index].sender_id;
  }, [messages]);

  const renderMessage = useCallback(({ item, index }: { item: DirectMessage; index: number }) => {
    const isOwn = item.sender_id === user?.id;
    const time = formatTime(item.created_at);
    const grouped = isSameSenderAsPrev(index);

    const showDateHeader = index === 0 ||
      new Date(messages[index - 1].created_at).toDateString() !== new Date(item.created_at).toDateString();

    const dateHeader = showDateHeader ? (
      <View style={styles.dateSeparator}>
        <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
        <View style={[styles.datePill, { backgroundColor: isDark ? colors.surface : colors.backgroundSecondary }]}>
          <Text style={[styles.datePillText, { color: colors.textTertiary }]}>
            {formatDateLabel(item.created_at)}
          </Text>
        </View>
        <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
      </View>
    ) : null;

    // Image message
    if (item.message_type === 'image' && item.metadata?.image_url) {
      return (
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)}>
          {dateHeader}
          <ImageBubble
            imageUrl={item.metadata.image_url}
            isOwn={isOwn}
            time={time}
            isRead={item.is_read}
          />
        </Animated.View>
      );
    }

    // Venue message
    if (item.message_type === 'venue' && item.metadata?.venue_id) {
      return (
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)}>
          {dateHeader}
          <VenueBubble
            venueId={item.metadata.venue_id}
            venueName={item.metadata.venue_name ?? 'Mekan'}
            venueCoverUrl={item.metadata.venue_cover_url ?? null}
            venueRating={item.metadata.venue_rating ?? 0}
            venuePriceRange={item.metadata.venue_price_range ?? 1}
            isOwn={isOwn}
            time={time}
            isRead={item.is_read}
          />
        </Animated.View>
      );
    }

    // Text message
    const bubbleContent = (
      <View style={styles.bubbleInner}>
        <Text style={[styles.bubbleText, { color: isOwn ? '#FFF' : colors.text }]}>
          {item.content}
        </Text>
        <View style={styles.bubbleMeta}>
          <Text style={[styles.bubbleTime, { color: isOwn ? 'rgba(255,255,255,0.55)' : colors.textTertiary }]}>
            {time}
          </Text>
          {isOwn && item.is_read && (
            <Ionicons name="checkmark-done" size={13} color="rgba(255,255,255,0.55)" style={{ marginLeft: 4 }} />
          )}
        </View>
      </View>
    );

    return (
      <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)}>
        {dateHeader}
        <View style={[
          styles.bubbleRow,
          isOwn ? styles.ownRow : styles.otherRow,
          grouped && { marginTop: 2 },
        ]}>
          {isOwn ? (
            <LinearGradient
              colors={[Colors.primary, Colors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.bubble,
                styles.ownBubble,
                grouped && styles.ownBubbleGrouped,
              ]}
            >
              {bubbleContent}
            </LinearGradient>
          ) : (
            <View
              style={[
                styles.bubble,
                styles.otherBubble,
                grouped && styles.otherBubbleGrouped,
                {
                  backgroundColor: isDark ? colors.surface : colors.backgroundSecondary,
                  borderColor: isDark ? colors.border : 'transparent',
                  borderWidth: isDark ? StyleSheet.hairlineWidth : 0,
                },
              ]}
            >
              {bubbleContent}
            </View>
          )}
        </View>
      </Animated.View>
    );
  }, [user?.id, messages, colors, isDark, isSameSenderAsPrev]);

  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centeredState}>
          <View style={[styles.lockCircle, { backgroundColor: isDark ? colors.surface : colors.backgroundSecondary }]}>
            <Ionicons name="lock-closed-outline" size={32} color={colors.textTertiary} />
          </View>
          <Text style={[styles.stateTitle, { color: colors.text }]}>Giriş Yap</Text>
          <Text style={[styles.stateText, { color: colors.textSecondary }]}>
            Mesajları görmek için giriş yap
          </Text>
          <TouchableOpacity onPress={() => router.push('/auth/login')} activeOpacity={0.8}>
            <LinearGradient
              colors={[Colors.primary, Colors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryAction}
            >
              <Text style={styles.primaryActionText}>Giriş Yap</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const canSend = draft.trim().length > 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, {
        backgroundColor: colors.background,
        shadowColor: isDark ? '#000' : colors.shadow,
      }]}>
        <TouchableOpacity
          onPress={() => { haptic.light(); router.back(); }}
          style={styles.backButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Geri"
          accessibilityRole="button"
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerProfile}
          onPress={() => otherUser && router.push(`/user/${otherUser.id}`)}
          activeOpacity={0.7}
        >
          <View style={styles.avatarWrap}>
            <Avatar
              uri={otherUser?.avatar_url}
              name={otherUser?.full_name || otherUser?.username || '?'}
              size={40}
            />
          </View>
          <View style={styles.headerInfo}>
            <Text style={[styles.headerName, { color: colors.text }]} numberOfLines={1}>
              {otherUser?.full_name || otherUser?.username || 'Kullanıcı'}
            </Text>
            {otherUser?.university && (
              <Text style={[styles.headerSubtext, { color: colors.textTertiary }]} numberOfLines={1}>
                {otherUser.university}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.headerAction, { backgroundColor: isDark ? colors.surface : colors.backgroundSecondary }]}
          onPress={() => otherUser && router.push(`/user/${otherUser.id}`)}
          activeOpacity={0.7}
          accessibilityLabel="Profili gör"
          accessibilityRole="button"
        >
          <Ionicons name="person-circle-outline" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Pending request banner */}
      {isSender && (
        <Animated.View entering={FadeIn.duration(300)} style={[styles.pendingBanner, {
          backgroundColor: isDark ? 'rgba(245,166,35,0.1)' : 'rgba(245,166,35,0.08)',
        }]}>
          <Ionicons name="time-outline" size={18} color={Colors.accent} />
          <Text style={[styles.pendingBannerText, { color: colors.textSecondary }]}>
            Mesaj istegi gonderildi. Onay bekleniyor.
          </Text>
        </Animated.View>
      )}

      {/* Chat body */}
      <KeyboardAvoidingView
        style={styles.chatBody}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={[styles.messageList, { paddingBottom: Spacing.md }]}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}
          onLayout={scrollToBottom}
          onScroll={handleScroll}
          scrollEventThrottle={100}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Animated.View entering={FadeInUp.delay(200).springify().damping(20).stiffness(300)}>
                <View style={[styles.emptyChatIcon, { backgroundColor: isDark ? colors.surface : colors.backgroundSecondary }]}>
                  <Ionicons name="chatbubble-ellipses-outline" size={36} color={colors.textTertiary} />
                </View>
              </Animated.View>
              <Animated.Text
                entering={FadeInUp.delay(350).springify().damping(20).stiffness(300)}
                style={[styles.emptyTitle, { color: colors.text }]}
              >
                Sohbete başla!
              </Animated.Text>
              <Animated.Text
                entering={FadeInUp.delay(450).springify().damping(20).stiffness(300)}
                style={[styles.stateText, { color: colors.textSecondary }]}
              >
                İlk mesajı göndererek sohbeti başlat
              </Animated.Text>
            </View>
          }
        />

        {/* Input Bar / Request Action Bar */}
        {isRecipient ? (
          <Animated.View entering={FadeIn.duration(200)} style={[
            styles.requestActionBar,
            {
              backgroundColor: colors.background,
              borderTopColor: isDark ? colors.border : colors.borderLight,
              paddingBottom: Math.max(insets.bottom, Spacing.sm),
            },
          ]}>
            <TouchableOpacity
              style={[styles.requestActionButton, styles.acceptButton]}
              onPress={async () => {
                haptic.success();
                await acceptRequest(conversationId!);
                if (user) markAsRead(conversationId!, user.id);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="checkmark-circle" size={20} color="#FFF" />
              <Text style={styles.requestActionTextLight}>Kabul Et</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.requestActionButton, { backgroundColor: isDark ? colors.surface : colors.backgroundSecondary }]}
              onPress={() => {
                haptic.light();
                deleteRequest(conversationId!);
                router.back();
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.requestActionText, { color: colors.textSecondary }]}>Sil</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.requestActionButton, styles.blockButton]}
              onPress={() => {
                Alert.alert(
                  'Engelle',
                  `${otherUser?.full_name || 'Bu kullaniciyi'} engellemek istedigine emin misin? Engellenen kisi sana mesaj atamaz, profilini goremez ve takip edemez.`,
                  [
                    { text: 'Iptal', style: 'cancel' },
                    {
                      text: 'Engelle',
                      style: 'destructive',
                      onPress: async () => {
                        haptic.error();
                        await blockFromRequest(conversationId!, otherUserId);
                        router.back();
                      },
                    },
                  ],
                );
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="ban" size={20} color="#FFF" />
              <Text style={styles.requestActionTextLight}>Engelle</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <View style={[
            styles.inputBar,
            {
              backgroundColor: isDark ? colors.surface : colors.backgroundSecondary,
              marginBottom: Math.max(insets.bottom, Spacing.sm),
            },
          ]}>
            <TouchableOpacity
              style={[styles.attachButton, {
                backgroundColor: isDark ? colors.surface : colors.backgroundSecondary,
              }]}
              onPress={() => { haptic.light(); setAttachmentSheetVisible(true); }}
              activeOpacity={0.7}
              accessibilityLabel="Ek ekle"
              accessibilityRole="button"
            >
              <Ionicons name="add" size={24} color={Colors.primary} />
            </TouchableOpacity>

            <View style={[styles.inputWrap, {
              backgroundColor: isDark ? colors.surface : colors.backgroundSecondary,
              borderColor: isDark ? colors.border : 'transparent',
              borderWidth: isDark ? StyleSheet.hairlineWidth : 0,
            }]}>
              <TextInput
                style={[styles.inputField, { color: colors.text }]}
                value={draft}
                onChangeText={setDraft}
                placeholder="Mesaj yaz..."
                placeholderTextColor={colors.textTertiary}
                multiline
                maxLength={2000}
                selectionColor={Colors.primary}
              />
            </View>

            <TouchableOpacity
              onPress={handleSend}
              disabled={!canSend}
              activeOpacity={0.7}
              accessibilityLabel="Mesaj gonder"
              accessibilityRole="button"
            >
              <LinearGradient
                colors={canSend ? [Colors.primary, Colors.accent] : [colors.textTertiary, colors.textTertiary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.sendButton, !canSend && { opacity: 0.35 }]}
              >
                <Ionicons name="send" size={18} color="#FFF" style={{ marginLeft: 2 }} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Attachment Sheet */}
      <AttachmentSheet
        visible={attachmentSheetVisible}
        onClose={() => setAttachmentSheetVisible(false)}
        onPickPhoto={handlePickPhotoDirectly}
        onPickVenue={() => setVenuePickerVisible(true)}
      />

      {/* Venue Picker Modal */}
      <VenuePickerModal
        visible={venuePickerVisible}
        onClose={() => setVenuePickerVisible(false)}
        onSelect={handlePickVenue}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  chatBody: {
    flex: 1,
  },

  // ─── Header ─────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    zIndex: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerProfile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  avatarWrap: {
    position: 'relative',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.success,
    borderWidth: 2,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.headingBold,
    letterSpacing: -0.2,
  },
  headerSubtext: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
    marginTop: 1,
  },
  headerAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Messages ───────────────────────────────────────
  messageList: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    flexGrow: 1,
  },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.xl,
    gap: Spacing.md,
  },
  dateLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  datePill: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs + 1,
    borderRadius: BorderRadius.full,
  },
  datePillText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemiBold,
    letterSpacing: 0.2,
  },

  // ─── Bubble ─────────────────────────────────────────
  bubbleRow: {
    marginBottom: Spacing.sm,
  },
  ownRow: {
    alignItems: 'flex-end',
  },
  otherRow: {
    alignItems: 'flex-start',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  ownBubble: {
    borderBottomRightRadius: 6,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  ownBubbleGrouped: {
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  otherBubble: {
    borderBottomLeftRadius: 6,
  },
  otherBubbleGrouped: {
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
  },
  bubbleInner: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm + 2,
    paddingBottom: Spacing.sm,
  },
  bubbleText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    lineHeight: 22,
  },
  bubbleMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 3,
    gap: 2,
  },
  bubbleTime: {
    fontSize: 10,
    fontFamily: FontFamily.body,
    letterSpacing: 0.1,
  },

  // ─── Pending Banner ────────────────────────────────
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  pendingBannerText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    lineHeight: 18,
  },

  // ─── Request Action Bar ───────────────────────────
  requestActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  requestActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  acceptButton: {
    backgroundColor: Colors.success,
  },
  blockButton: {
    backgroundColor: Colors.error,
  },
  requestActionText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.headingBold,
  },
  requestActionTextLight: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.headingBold,
    color: '#FFF',
  },

  // ─── Input Bar ──────────────────────────────────────
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginHorizontal: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
    borderRadius: BorderRadius.xl,
    gap: Spacing.sm,
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  inputWrap: {
    flex: 1,
    borderRadius: 22,
    overflow: 'hidden',
  },
  inputField: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    paddingHorizontal: Spacing.lg,
    paddingTop: Platform.OS === 'ios' ? Spacing.sm + 2 : Spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? Spacing.sm + 2 : Spacing.sm,
    maxHeight: 100,
    minHeight: 40,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },

  // ─── States ─────────────────────────────────────────
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xxxl,
  },
  lockCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  stateTitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.headingBold,
  },
  emptyChat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.xxxl * 3,
    gap: Spacing.md,
  },
  emptyChatIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.headingBold,
  },
  stateText: {
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
});
