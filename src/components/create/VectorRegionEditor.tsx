import React, { useCallback, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Polyline } from 'react-native-svg';
import { Brush, Plus, Trash2, X } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/theme';
import type { VectorRegion } from '@/services/digitizing/backendClient';
import { polygonArea, shouldAppendPoint, simplifyPolyline, type Point } from '@/utils/polygonGeometry';

interface VectorRegionEditorProps {
  widthMm: number;
  heightMm: number;
  /** Every region currently kept -- i.e. the live, editable design, not
   * the original vectorize() output (the caller owns removal/undo
   * history; this component only renders + reports taps and edits). */
  regions: VectorRegion[];
  onDeleteRegion: (id: string) => void;
  /** Replaces one region's shape with a freehand-drawn replacement,
   * keeping its existing color -- the "redraw" half of "select, delete,
   * and redraw vector regions after generation, if the auto-generated
   * vector doesn't look right". */
  onRedrawRegion: (id: string, rings: VectorRegion['rings'], areaMm2: number) => void;
  /** Adds a brand-new freehand-drawn region in the given color -- covers
   * the case where auto-vectorization *missed* a real design element
   * entirely, not just traced an existing one wrong. */
  onAddRegion: (region: { colorHex: string; rings: VectorRegion['rings']; areaMm2: number }) => void;
}

type DrawMode = { kind: 'redraw'; targetId: string; colorHex: string } | { kind: 'add'; colorHex: string } | null;

// Minimum on-screen drag distance (in mm, i.e. viewBox units) before a new
// point is appended to the live freehand path -- keeps a long/slow drag's
// point array bounded without needing to wait for the final simplify.
const LIVE_DECIMATE_MM_FRACTION = 0.003; // ~0.3% of the longer design side
// Final Ramer-Douglas-Peucker epsilon applied once the user lifts their
// finger, as a fraction of the longer design side -- removes near-
// collinear noise from a hand-drawn line without losing real corners.
const SIMPLIFY_EPSILON_MM_FRACTION = 0.006;
const MIN_POINTS_TO_ACCEPT = 3;

/**
 * Renders every traced region as a real, selectable/deletable/redrawable
 * vector path (brief: "select, delete, and redraw/clean up vector regions
 * after generation, if the auto-generated vector doesn't look right").
 * Three tools share one `Svg` stage:
 *   - Select (default): tap a shape to select it, see its color/area, and
 *     Delete or Redraw it.
 *   - Redraw: replaces the selected region's shape with a fresh freehand
 *     outline (same color, holes dropped -- redrawing is meant for "this
 *     traced boundary is wrong shape entirely", not fine hole-editing).
 *   - Add Shape: draws a brand-new region from scratch, for a design
 *     element auto-vectorization missed outright. Color is chosen from the
 *     existing palette (or the currently selected region's color) via a
 *     small swatch row -- a full custom color picker is out of scope here,
 *     since every actually-used thread color already appears in `regions`.
 */
export function VectorRegionEditor({
  widthMm,
  heightMm,
  regions,
  onDeleteRegion,
  onRedrawRegion,
  onAddRegion,
}: VectorRegionEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [drawMode, setDrawMode] = useState<DrawMode>(null);
  const [swatchPickerOpen, setSwatchPickerOpen] = useState(false);
  const [livePoints, setLivePoints] = useState<Point[] | null>(null);

  const pageOffsetRef = useRef({ x: 0, y: 0 });
  const drawingRef = useRef(false);
  const stageRef = useRef<React.ElementRef<typeof View> | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    setStageSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });
    const node = stageRef.current as unknown as {
      measure?: (cb: (x: number, y: number, w: number, h: number, pageX: number, pageY: number) => void) => void;
    } | null;
    node?.measure?.((_x, _y, _w, _h, pageX, pageY) => {
      pageOffsetRef.current = { x: pageX, y: pageY };
    });
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

  const existingColors = useMemo(() => Array.from(new Set(regions.map((r) => r.colorHex))), [regions]);

  const selected = regions.find((r) => r.id === selectedId) ?? null;
  const longerSideMm = Math.max(widthMm, heightMm);

  // Maps a page-space screen point to mm/viewBox space, accounting for the
  // Svg's `preserveAspectRatio="xMidYMid meet"` letterboxing (the stage's
  // own aspect ratio rarely matches widthMm:heightMm exactly).
  const screenToMm = useCallback(
    (screenX: number, screenY: number): Point | null => {
      if (stageSize.width <= 0 || stageSize.height <= 0) return null;
      const scale = Math.min(stageSize.width / widthMm, stageSize.height / heightMm);
      const renderedW = widthMm * scale;
      const renderedH = heightMm * scale;
      const offsetX = (stageSize.width - renderedW) / 2;
      const offsetY = (stageSize.height - renderedH) / 2;
      const localX = screenX - pageOffsetRef.current.x;
      const localY = screenY - pageOffsetRef.current.y;
      const mmX = (localX - offsetX) / scale;
      const mmY = (localY - offsetY) / scale;
      if (mmX < -1 || mmY < -1 || mmX > widthMm + 1 || mmY > heightMm + 1) return null;
      return [mmX, mmY];
    },
    [stageSize, widthMm, heightMm]
  );

  const beginDraw = useCallback(
    (screenX: number, screenY: number) => {
      if (!drawMode) return;
      const pt = screenToMm(screenX, screenY);
      if (!pt) return;
      drawingRef.current = true;
      setLivePoints([pt]);
    },
    [drawMode, screenToMm]
  );

  const extendDraw = useCallback(
    (screenX: number, screenY: number) => {
      if (!drawingRef.current) return;
      const pt = screenToMm(screenX, screenY);
      if (!pt) return;
      setLivePoints((prev) => {
        if (!prev) return [pt];
        if (!shouldAppendPoint(prev, pt, longerSideMm * LIVE_DECIMATE_MM_FRACTION)) return prev;
        return [...prev, pt];
      });
    },
    [screenToMm, longerSideMm]
  );

  const endDraw = useCallback(() => {
    if (!drawingRef.current || !drawMode) return;
    drawingRef.current = false;
    setLivePoints((raw) => {
      if (raw && raw.length >= MIN_POINTS_TO_ACCEPT) {
        const simplified = simplifyPolyline(raw, longerSideMm * SIMPLIFY_EPSILON_MM_FRACTION);
        if (simplified.length >= MIN_POINTS_TO_ACCEPT) {
          const ring: VectorRegion['rings'][number] = simplified.map(([x, y]) => [x, y]);
          const areaMm2 = polygonArea(simplified);
          if (drawMode.kind === 'redraw') {
            onRedrawRegion(drawMode.targetId, [ring], areaMm2);
          } else {
            onAddRegion({ colorHex: drawMode.colorHex, rings: [ring], areaMm2 });
          }
        }
      }
      return null;
    });
    setDrawMode(null);
  }, [drawMode, longerSideMm, onRedrawRegion, onAddRegion]);

  const cancelDraw = () => {
    drawingRef.current = false;
    setLivePoints(null);
    setDrawMode(null);
  };

  const startRedraw = () => {
    if (!selected) return;
    setDrawMode({ kind: 'redraw', targetId: selected.id, colorHex: selected.colorHex });
    setSwatchPickerOpen(false);
  };

  const startAdd = () => {
    if (existingColors.length <= 1) {
      setDrawMode({ kind: 'add', colorHex: selected?.colorHex ?? existingColors[0] ?? '#2b2b2b' });
    } else {
      setSwatchPickerOpen(true);
    }
  };

  const pickAddColor = (colorHex: string) => {
    setSwatchPickerOpen(false);
    setDrawMode({ kind: 'add', colorHex });
  };

  const isWeb = Platform.OS === 'web';
  const webOnlyProps: Record<string, unknown> = isWeb
    ? {
        onMouseDown: (e: any) => beginDraw(e.nativeEvent.pageX, e.nativeEvent.pageY),
        onMouseMove: (e: any) => extendDraw(e.nativeEvent.pageX, e.nativeEvent.pageY),
        onMouseUp: endDraw,
        onMouseLeave: endDraw,
        style: drawMode ? { cursor: 'crosshair' } : undefined,
      }
    : {};

  const isDrawing = !!drawMode;

  return (
    <View style={styles.wrap}>
      {isDrawing && (
        <View style={styles.drawBanner}>
          <Text style={[typography.caption, styles.drawBannerText]} numberOfLines={2}>
            {drawMode?.kind === 'redraw' ? 'Draw the new shape to replace it' : 'Draw the new shape to add it'} — lift
            your finger when done.
          </Text>
          <Pressable onPress={cancelDraw} style={styles.cancelBtn} accessibilityLabel="Cancel drawing">
            <X size={14} color={colors.white} />
          </Pressable>
        </View>
      )}

      {swatchPickerOpen && (
        <View style={styles.swatchRow}>
          <Text style={[typography.caption, styles.swatchLabel]}>Color for new shape:</Text>
          {existingColors.map((c) => (
            <Pressable
              key={c}
              onPress={() => pickAddColor(c)}
              style={[styles.swatch, { backgroundColor: c }]}
              accessibilityLabel={`Use color ${c}`}
            />
          ))}
          <Pressable onPress={() => setSwatchPickerOpen(false)} style={styles.swatchCancel}>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>Cancel</Text>
          </Pressable>
        </View>
      )}

      <View
        ref={stageRef}
        style={styles.stage}
        onLayout={onLayout}
        onStartShouldSetResponder={() => isDrawing}
        onMoveShouldSetResponder={() => isDrawing}
        onResponderGrant={(e) => beginDraw(e.nativeEvent.pageX, e.nativeEvent.pageY)}
        onResponderMove={(e) => extendDraw(e.nativeEvent.pageX, e.nativeEvent.pageY)}
        onResponderRelease={endDraw}
        onResponderTerminate={endDraw}
        {...webOnlyProps}
      >
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
                onPress={isDrawing ? undefined : () => setSelectedId(p.id === selectedId ? null : p.id)}
              />
            ))}
            {livePoints && livePoints.length > 1 && (
              <Polyline
                points={livePoints.map(([x, y]) => `${x},${y}`).join(' ')}
                fill="none"
                stroke={colors.indigo}
                strokeWidth={Math.max(widthMm, heightMm) * 0.006}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={`${Math.max(widthMm, heightMm) * 0.012},${Math.max(widthMm, heightMm) * 0.008}`}
              />
            )}
          </Svg>
        )}
      </View>

      <View style={styles.footer}>
        <View style={styles.footerTopRow}>
          <Text style={[typography.bodySmall, styles.countLabel]}>
            {regions.length} region{regions.length === 1 ? '' : 's'} · tap a shape to select it
          </Text>
          <Pressable onPress={startAdd} style={styles.addBtn} disabled={isDrawing}>
            <Plus size={14} color={colors.indigo} />
            <Text style={[typography.caption, styles.addBtnLabel]}>Add Shape</Text>
          </Pressable>
        </View>
        {selected && !isDrawing && (
          <View style={styles.selectedRow}>
            <View style={[styles.swatchSmall, { backgroundColor: selected.colorHex }]} />
            <Text style={[typography.caption, styles.selectedLabel]} numberOfLines={1}>
              {selected.colorHex} · {selected.areaMm2.toFixed(1)} mm²
            </Text>
            <Pressable onPress={startRedraw} style={styles.redrawBtn}>
              <Brush size={14} color={colors.white} />
              <Text style={[typography.caption, { color: colors.white }]}>Redraw</Text>
            </Pressable>
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
  drawBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.indigo,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
  },
  drawBannerText: {
    color: colors.white,
    flex: 1,
  },
  cancelBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  swatchLabel: {
    color: colors.textSecondary,
  },
  swatch: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  swatchCancel: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
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
  footerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  countLabel: {
    color: colors.textTertiary,
    flex: 1,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.indigo,
  },
  addBtnLabel: {
    color: colors.indigo,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.gray100,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  swatchSmall: {
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
  redrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.indigo,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
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
