import React from 'react';
import { View, Image, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, FontSize, FontFamily } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';
import type { MessageStatus } from '../../types';

interface ImageBubbleProps {
  imageUrl: string;
  isOwn: boolean;
  time: string;
  status?: MessageStatus;
}

function StatusIcon({ status }: { status: MessageStatus }) {
  switch (status) {
    case 'sending':
      return <Ionicons name="time-outline" size={13} color="rgba(255,255,255,0.7)" style={{ marginLeft: 3 }} />;
    case 'sent':
      return <Ionicons name="checkmark" size={13} color="rgba(255,255,255,0.7)" style={{ marginLeft: 3 }} />;
    case 'seen':
      return <Ionicons name="checkmark-done" size={13} color={Colors.accent} style={{ marginLeft: 3 }} />;
  }
}

export default function ImageBubble({ imageUrl, isOwn, time, status }: ImageBubbleProps) {
  const colors = useThemeColors();

  return (
    <View style={[styles.container, isOwn ? styles.ownContainer : styles.otherContainer]}>
      <TouchableOpacity
        activeOpacity={0.9}
        style={[
          styles.imageWrapper,
          { shadowColor: colors.shadow },
          isOwn ? styles.ownImageWrapper : styles.otherImageWrapper,
        ]}
      >
        <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.45)']}
          style={styles.timeOverlay}
        >
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{time}</Text>
            {isOwn && status && <StatusIcon status={status} />}
          </View>
        </LinearGradient>
      </TouchableOpacity>
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
    borderRadius: 20,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  ownImageWrapper: {
    borderBottomRightRadius: 6,
  },
  otherImageWrapper: {
    borderBottomLeftRadius: 6,
  },
  image: {
    width: 250,
    height: 190,
  },
  timeOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    paddingTop: Spacing.xxl,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  timeText: {
    fontSize: 11,
    fontFamily: FontFamily.bodySemiBold,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.1,
  },
});
