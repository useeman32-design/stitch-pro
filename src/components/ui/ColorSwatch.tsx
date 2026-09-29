import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/theme';

interface ColorSwatchProps {
  hex: string;
  label?: string;
  sublabel?: string;
  size?: number;
  selected?: boolean;
  onPress?: () => void;
}

export function ColorSwatch({
  hex,
  label,
  sublabel,
  size = 36,
  selected = false,
  onPress,
}: ColorSwatchProps) {
  const isLight = isLightColor(hex);

  const swatch = (
    <View
      style={[
        styles.swatch,
        { width: size, height: size, borderRadius: size / 3.2, backgroundColor: hex },
        !isLight ? styles.swatchDarkBorder : styles.swatchLightBorder,
        selected && styles.swatchSelected,
      ]}
    >
      {selected && <Check size={size * 0.42} color={isLight ? colors.textPrimary : colors.white} strokeWidth={3} />}
    </View>
  );

  if (!label) {
    return onPress ? (
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={hex}>
        {swatch}
      </Pressable>
    ) : (
      swatch
    );
  }

  const content = (
    <View style={styles.row}>
      {swatch}
      <View style={{ flex: 1 }}>
        <Text style={[typography.bodySmall, { color: colors.textPrimary }]} numberOfLines={1}>
          {label}
        </Text>
        {sublabel ? (
          <Text style={[typography.caption, { color: colors.textTertiary }]} numberOfLines={1}>
            {sublabel}
          </Text>
        ) : null}
      </View>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.pressableRow, pressed && { opacity: 0.85 }]}
    >
      {content}
    </Pressable>
  );
}

function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '');
  if (c.length < 6) return true;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 200;
}

const styles = StyleSheet.create({
  swatch: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchLightBorder: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  swatchDarkBorder: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  swatchSelected: {
    borderWidth: 2,
    borderColor: colors.indigo,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pressableRow: {
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
});
