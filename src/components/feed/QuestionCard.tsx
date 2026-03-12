import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily, FeatureColors } from '../../lib/constants';
import { getRelativeTime } from '../../lib/utils';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { Post, RecommendationAnswer } from '../../types';
import Avatar from '../ui/Avatar';
import GlassView from '../ui/GlassView';

interface QuestionCardProps {
  post: Post;
  topAnswers?: RecommendationAnswer[];
  totalAnswers?: number;
  onAnswer: (postId: string) => void;
  onUserPress: (userId: string) => void;
  onVenuePress?: (venueId: string) => void;
  onPress?: () => void;
}

function QuestionCard({
  post,
  topAnswers,
  totalAnswers,
  onAnswer,
  onUserPress,
  onVenuePress,
  onPress,
}: QuestionCardProps) {
  const colors = useThemeColors();
  const timeSince = getRelativeTime(post.created_at);

  const sortedAnswers = (topAnswers ?? [])
    .slice()
    .sort((a, b) => (b.upvotes ?? 0) - (a.upvotes ?? 0))
    .slice(0, 2);

  const answerCount = totalAnswers ?? sortedAnswers.length;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: Platform.OS === 'ios' ? 'transparent' : colors.background,
          borderColor: Platform.OS === 'ios' ? 'rgba(255,255,255,0.5)' : colors.borderLight,
        },
      ]}
      activeOpacity={0.85}
      onPress={onPress}
      accessibilityLabel={`${post.caption || 'Soru'} tavsiye sorusu`}
      accessibilityRole="button"
    >
      {Platform.OS === 'ios' && (
        <GlassView style={[StyleSheet.absoluteFill, { borderRadius: BorderRadius.lg }]} fallbackColor={colors.card} />
      )}

      {/* Header: Avatar + Username + Time + Question Badge */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => post.user && onUserPress(post.user_id)}
          activeOpacity={0.7}
        >
          <Avatar
            uri={post.user?.avatar_url}
            name={post.user?.full_name ?? post.user?.username ?? '?'}
            size={38}
          />
        </TouchableOpacity>

        <View style={styles.headerText}>
          <TouchableOpacity
            onPress={() => post.user && onUserPress(post.user_id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.username, { color: colors.text }]} numberOfLines={1}>
              {post.user?.username ?? 'Kullanici'}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.time, { color: colors.textTertiary }]}>{timeSince}</Text>
        </View>

        <View style={styles.questionBadge}>
          <Ionicons name="help-circle" size={12} color="#FFFFFF" />
          <Text style={styles.questionBadgeText}>Soru</Text>
        </View>
      </View>

      {/* Question Text */}
      <View style={styles.questionBody}>
        <Text style={[styles.questionText, { color: colors.text }]}>
          {post.caption}
        </Text>
      </View>

      {/* Top Answers Preview */}
      {sortedAnswers.length > 0 && (
        <View style={[styles.answersSection, { borderTopColor: colors.borderLight }]}>
          {sortedAnswers.map((answer) => (
            <View key={answer.id} style={styles.answerRow}>
              <TouchableOpacity
                onPress={() => answer.user && onUserPress(answer.user_id)}
                activeOpacity={0.7}
              >
                <Avatar
                  uri={answer.user?.avatar_url}
                  name={answer.user?.full_name ?? answer.user?.username ?? '?'}
                  size={24}
                />
              </TouchableOpacity>

              <View style={styles.answerContent}>
                <View style={styles.answerTopRow}>
                  <Text
                    style={[styles.answerUsername, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {answer.user?.username ?? 'Kullanici'}
                  </Text>
                  {answer.venue && (
                    <TouchableOpacity
                      onPress={() =>
                        answer.venue && onVenuePress?.(answer.venue.id)
                      }
                      activeOpacity={0.7}
                      style={[styles.answerVenuePill, { backgroundColor: colors.backgroundSecondary }]}
                    >
                      <Ionicons name="location" size={10} color={colors.textTertiary} />
                      <Text
                        style={[styles.answerVenueText, { color: colors.textSecondary }]}
                        numberOfLines={1}
                      >
                        {answer.venue.name}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text
                  style={[styles.answerText, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {answer.text}
                </Text>
              </View>

              <View style={styles.upvoteContainer}>
                <Ionicons name="arrow-up" size={14} color={colors.textTertiary} />
                <Text style={[styles.upvoteCount, { color: colors.textTertiary }]}>
                  {answer.upvotes ?? 0}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Footer */}
      <View style={[styles.footer, { borderTopColor: colors.borderLight }]}>
        {answerCount > 0 ? (
          <TouchableOpacity onPress={onPress} activeOpacity={0.6}>
            <Text style={[styles.answersLink, { color: FeatureColors.question }]}>
              {answerCount} yanit
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={[styles.noAnswersText, { color: colors.textTertiary }]}>
            Henuz yanit yok
          </Text>
        )}

        <TouchableOpacity
          style={styles.answerButton}
          activeOpacity={0.7}
          onPress={() => onAnswer(post.id)}
        >
          <Ionicons name="chatbubble-outline" size={16} color={FeatureColors.question} />
          <Text style={styles.answerButtonText}>Yanitla</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Spacing.md,
  },
  headerText: {
    flex: 1,
    gap: 1,
  },
  username: {
    fontSize: 14,
    fontFamily: FontFamily.headingBold,
    letterSpacing: -0.1,
  },
  time: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
  },
  questionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: FeatureColors.question,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  questionBadgeText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemiBold,
    color: '#FFFFFF',
  },

  // Question Body
  questionBody: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  questionText: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.headingBold,
    lineHeight: 24,
  },

  // Answers Section
  answersSection: {
    borderTopWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  answerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  answerContent: {
    flex: 1,
    gap: 2,
  },
  answerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  answerUsername: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemiBold,
  },
  answerVenuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  answerVenueText: {
    fontSize: 10,
    fontFamily: FontFamily.bodyMedium,
    maxWidth: 100,
  },
  answerText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
    lineHeight: 17,
  },
  upvoteContainer: {
    alignItems: 'center',
    gap: 1,
    minWidth: 28,
  },
  upvoteCount: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemiBold,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  answersLink: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodySemiBold,
  },
  noAnswersText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.body,
  },
  answerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: FeatureColors.question,
  },
  answerButtonText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bodySemiBold,
    color: FeatureColors.question,
  },
});

export default React.memo(QuestionCard);
