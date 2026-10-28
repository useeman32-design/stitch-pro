import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';

interface ChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  /** Optional leading icon -- e.g. the restore/erase brush-mode toggle on
   * create/auto-digitize's background-mask brush. Omit for the plain
   * text-only chip every other caller already uses. */
  icon?: React.ReactNode;
}

export function Chip({ label, active, onPress, icon }: ChipProps) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive, !!icon && styles.chipWithIcon]}>
      {icon}
      <Text
        style={[
          typography.bodySmall,
          { color: active ? colors.white : colors.textSecondary },
          active && { fontFamily: typography.bodyMedium.fontFamily },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.gray100,
  },
  chipActive: {
    backgroundColor: colors.indigo,
  },
  chipWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
