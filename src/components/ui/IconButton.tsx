import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius } from '@/theme';

interface IconButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  size?: number;
  variant?: 'ghost' | 'filled' | 'outline';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel: string;
}

export function IconButton({
  children,
  onPress,
  size = 40,
  variant = 'ghost',
  style,
  accessibilityLabel,
}: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.base,
        { width: size, height: size, borderRadius: size / 2.6 },
        variant === 'filled' && { backgroundColor: colors.gray100 },
        variant === 'outline' && { borderWidth: 1, borderColor: colors.border },
        pressed && { backgroundColor: colors.gray100 },
        style,
      ]}
    >
      <View style={styles.center}>{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
