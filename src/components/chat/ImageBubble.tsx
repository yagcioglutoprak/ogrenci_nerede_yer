import React from 'react';
import { View, Image, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';

interface ImageBubbleProps {
  imageUrl: string;
  isOwn: boolean;
  time: string;
  isRead?: boolean;
}

export default function ImageBubble({ imageUrl, isOwn, time, isRead }: ImageBubbleProps) {
  const colors = useThemeColors();

  return (
    <View style={[styles.container, isOwn ? styles.ownContainer : styles.otherContainer]}>
      <TouchableOpacity activeOpacity={0.9} style={styles.imageWrapper}>
        <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
      </TouchableOpacity>
      <View style={[styles.meta, isOwn ? styles.ownMeta : styles.otherMeta]}>
        <Text style={[styles.time, { color: isOwn ? colors.textTertiary : colors.textTertiary }]}>
          {time}
        </Text>
        {isOwn && isRead && (
          <Ionicons name="checkmark-done" size={14} color={colors.textTertiary} style={{ marginLeft: Spacing.xs }} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    maxWidth: '72%',
    marginBottom: Spacing.sm,
  },
  ownContainer: {
    alignSelf: 'flex-end',
  },
  otherContainer: {
    alignSelf: 'flex-start',
  },
  imageWrapper: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  image: {
    width: 240,
    height: 180,
    borderRadius: BorderRadius.lg,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  ownMeta: {
    justifyContent: 'flex-end',
  },
  otherMeta: {
    justifyContent: 'flex-start',
  },
  time: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.body,
  },
});
