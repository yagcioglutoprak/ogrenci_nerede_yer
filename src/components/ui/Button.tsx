import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize } from '../../lib/constants';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  fullWidth = true,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const textColor = getTextColor(variant, isDisabled);

  const containerStyles: StyleProp<ViewStyle>[] = [
    styles.base,
    variantStyles[variant],
    isDisabled && styles.disabled,
    variant === 'primary' && !isDisabled && styles.primaryShadow,
    variant === 'secondary' && !isDisabled && styles.secondaryShadow,
    fullWidth && styles.fullWidth,
    style,
  ];

  return (
    <TouchableOpacity
      style={containerStyles}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <View style={styles.content}>
          {icon && iconPosition === 'left' && (
            <Ionicons
              name={icon}
              size={20}
              color={textColor}
              style={styles.iconLeft}
            />
          )}
          <Text style={[styles.text, { color: textColor }]}>{title}</Text>
          {icon && iconPosition === 'right' && (
            <Ionicons
              name={icon}
              size={20}
              color={textColor}
              style={styles.iconRight}
            />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

function getTextColor(variant: ButtonVariant, isDisabled: boolean): string {
  if (isDisabled) {
    if (variant === 'outline' || variant === 'ghost') {
      return Colors.textTertiary;
    }
    return 'rgba(255, 255, 255, 0.6)';
  }

  switch (variant) {
    case 'primary':
      return Colors.textOnPrimary;
    case 'secondary':
      return Colors.textOnPrimary;
    case 'outline':
      return Colors.primary;
    case 'ghost':
      return Colors.primary;
  }
}

const variantStyles = StyleSheet.create({
  primary: {
    backgroundColor: Colors.primary,
  },
  secondary: {
    backgroundColor: Colors.accent,
  },
  outline: {
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
});

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    paddingHorizontal: Spacing.xxl,
    borderRadius: 14,
  },
  fullWidth: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: FontSize.md,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  iconLeft: {
    marginRight: Spacing.sm,
  },
  iconRight: {
    marginLeft: Spacing.sm,
  },
  disabled: {
    opacity: 0.45,
  },
  primaryShadow: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
  },
  secondaryShadow: {
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 6,
  },
});
