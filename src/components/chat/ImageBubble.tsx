import React from 'react';
import { View, Image, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, FontSize, FontFamily } from '../../lib/constants';
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
      <TouchableOpacity
        activeOpacity={0.9}
        style={[
          styles.imageWrapper,
          { shadowColor: colors.shadow },
          isOwn ? styles.ownImageWrapper : styles.otherImageWrapper,
        ]}
      >
        <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
        {/* Time overlay inside the image */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.45)']}
          style={styles.timeOverlay}
        >
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{time}</Text>
            {isOwn && isRead && (
              <Ionicons name="checkmark-done" size={13} color="rgba(255,255,255,0.7)" style={{ marginLeft: 3 }} />
            )}
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
