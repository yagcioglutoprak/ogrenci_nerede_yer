import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';

type IoniconName = keyof typeof Ionicons.glyphMap;

interface CirclePickerProps {
  value: number;
  icons: IoniconName[];
  onValueChange?: (value: number) => void;
  color?: string;
  size?: number;
}

export default function CirclePicker({
  value,
  icons,
  onValueChange,
  color = Colors.primary,
  size = 42,
}: CirclePickerProps) {
  const colors = useThemeColors();

  return (
    <View style={styles.container}>
      {icons.map((icon, i) => {
        const step = i + 1;
        const filled = step <= value;

        return (
          <TouchableOpacity
            key={step}
            onPress={() => onValueChange?.(step)}
            activeOpacity={0.6}
            style={[
              styles.circle,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                backgroundColor: filled ? color : colors.backgroundSecondary,
                borderWidth: filled ? 0 : 1.5,
                borderColor: filled ? 'transparent' : colors.border,
              },
            ]}
          >
            <Ionicons
              name={icon}
              size={size * 0.42}
              color={filled ? '#FFFFFF' : colors.textTertiary}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
