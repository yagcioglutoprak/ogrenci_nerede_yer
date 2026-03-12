import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Spacing } from '../../lib/constants';
import { useThemeColors } from '../../hooks/useThemeColors';

interface DividerProps {
  spacing?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

const Divider = React.memo(function Divider({
  spacing = Spacing.md,
  color,
  style,
}: DividerProps) {
  const colors = useThemeColors();

  return (
    <View
      style={[
        styles.line,
        {
          backgroundColor: color ?? colors.borderLight,
          marginVertical: spacing,
        },
        style,
      ]}
    />
  );
});

export default Divider;

const styles = StyleSheet.create({
  line: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
});
