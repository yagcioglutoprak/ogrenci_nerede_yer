import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Avatar from '../ui/Avatar';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../../lib/constants';
import { getRelativeTime } from '../../lib/utils';
import type { EventMessage } from '../../types';

interface MessageBubbleProps {
  message: EventMessage;
  isCurrentUser: boolean;
}

export default function MessageBubble({ message, isCurrentUser }: MessageBubbleProps) {
  const colors = useThemeColors();

  if (isCurrentUser) {
    return (
      <View style={styles.rowRight}>
        <View style={[styles.bubbleRight, { backgroundColor: Colors.primary }]}>
          <Text style={styles.textRight}>{message.message}</Text>
          <Text style={styles.timeRight}>{getRelativeTime(message.created_at)}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.rowLeft}>
      <Avatar
        uri={message.user?.avatar_url}
        name={message.user?.full_name ?? message.user?.username ?? '?'}
        size={32}
      />
      <View style={{ flex: 1 }}>
        <Text style={[styles.username, { color: colors.textSecondary }]}>
          {message.user?.username ?? 'Kullanici'}
        </Text>
        <View style={[styles.bubbleLeft, { backgroundColor: colors.backgroundSecondary }]}>
          <Text style={[styles.textLeft, { color: colors.text }]}>{message.message}</Text>
          <Text style={[styles.timeLeft, { color: colors.textTertiary }]}>
            {getRelativeTime(message.created_at)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    gap: Spacing.sm,
    maxWidth: '85%',
  },
  rowRight: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  username: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.bodySemiBold,
    marginBottom: 2,
    marginLeft: Spacing.xs,
  },
  bubbleLeft: {
    borderRadius: BorderRadius.lg,
    borderTopLeftRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  bubbleRight: {
    borderRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    maxWidth: '75%',
  },
  textLeft: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    lineHeight: 20,
  },
  textRight: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.body,
    lineHeight: 20,
    color: '#FFFFFF',
  },
  timeLeft: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
    marginTop: 2,
  },
  timeRight: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
    textAlign: 'right',
  },
});
