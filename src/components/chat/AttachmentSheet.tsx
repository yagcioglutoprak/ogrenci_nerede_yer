import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown, Easing } from 'react-native-reanimated';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';

interface AttachmentSheetProps {
  visible: boolean;
  onClose: () => void;
  onPickPhoto: () => void;
  onPickVenue: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function AttachmentSheet({ visible, onClose, onPickPhoto, onPickVenue }: AttachmentSheetProps) {
  const colors = useThemeColors();

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Backdrop */}
      {visible && (
        <AnimatedPressable
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(150)}
          style={styles.backdrop}
          onPress={onClose}
        />
      )}

      {/* Sheet */}
      {visible && (
        <Animated.View
          entering={SlideInDown.duration(250).easing(Easing.out(Easing.cubic))}
          exiting={SlideOutDown.duration(200).easing(Easing.in(Easing.cubic))}
          style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.borderLight }]}
        >
          <View style={styles.handle}>
            <View style={[styles.handleBar, { backgroundColor: colors.textTertiary }]} />
          </View>

          <TouchableOpacity
            style={styles.optionRow}
            onPress={() => { onClose(); onPickPhoto(); }}
            activeOpacity={0.7}
          >
            <View style={[styles.optionIcon, { backgroundColor: Colors.primarySoft }]}>
              <Ionicons name="camera-outline" size={22} color={Colors.primary} />
            </View>
            <Text style={[styles.optionLabel, { color: colors.text }]}>Fotograf Gonder</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionRow}
            onPress={() => { onClose(); onPickVenue(); }}
            activeOpacity={0.7}
          >
            <View style={[styles.optionIcon, { backgroundColor: Colors.accentSoft }]}>
              <Ionicons name="location-outline" size={22} color={Colors.accent} />
            </View>
            <Text style={[styles.optionLabel, { color: colors.text }]}>Mekan Paylas</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: Spacing.xxxl,
  },
  handle: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    opacity: 0.3,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    gap: Spacing.lg,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.bodySemiBold,
  },
});
