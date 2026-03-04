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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useMessageStore } from '../../stores/messageStore';
import { useAuthStore } from '../../stores/authStore';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';
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

  if (date.toDateString() === today.toDateString()) return 'Bugun';
  if (date.toDateString() === yesterday.toDateString()) return 'Dun';
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatScreen() {
  const { id: conversationId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const user = useAuthStore((s) => s.user);

  const messages = useMessageStore((s) => s.messages);
  const fetchMessages = useMessageStore((s) => s.fetchMessages);
  const sendMessage = useMessageStore((s) => s.sendMessage);
  const markAsRead = useMessageStore((s) => s.markAsRead);
  const subscribeToMessages = useMessageStore((s) => s.subscribeToMessages);
  const unsubscribeChannel = useMessageStore((s) => s.unsubscribeChannel);
  const conversations = useMessageStore((s) => s.conversations);

  const [draft, setDraft] = useState('');
  const [attachmentSheetVisible, setAttachmentSheetVisible] = useState(false);
  const [venuePickerVisible, setVenuePickerVisible] = useState(false);
  const flatListRef = useRef<FlatList<DirectMessage>>(null);

  const conversation = conversations.find((c) => c.id === conversationId);
  const otherUser = conversation?.other_user;
  const otherUserId = conversation
    ? conversation.participant_1 === user?.id
      ? conversation.participant_2
      : conversation.participant_1
    : '';

  useEffect(() => {
    if (!conversationId) return;

    fetchMessages(conversationId);
    if (user) markAsRead(conversationId, user.id);

    const channel = subscribeToMessages(conversationId);
    return () => { if (channel) unsubscribeChannel(channel); };
  }, [conversationId]);

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToEnd({ animated: true });
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed || !user || !conversationId) return;

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

  const renderMessage = useCallback(({ item, index }: { item: DirectMessage; index: number }) => {
    const isOwn = item.sender_id === user?.id;
    const time = formatTime(item.created_at);

    const showDateHeader = index === 0 ||
      new Date(messages[index - 1].created_at).toDateString() !== new Date(item.created_at).toDateString();

    const dateHeader = showDateHeader ? (
      <View style={styles.dateSeparator}>
        <View style={[styles.datePill, { backgroundColor: colors.backgroundSecondary }]}>
          <Text style={[styles.datePillText, { color: colors.textTertiary }]}>
            {formatDateLabel(item.created_at)}
          </Text>
        </View>
      </View>
    ) : null;

    // Image message
    if (item.message_type === 'image' && item.metadata?.image_url) {
      return (
        <Animated.View entering={FadeIn.duration(200)}>
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
        <Animated.View entering={FadeIn.duration(200)}>
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

    // Text message (default)
    return (
      <Animated.View entering={FadeIn.duration(200)}>
        {dateHeader}
        <View
          style={[
            styles.bubble,
            isOwn ? styles.ownBubble : styles.otherBubble,
            { backgroundColor: isOwn ? Colors.primary : colors.backgroundSecondary },
          ]}
        >
          <Text style={[styles.bubbleText, { color: isOwn ? '#FFF' : colors.text }]}>
            {item.content}
          </Text>
          <View style={styles.bubbleMeta}>
            <Text style={[styles.bubbleTime, { color: isOwn ? 'rgba(255,255,255,0.6)' : colors.textTertiary }]}>
              {time}
            </Text>
            {isOwn && item.is_read && (
              <Ionicons name="checkmark-done" size={14} color="rgba(255,255,255,0.6)" style={{ marginLeft: Spacing.xs }} />
            )}
          </View>
        </View>
      </Animated.View>
    );
  }, [user?.id, messages, colors]);

  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centeredState}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.textTertiary} />
          <Text style={[styles.stateText, { color: colors.textSecondary }]}>
            Mesajlari gormek icin giris yap
          </Text>
          <TouchableOpacity style={styles.primaryAction} onPress={() => router.push('/auth/login')}>
            <Text style={styles.primaryActionText}>Giris Yap</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerProfile}
          onPress={() => otherUser && router.push(`/user/${otherUser.id}`)}
          activeOpacity={0.7}
        >
          <Avatar
            uri={otherUser?.avatar_url}
            name={otherUser?.full_name || otherUser?.username || '?'}
            size={36}
          />
          <View style={styles.headerInfo}>
            <Text style={[styles.headerName, { color: colors.text }]} numberOfLines={1}>
              {otherUser?.full_name || otherUser?.username || 'Kullanici'}
            </Text>
            {otherUser?.university && (
              <Text style={[styles.headerUniversity, { color: colors.textTertiary }]} numberOfLines={1}>
                {otherUser.university}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.headerSpacer} />
      </View>

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
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}
          onLayout={scrollToBottom}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <View style={[styles.emptyChatIcon, { backgroundColor: colors.backgroundSecondary }]}>
                <Ionicons name="chatbubble-ellipses-outline" size={32} color={colors.textTertiary} />
              </View>
              <Text style={[styles.stateText, { color: colors.textSecondary }]}>
                Henuz mesaj yok — ilk adimi sen at!
              </Text>
            </View>
          }
        />

        {/* Input */}
        <View style={[styles.inputBar, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          <TouchableOpacity
            style={[styles.attachButton, { backgroundColor: colors.backgroundSecondary }]}
            onPress={() => setAttachmentSheetVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="add" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
          <TextInput
            style={[styles.inputField, { color: colors.text, backgroundColor: colors.backgroundSecondary }]}
            value={draft}
            onChangeText={setDraft}
            placeholder="Mesaj yaz..."
            placeholderTextColor={colors.textTertiary}
            multiline
            maxLength={2000}
            selectionColor={Colors.primary}
          />
          <TouchableOpacity
            onPress={handleSend}
            style={[styles.sendButton, !draft.trim() && styles.sendButtonDisabled]}
            disabled={!draft.trim()}
            activeOpacity={0.7}
          >
            <Ionicons name="send" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    gap: Spacing.md,
  },
  headerProfile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
  },
  headerUniversity: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
    marginTop: 1,
  },
  headerSpacer: {
    width: Spacing.xl,
  },

  // Messages
  messageList: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    flexGrow: 1,
  },
  dateSeparator: {
    alignItems: 'center',
    marginVertical: Spacing.lg,
  },
  datePill: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  datePillText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemiBold,
  },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  ownBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
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
    marginTop: Spacing.xs,
  },
  bubbleTime: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
  },

  // Input
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  attachButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  inputField: {
    flex: 1,
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xxl,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },

  // States
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.xxxl,
  },
  emptyChat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.xxxl * 3,
    gap: Spacing.lg,
  },
  emptyChatIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    textAlign: 'center',
    lineHeight: 22,
  },
  primaryAction: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  primaryActionText: {
    color: '#FFF',
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
  },
});
