import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextInputProps,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  interpolateColor,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';
import { haptic } from '../../lib/haptics';
import GlassView from './GlassView';

const FOCUS_SPRING = { damping: 22, stiffness: 340 };

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  secureTextEntry?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  multiline?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function Input({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  secureTextEntry = false,
  icon,
  multiline = false,
  style,
  ...rest
}: InputProps) {
  const colors = useThemeColors();
  const [isFocused, setIsFocused] = useState(false);
  const [isSecureVisible, setIsSecureVisible] = useState(false);

  const focusProgress = useSharedValue(0);

  const hasError = Boolean(error);
  const showSecureToggle = secureTextEntry;

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    focusProgress.value = withSpring(1, FOCUS_SPRING);
    haptic.selection();
  }, [focusProgress]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    focusProgress.value = withSpring(0, FOCUS_SPRING);
  }, [focusProgress]);

  const animatedBorderStyle = useAnimatedStyle(() => {
    if (hasError) {
      return {
        borderColor: colors.error,
        shadowColor: colors.error,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: focusProgress.value * 0.12,
        shadowRadius: focusProgress.value * 8,
        elevation: focusProgress.value * 2,
      };
    }

    const borderColor = interpolateColor(
      focusProgress.value,
      [0, 1],
      ['transparent', colors.borderFocus]
    );

    return {
      borderColor,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: focusProgress.value * 0.08,
      shadowRadius: focusProgress.value * 8,
      elevation: focusProgress.value * 2,
    };
  });

  const wrapperBackgroundColor = isFocused
    ? colors.background
    : colors.backgroundSecondary;

  const isIOS = Platform.OS === 'ios';

  const inputContent = (
    <>
      {icon && (
        <Ionicons
          name={icon}
          size={20}
          color={
            hasError
              ? colors.error
              : isFocused
                ? colors.primary
                : colors.textTertiary
          }
          style={styles.leadingIcon}
        />
      )}

      <TextInput
        style={[
          styles.input,
          { color: colors.text },
          multiline && styles.inputMultiline,
        ]}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry && !isSecureVisible}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        onFocus={handleFocus}
        onBlur={handleBlur}
        selectionColor={colors.primary}
        {...rest}
      />

      {showSecureToggle && (
        <TouchableOpacity
          onPress={() => setIsSecureVisible(!isSecureVisible)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.secureToggle}
        >
          <Ionicons
            name={isSecureVisible ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color={colors.textTertiary}
          />
        </TouchableOpacity>
      )}
    </>
  );

  const wrapperBaseStyles: StyleProp<ViewStyle>[] = [
    styles.inputWrapper,
    multiline && styles.inputWrapperMultiline,
  ];

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>}

      {isIOS ? (
        <Animated.View style={animatedBorderStyle}>
          <GlassView
            style={[
              ...wrapperBaseStyles,
              hasError && [styles.inputWrapperError, { backgroundColor: colors.primarySoft }],
            ]}
            blurIntensity={60}
          >
            {inputContent}
          </GlassView>
        </Animated.View>
      ) : (
        <Animated.View
          style={[
            ...wrapperBaseStyles,
            {
              backgroundColor: wrapperBackgroundColor,
            },
            hasError && [styles.inputWrapperError, { backgroundColor: colors.primarySoft }],
            animatedBorderStyle,
          ]}
        >
          {inputContent}
        </Animated.View>
      )}

      {hasError && (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle" size={14} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    letterSpacing: 0.1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: Spacing.lg,
    height: 52,
    borderColor: 'transparent',
  },
  inputWrapperError: {
    backgroundColor: Colors.primarySoft,
  },
  inputWrapperMultiline: {
    alignItems: 'flex-start',
    height: 'auto' as any,
    minHeight: 110,
    paddingVertical: Spacing.md,
  },
  leadingIcon: {
    marginRight: Spacing.md,
  },
  input: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '400',
    color: Colors.text,
    paddingVertical: 0,
    height: '100%',
  },
  inputMultiline: {
    minHeight: 86,
    paddingTop: 2,
    height: 'auto' as any,
  },
  secureToggle: {
    marginLeft: Spacing.sm,
    padding: Spacing.xs,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  errorText: {
    fontSize: FontSize.sm,
    color: Colors.error,
    fontWeight: '500',
  },
});
