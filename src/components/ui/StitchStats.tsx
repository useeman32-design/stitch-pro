import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Layers, Palette, Ruler, Clock, Repeat, MoveDiagonal, Scissors } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/theme';

export interface StitchStatItem {
  icon: LucideIcon;
  label: string;
  value: string;
}

interface StitchStatsProps {
  stitches: number;
  colors: number;
  estimatedThreadMeters: number;
  estimatedTimeMinutes: number;
  threadChanges: number;
  jumps: number;
  trims: number;
  sizeMm: { width: number; height: number };
}

export function StitchStats(props: StitchStatsProps) {
  const items: StitchStatItem[] = [
    { icon: Layers, label: 'Stitches', value: props.stitches.toLocaleString() },
    { icon: Palette, label: 'Colors', value: String(props.colors) },
    { icon: Ruler, label: 'Size', value: `${props.sizeMm.width} × ${props.sizeMm.height} mm` },
    { icon: Clock, label: 'Est. Time', value: `${props.estimatedTimeMinutes} min` },
    { icon: Repeat, label: 'Thread Changes', value: String(props.threadChanges) },
    { icon: MoveDiagonal, label: 'Jumps', value: String(props.jumps) },
    { icon: Scissors, label: 'Trims', value: String(props.trims) },
    { icon: Layers, label: 'Thread Used', value: `${props.estimatedThreadMeters} m` },
  ];

  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <View key={item.label} style={styles.cell}>
          <View style={styles.iconWrap}>
            <item.icon size={15} color={colors.indigo} strokeWidth={2.2} />
          </View>
          <View>
            <Text style={[typography.cardTitle, { color: colors.textPrimary }]}>{item.value}</Text>
            <Text style={[typography.tiny, { color: colors.textTertiary }]}>{item.label}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  cell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.gray50,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    flexGrow: 1,
    flexBasis: '46%',
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: radius.xs,
    backgroundColor: colors.indigoTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
