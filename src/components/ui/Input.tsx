import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius, FontSize } from '../../lib/constants';

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
  const [isFocused, setIsFocused] = useState(false);
  const [isSecureVisible, setIsSecureVisible] = useState(false);

  const hasError = Boolean(error);
  const showSecureToggle = secureTextEntry;

  const wrapperBorderColor = hasError
    ? Colors.error
    : isFocused
      ? Colors.borderFocus
      : 'transparent';

  const wrapperBackgroundColor = isFocused
    ? Colors.background
    : Colors.backgroundSecondary;

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View
        style={[
          styles.inputWrapper,
          {
            borderColor: wrapperBorderColor,
            backgroundColor: wrapperBackgroundColor,
          },
          isFocused && styles.inputWrapperFocused,
          hasError && styles.inputWrapperError,
          multiline && styles.inputWrapperMultiline,
        ]}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={20}
            color={
              hasError
                ? Colors.error
                : isFocused
                  ? Colors.primary
                  : Colors.textTertiary
            }
            style={styles.leadingIcon}
          />
        )}

        <TextInput
          style={[
            styles.input,
            multiline && styles.inputMultiline,
          ]}
          placeholder={placeholder}
          placeholderTextColor={Colors.textTertiary}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry && !isSecureVisible}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          selectionColor={Colors.primary}
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
              color={Colors.textTertiary}
            />
          </TouchableOpacity>
        )}
      </View>

      {hasError && (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle" size={14} color={Colors.error} />
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
  },
  inputWrapperFocused: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
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
