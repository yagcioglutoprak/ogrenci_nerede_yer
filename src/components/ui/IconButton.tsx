import React from 'react';
import {
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '../../hooks/useThemeColors';

interface IconButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  size?: number;
  iconSize?: number;
  color?: string;
  backgroundColor?: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  hitSlop?: number;
}

const IconButton = React.memo(function IconButton({
  icon,
  size = 38,
  iconSize = 20,
  color,
  backgroundColor,
  onPress,
  style,
  accessibilityLabel,
  hitSlop = 8,
}: IconButtonProps) {
  const colors = useThemeColors();

  const resolvedColor = color ?? colors.text;
  const resolvedBg = backgroundColor ?? colors.backgroundSecondary;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={{ top: hitSlop, right: hitSlop, bottom: hitSlop, left: hitSlop }}
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: resolvedBg,
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={iconSize} color={resolvedColor} />
    </TouchableOpacity>
  );
});

export default IconButton;

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
