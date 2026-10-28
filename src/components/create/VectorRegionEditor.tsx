import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Trash2 } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/theme';
import type { VectorRegion } from '@/services/digitizing/backendClient';

interface VectorRegionEditorProps {
  widthMm: number;
  heightMm: number;
  /** Every region currently kept -- i.e. the live, editable design, not
   * the original vectorize() output (the caller owns removal/undo
   * history; this component only renders + reports taps). */
  regions: VectorRegion[];
  onDeleteRegion: (id: string) => void;
}

/**
 * Renders every traced region as a real, selectable/deletable vector path
 * (brief: "select, delete, and redraw/clean up vector regions after
 * generation, if the auto-generated vector doesn't look right"). Redrawing
 * a region from scratch is a larger follow-up (see continue.md); this
 * covers the select + delete half, which is also the half that actually
 * fixes "the auto-vectorization looks wrong" -- pull the bad shape out
 * and re-digitize with what's left.
 */
export function VectorRegionEditor({ widthMm, heightMm, regions, onDeleteRegion }: VectorRegionEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    setStageSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });
  };

  const viewBox = `0 0 ${widthMm} ${heightMm}`;

  const paths = useMemo(
    () =>
      regions.map((region) => ({
        id: region.id,
        colorHex: region.colorHex,
        d: ringsToPathD(region.rings),
      })),
    [regions]
  );

  const selected = regions.find((r) => r.id === selectedId) ?? null;

  return (
    <View style={styles.wrap}>
      <View style={styles.stage} onLayout={onLayout}>
        {stageSize.width > 0 && (
          <Svg width="100%" height="100%" viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
            <Path d={`M0,0 H${widthMm} V${heightMm} H0 Z`} fill={colors.white} />
            {paths.map((p) => (
              <Path
                key={p.id}
                d={p.d}
                fill={p.colorHex}
                fillRule="evenodd"
                stroke={p.id === selectedId ? colors.indigo : 'transparent'}
                strokeWidth={p.id === selectedId ? Math.max(widthMm, heightMm) * 0.01 : 0}
                onPress={() => setSelectedId(p.id === selectedId ? null : p.id)}
              />
            ))}
          </Svg>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={[typography.bodySmall, styles.countLabel]}>
          {regions.length} region{regions.length === 1 ? '' : 's'} · tap a shape to select it
        </Text>
        {selected && (
          <View style={styles.selectedRow}>
            <View style={[styles.swatch, { backgroundColor: selected.colorHex }]} />
            <Text style={[typography.caption, styles.selectedLabel]} numberOfLines={1}>
              {selected.colorHex} · {selected.areaMm2.toFixed(1)} mm²
            </Text>
            <Pressable
              onPress={() => {
                onDeleteRegion(selected.id);
                setSelectedId(null);
              }}
              style={styles.deleteBtn}
            >
              <Trash2 size={14} color={colors.white} />
              <Text style={[typography.caption, { color: colors.white }]}>Delete</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

/** Converts `rings` ([outer, ...holes], each a list of [xMm, yMm] points)
 * into a single SVG path `d` string with `fill-rule="evenodd"`, so holes
 * render as real holes (consistent with how EmbroideryObject.geometry is
 * interpreted everywhere else in this app). */
function ringsToPathD(rings: [number, number][][]): string {
  return rings
    .map((ring) => {
      if (!ring.length) return '';
      const [first, ...rest] = ring;
      const moveTo = `M${first[0]},${first[1]}`;
      const lines = rest.map(([x, y]) => `L${x},${y}`).join(' ');
      return `${moveTo} ${lines} Z`;
    })
    .join(' ');
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  stage: {
    height: 320,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  footer: {
    gap: spacing.xs,
  },
  countLabel: {
    color: colors.textTertiary,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.gray100,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  swatch: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedLabel: {
    flex: 1,
    color: colors.textSecondary,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.danger,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
});
