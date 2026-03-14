import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors, Spacing, BorderRadius, FontSize, FontFamily } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';
import { haptic } from '../../lib/haptics';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

function ErrorState({
  message = 'Bir hata olustu. Lutfen tekrar deneyin.',
  onRetry,
}: ErrorStateProps) {
  const colors = useThemeColors();

  const handleRetry = useCallback(() => {
    haptic.light();
    onRetry?.();
  }, [onRetry]);

  return (
    <Animated.View
      entering={FadeInDown.springify().damping(20).stiffness(300)}
      style={styles.container}
    >
      <Animated.View
        entering={FadeInDown.delay(80).springify().damping(20).stiffness(300)}
        style={[styles.iconCircle, { backgroundColor: colors.primarySoft }]}
      >
        <Ionicons name="alert-circle-outline" size={40} color={Colors.error} />
      </Animated.View>
      <Animated.Text
        entering={FadeInDown.delay(160).springify().damping(20).stiffness(300)}
        style={[styles.message, { color: colors.textSecondary }]}
      >
        {message}
      </Animated.Text>
      {onRetry && (
        <Animated.View
          entering={FadeInDown.delay(240).springify().damping(20).stiffness(300)}
        >
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRetry}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={18} color="#FFFFFF" />
            <Text style={styles.retryText}>Tekrar Dene</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </Animated.View>
  );
}

export default React.memo(ErrorState);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxxl + 8,
    paddingHorizontal: Spacing.xxxl,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  message: {
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  retryText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.headingBold,
    color: '#FFFFFF',
  },
});
