import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFeedStore } from '../../stores/feedStore';
import { useAuthStore } from '../../stores/authStore';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../../lib/constants';
import Avatar from '../../components/ui/Avatar';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { Comment, PostImage, RecommendationAnswer } from '../../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const QUESTION_COLOR = '#8B5CF6';

function getRelativeTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return 'simdi';
  if (diffMinutes < 60) return `${diffMinutes}dk once`;
  if (diffHours < 24) return `${diffHours}sa once`;
  if (diffDays < 7) return `${diffDays}g once`;
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeColors();
  const user = useAuthStore((s) => s.user);
  const {
    selectedPost: post,
    comments,
    fetchPostById,
    fetchComments,
    toggleLike,
    addComment,
  } = useFeedStore();

  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const commentInputRef = useRef<TextInput>(null);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [answers, setAnswers] = useState<RecommendationAnswer[]>([]);
  const [upvotedAnswers, setUpvotedAnswers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (id) {
      fetchPostById(id);
      fetchComments(id);
    }
  }, [id]);

  useEffect(() => {
    if (post && user) {
      useFeedStore.getState().checkBookmark(post.id, user.id).then(setIsBookmarked);
    }
  }, [post, user]);

  useEffect(() => {
    if (post?.post_type === 'question') {
      useFeedStore.getState().fetchAnswers(post.id).then(setAnswers);
    }
  }, [post]);

  const handleLike = () => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    if (post) toggleLike(post.id, user.id);
  };

  const handleSubmitComment = async () => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    if (!commentText.trim() || !post) return;
    setSubmitting(true);

    if (post.post_type === 'question') {
      const newAnswer = await useFeedStore.getState().submitAnswer(post.id, user.id, commentText.trim());
      if (newAnswer) {
        setAnswers((prev) => [newAnswer, ...prev]);
      }
    } else {
      await addComment(post.id, user.id, commentText.trim());
    }

    setCommentText('');
    setSubmitting(false);
  };

  const handleShare = async () => {
    if (!post) return;
    const venueName = post.venue?.name ? ` @ ${post.venue.name}` : '';
    const message = `${post.caption || ''}${venueName}\n\nOgrenci Nerede Yer? uygulamasinda kesfet!`;
    try { await Share.share({ message: message.trim() }); } catch {}
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    setActiveImageIndex(index);
  };

  if (!post) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // ── Question-type post: dedicated answer layout ──
  if (post.post_type === 'question') {
    const renderAnswer = ({ item }: { item: RecommendationAnswer }) => (
      <View style={[qStyles.answerItem, { borderBottomColor: colors.borderLight }]}>
        <View style={qStyles.answerLeft}>
          <Avatar
            uri={item.user?.avatar_url}
            name={item.user?.full_name ?? item.user?.username ?? '?'}
            size={36}
          />
        </View>
        <View style={qStyles.answerContent}>
          <Text style={[qStyles.answerUsername, { color: colors.text }]}>
            {item.user?.username ?? 'Kullanici'}
          </Text>
          <Text style={[qStyles.answerText, { color: colors.text }]}>
            {item.text}
          </Text>
          {item.venue && (
            <TouchableOpacity
              style={[qStyles.venuePill, { backgroundColor: colors.backgroundSecondary }]}
              activeOpacity={0.7}
              onPress={() => router.push(`/venue/${item.venue_id}`)}
            >
              <Ionicons name="location" size={12} color={QUESTION_COLOR} />
              <Text style={[qStyles.venueText, { color: QUESTION_COLOR }]} numberOfLines={1}>
                {item.venue.name}
              </Text>
              {item.venue.overall_rating != null && (
                <>
                  <Ionicons name="star" size={10} color="#F5A623" />
                  <Text style={qStyles.venueRating}>{item.venue.overall_rating.toFixed(1)}</Text>
                </>
              )}
            </TouchableOpacity>
          )}
          <Text style={[qStyles.answerTime, { color: colors.textTertiary }]}>
            {getRelativeTime(item.created_at)}
          </Text>
        </View>
        <View style={qStyles.upvoteBox}>
          <TouchableOpacity
            activeOpacity={0.6}
            onPress={async () => {
              if (!user) { router.push('/auth/login'); return; }
              const result = await useFeedStore.getState().upvoteAnswer(item.id, user.id);
              if (result !== null) {
                setAnswers((prev) =>
                  prev.map((a) =>
                    a.id === item.id
                      ? { ...a, upvotes: (a.upvotes || 0) + (result ? 1 : -1) }
                      : a
                  ),
                );
                setUpvotedAnswers((prev) => {
                  const next = new Set(prev);
                  result ? next.add(item.id) : next.delete(item.id);
                  return next;
                });
              }
            }}
          >
            <Ionicons
              name={upvotedAnswers.has(item.id) ? 'arrow-up-circle' : 'arrow-up-circle-outline'}
              size={28}
              color={upvotedAnswers.has(item.id) ? '#E23744' : '#8B5CF6'}
            />
          </TouchableOpacity>
          <Text style={[qStyles.upvoteCount, { color: QUESTION_COLOR }]}>{item.upvotes ?? 0}</Text>
        </View>
      </View>
    );

    const renderQuestionHeader = () => (
      <View>
        {/* Question card */}
        <View style={[qStyles.questionCard, { backgroundColor: colors.background }]}>
          <View style={qStyles.questionHeader}>
            <Avatar
              uri={post.user?.avatar_url}
              name={post.user?.full_name ?? post.user?.username ?? '?'}
              size={40}
            />
            <View style={qStyles.questionHeaderText}>
              <Text style={[qStyles.questionUsername, { color: colors.text }]}>
                {post.user?.username ?? 'Kullanici'}
              </Text>
              <Text style={[qStyles.questionTime, { color: colors.textTertiary }]}>
                {getRelativeTime(post.created_at)}
              </Text>
            </View>
            <View style={qStyles.questionBadge}>
              <Ionicons name="help-circle" size={12} color="#FFFFFF" />
              <Text style={qStyles.questionBadgeText}>Soru</Text>
            </View>
          </View>
          <Text style={[qStyles.questionText, { color: colors.text }]}>
            {post.caption}
          </Text>
        </View>

        {/* Answers header */}
        <View style={[qStyles.answersHeader, { borderBottomColor: colors.borderLight }]}>
          <Ionicons name="chatbubbles" size={18} color={QUESTION_COLOR} />
          <Text style={[qStyles.answersTitle, { color: colors.text }]}>
            {answers.length} Yanit
          </Text>
        </View>
      </View>
    );

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          {/* Header bar */}
          <View style={[styles.headerBar, { borderBottomColor: colors.borderLight }]}>
            <TouchableOpacity
              onPress={() => router.back()}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[qStyles.headerTitle, { color: colors.text }]}>Soru Detayi</Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Answers list */}
          <FlatList
            data={answers}
            keyExtractor={(item) => item.id}
            renderItem={renderAnswer}
            ListHeaderComponent={renderQuestionHeader}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyComments}>
                <Ionicons name="chatbubbles-outline" size={36} color={Colors.border} />
                <Text style={[styles.emptyCommentsText, { color: colors.text }]}>Henuz yanit yok</Text>
                <Text style={[styles.emptyCommentsSubtext, { color: colors.textSecondary }]}>Ilk yaniti sen ver!</Text>
              </View>
            }
          />

          {/* Answer input bar */}
          <View style={[styles.commentBar, { borderTopColor: colors.borderLight, backgroundColor: colors.background }]}>
            <Avatar
              uri={user?.avatar_url}
              name={user?.full_name ?? user?.username ?? '?'}
              size={32}
            />
            <TextInput
              ref={commentInputRef}
              style={[styles.commentInput, { color: colors.text }]}
              placeholder="Yanitini yaz..."
              placeholderTextColor={colors.textTertiary}
              value={commentText}
              onChangeText={setCommentText}
              selectionColor={QUESTION_COLOR}
            />
            <TouchableOpacity
              onPress={handleSubmitComment}
              disabled={!commentText.trim() || submitting}
              activeOpacity={0.7}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={QUESTION_COLOR} />
              ) : (
                <Text
                  style={[
                    styles.commentSendText,
                    { color: QUESTION_COLOR },
                    !commentText.trim() && styles.commentSendTextDisabled,
                  ]}
                >
                  Gonder
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Regular post detail (existing code below) ──
  const images = post.images ?? [];

  const renderComment = ({ item }: { item: Comment }) => (
    <View style={styles.commentItem}>
      <Avatar
        uri={item.user?.avatar_url}
        name={item.user?.full_name ?? item.user?.username ?? '?'}
        size={32}
      />
      <View style={styles.commentContent}>
        <Text style={[styles.commentText, { color: colors.text }]}>
          <Text style={styles.commentUsername}>
            {item.user?.username ?? 'Kullanici'}
          </Text>
          {'  '}{item.text}
        </Text>
        <Text style={[styles.commentTime, { color: colors.textTertiary }]}>{getRelativeTime(item.created_at)}</Text>
      </View>
    </View>
  );

  const renderHeader = () => (
    <View>
      {/* Image Carousel */}
      {images.length > 0 && (
        <View style={[styles.imageSection, { backgroundColor: colors.backgroundSecondary }]}>
          <FlatList
            data={images}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            renderItem={({ item }: { item: PostImage }) => (
              <Image
                source={{ uri: item.image_url }}
                style={styles.postImage}
                resizeMode="cover"
              />
            )}
          />
          {images.length > 1 && (
            <View style={styles.pagination}>
              {images.map((_, index) => (
                <View
                  key={index}
                  style={[styles.dot, index === activeImageIndex && styles.dotActive]}
                />
              ))}
            </View>
          )}
        </View>
      )}

      {/* Action bar */}
      <View style={styles.actions}>
        <View style={styles.actionsLeft}>
          <TouchableOpacity style={styles.actionButton} onPress={handleLike} activeOpacity={0.5}>
            <Ionicons
              name={post.is_liked ? 'heart' : 'heart-outline'}
              size={26}
              color={post.is_liked ? Colors.primary : colors.text}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => commentInputRef.current?.focus()}
            activeOpacity={0.5}
          >
            <Ionicons name="chatbubble-outline" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleShare} activeOpacity={0.5}>
            <Ionicons name="share-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.actionButton}
          activeOpacity={0.5}
          onPress={async () => {
            if (!user) { router.push('/auth/login'); return; }
            const result = await useFeedStore.getState().toggleBookmark(post.id, user.id);
            if (result !== null) setIsBookmarked(result);
          }}
        >
          <Ionicons name={isBookmarked ? "bookmark" : "bookmark-outline"} size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Likes */}
      {(post.likes_count ?? 0) > 0 && (
        <Text style={[styles.likesCount, { color: colors.text }]}>{post.likes_count} begeni</Text>
      )}

      {/* Caption */}
      {post.caption ? (
        <View style={styles.captionRow}>
          <Text style={[styles.caption, { color: colors.text }]}>
            <Text style={styles.captionUsername}>
              {post.user?.username ?? 'Kullanici'}
            </Text>
            {'  '}{post.caption}
          </Text>
        </View>
      ) : null}

      {/* Comments header */}
      <View style={[styles.commentsHeader, { borderBottomColor: colors.borderLight }]}>
        <Text style={[styles.commentsTitle, { color: colors.text }]}>
          Yorumlar ({comments.length})
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Header bar */}
        <View style={[styles.headerBar, { borderBottomColor: colors.borderLight }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.headerUser}>
            <Avatar
              uri={post.user?.avatar_url}
              name={post.user?.full_name ?? post.user?.username ?? '?'}
              size={28}
            />
            <Text style={[styles.headerUsername, { color: colors.text }]}>{post.user?.username ?? 'Kullanici'}</Text>
          </View>
          <View style={{ width: 24 }} />
        </View>

        {/* Comments list */}
        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          renderItem={renderComment}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyComments}>
              <Ionicons name="chatbubbles-outline" size={36} color={Colors.border} />
              <Text style={[styles.emptyCommentsText, { color: colors.text }]}>Henuz yorum yok</Text>
              <Text style={[styles.emptyCommentsSubtext, { color: colors.textSecondary }]}>Ilk yorumu sen yap!</Text>
            </View>
          }
        />

        {/* Comment input bar */}
        <View style={[styles.commentBar, { borderTopColor: colors.borderLight, backgroundColor: colors.background }]}>
          <Avatar
            uri={user?.avatar_url}
            name={user?.full_name ?? user?.username ?? '?'}
            size={32}
          />
          <TextInput
            ref={commentInputRef}
            style={[styles.commentInput, { color: colors.text }]}
            placeholder="Yorum yaz..."
            placeholderTextColor={colors.textTertiary}
            value={commentText}
            onChangeText={setCommentText}
            selectionColor={Colors.primary}
          />
          <TouchableOpacity
            onPress={handleSubmitComment}
            disabled={!commentText.trim() || submitting}
            activeOpacity={0.7}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Text
                style={[
                  styles.commentSendText,
                  !commentText.trim() && styles.commentSendTextDisabled,
                ]}
              >
                Gonder
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },

  // Header
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerUsername: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
    color: Colors.text,
  },

  // Image Carousel
  imageSection: {
    position: 'relative',
    backgroundColor: Colors.backgroundSecondary,
  },
  postImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    bottom: Spacing.md,
    left: 0,
    right: 0,
    gap: Spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.40)',
  },
  dotActive: {
    backgroundColor: Colors.primary,
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Actions
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  actionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  actionButton: {
    padding: 2,
  },

  // Likes
  likesCount: {
    fontSize: 14,
    fontFamily: FontFamily.headingBold,
    color: Colors.text,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
  },

  // Caption
  captionRow: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
  },
  caption: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  captionUsername: {
    fontFamily: FontFamily.headingBold,
  },

  // Comments header
  commentsHeader: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  commentsTitle: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
    color: Colors.text,
  },

  // List
  listContent: {
    paddingBottom: Spacing.lg,
  },

  // Comment item
  commentItem: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  commentContent: {
    flex: 1,
  },
  commentText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  commentUsername: {
    fontFamily: FontFamily.headingBold,
  },
  commentTime: {
    fontSize: FontSize.xs,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },

  // Empty comments
  emptyComments: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
    gap: Spacing.sm,
  },
  emptyCommentsText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  emptyCommentsSubtext: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },

  // Comment bar
  commentBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: Colors.background,
    gap: Spacing.md,
  },
  commentInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
    paddingVertical: 0,
  },
  commentSendText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
    color: Colors.primary,
  },
  commentSendTextDisabled: {
    color: Colors.textTertiary,
  },
});

// ── Question-specific styles ──
const qStyles = StyleSheet.create({
  headerTitle: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
  },
  questionCard: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  questionHeaderText: {
    flex: 1,
    gap: 2,
  },
  questionUsername: {
    fontSize: 15,
    fontFamily: FontFamily.headingBold,
  },
  questionTime: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
  },
  questionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: QUESTION_COLOR,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  questionBadgeText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemiBold,
    color: '#FFFFFF',
  },
  questionText: {
    fontSize: FontSize.xl,
    fontFamily: FontFamily.headingBold,
    lineHeight: 28,
  },
  answersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  answersTitle: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
  },
  answerItem: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
    borderBottomWidth: 1,
  },
  answerLeft: {
    paddingTop: 2,
  },
  answerContent: {
    flex: 1,
    gap: Spacing.xs,
  },
  answerUsername: {
    fontSize: 14,
    fontFamily: FontFamily.headingBold,
  },
  answerText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    lineHeight: 22,
  },
  venuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 1,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.xs,
  },
  venueText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodySemiBold,
    maxWidth: 180,
  },
  venueRating: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemiBold,
    color: '#F5A623',
  },
  answerTime: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
    marginTop: 2,
  },
  upvoteBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minWidth: 36,
  },
  upvoteCount: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.headingBold,
  },
});
