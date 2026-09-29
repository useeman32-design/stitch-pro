import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, shadows, spacing } from '@/theme';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  padded?: boolean;
  elevated?: boolean;
  bordered?: boolean;
}

export function Card({
  children,
  style,
  onPress,
  padded = true,
  elevated = true,
  bordered = true,
}: CardProps) {
  const content = (
    <View
      style={[
        styles.base,
        padded && styles.padded,
        bordered && styles.bordered,
        elevated && (shadows.card as ViewStyle),
        style,
      ]}
    >
      {children}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
  },
  padded: {
    padding: spacing.lg,
  },
  bordered: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
});
