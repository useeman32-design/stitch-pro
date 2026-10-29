import React, { useCallback, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Polyline } from 'react-native-svg';
import { Brush, Plus, RotateCcw, Trash2, X, ZoomIn, ZoomOut } from 'lucide-react-native';
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

// Zoom: the design's full widthMm x heightMm always fits on-screen at 1x;
// zooming in shrinks the *visible slice* of that viewBox (not the stage's
// own on-screen size, which stays fixed -- see STAGE_HEIGHT), which is
// what actually lets you see/select/draw fine detail on a design with
// hundreds of tiny regions (a real photographed garment, say) that would
// otherwise be a handful of on-screen pixels each at the fit-to-stage
// scale.
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const ZOOM_STEP_FACTOR = 1.6;
// Deliberately shorter than the old fixed 320 -- large enough to still
// usefully see/draw shapes, short enough that the rest of the wizard
// (header, tabs, footer, nav) fits a normal laptop viewport without this
// one card forcing a full-page scroll on its own.
const STAGE_HEIGHT = 260;

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
  // Zoom level: 1 shows the whole widthMm x heightMm design (old/only
  // behavior); >1 shows a smaller centered slice of it at higher effective
  // resolution -- see the MIN_ZOOM/MAX_ZOOM/STAGE_HEIGHT comment above for
  // why this exists (hundreds of tiny regions from a real photographed
  // design are otherwise a few on-screen pixels each and effectively
  // unselectable/undrawable at a fit-to-stage scale).
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([widthMm / 2, heightMm / 2]);
  // Width of the row the stage sits in -- used (with STAGE_HEIGHT and the
  // design's own aspect ratio) to size the stage box so it always exactly
  // matches the design's aspect ratio, never wider/taller than its actual
  // rendered content. Without this, a design that isn't as wide as it is
  // tall (this card's row is always wider than STAGE_HEIGHT) gets
  // letterboxed by the Svg's `preserveAspectRatio="xMidYMid meet"` inside
  // a much-too-wide stage box, leaving large blank side margins that look
  // (and functionally are) part of the stage but do nothing when tapped or
  // dragged on -- which is almost certainly what "can't select/add/edit
  // shapes" actually was: most of the visible box was genuinely dead
  // space, not a broken tap handler.
  const [wrapWidth, setWrapWidth] = useState(0);

  const pageOffsetRef = useRef({ x: 0, y: 0 });
  const drawingRef = useRef(false);
  const panRef = useRef<{ startX: number; startY: number; startCenter: [number, number] } | null>(null);
  const stageRef = useRef<React.ElementRef<typeof View> | null>(null);

  const isWeb = Platform.OS === 'web';

  // On web, `View.measure()`'s pageX/pageY callback is unreliable (it can
  // report stale/zero values, especially right after a layout change --
  // e.g. switching into this tab), which silently broke every freehand
  // draw (Add Shape / Redraw): beginDraw/extendDraw would compute
  // coordinates relative to the wrong origin, screenToMm's bounds check
  // would then reject *every* point as outside the design, and drawing
  // would appear to do nothing at all with no visible error. `getBoundingClientRect()`
  // on the underlying DOM node (re-read on every gesture start, not cached
  // from onLayout) is the reliable way to get this on web -- so this
  // refreshes `pageOffsetRef` from that right before a drag starts, and
  // pairs it with `clientX`/`clientY` (not `pageX`/`pageY`) below, since
  // `getBoundingClientRect()` is viewport-relative, not page-relative.
  const refreshWebStageOffset = () => {
    if (!isWeb) return;
    const node = stageRef.current as unknown as { getBoundingClientRect?: () => { left: number; top: number } } | null;
    const rect = node?.getBoundingClientRect?.();
    if (rect) pageOffsetRef.current = { x: rect.left, y: rect.top };
  };

  const onLayout = (e: LayoutChangeEvent) => {
    setStageSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });
    if (isWeb) {
      refreshWebStageOffset();
      return;
    }
    const node = stageRef.current as unknown as {
      measure?: (cb: (x: number, y: number, w: number, h: number, pageX: number, pageY: number) => void) => void;
    } | null;
    node?.measure?.((_x, _y, _w, _h, pageX, pageY) => {
      pageOffsetRef.current = { x: pageX, y: pageY };
    });
  };

  // The visible slice of the design at the current zoom, centered on
  // `center` and clamped so it never shows past the design's own edges.
  const viewWmm = widthMm / zoom;
  const viewHmm = heightMm / zoom;
  const clampCenter = useCallback(
    (cx: number, cy: number, vw: number, vh: number): [number, number] => {
      const minCx = vw / 2;
      const maxCx = Math.max(minCx, widthMm - vw / 2);
      const minCy = vh / 2;
      const maxCy = Math.max(minCy, heightMm - vh / 2);
      return [Math.min(maxCx, Math.max(minCx, cx)), Math.min(maxCy, Math.max(minCy, cy))];
    },
    [widthMm, heightMm]
  );
  const [clampedCx, clampedCy] = clampCenter(center[0], center[1], viewWmm, viewHmm);
  const viewBoxMinX = clampedCx - viewWmm / 2;
  const viewBoxMinY = clampedCy - viewHmm / 2;
  const viewBox = `${viewBoxMinX} ${viewBoxMinY} ${viewWmm} ${viewHmm}`;

  // The stage box itself is sized to the *full* design's aspect ratio
  // (independent of zoom, which only changes the viewBox slice shown
  // inside this same box), fit within the available row width and capped
  // at STAGE_HEIGHT -- so the Svg's `preserveAspectRatio="xMidYMid meet"`
  // never has to letterbox it, i.e. there's never dead/blank margin inside
  // the visible card that looks tappable/draggable but silently isn't.
  const designAspect = widthMm > 0 && heightMm > 0 ? widthMm / heightMm : 1;
  let stageBoxWidth = wrapWidth || STAGE_HEIGHT * designAspect;
  let stageBoxHeight = stageBoxWidth / designAspect;
  if (stageBoxHeight > STAGE_HEIGHT) {
    stageBoxHeight = STAGE_HEIGHT;
    stageBoxWidth = STAGE_HEIGHT * designAspect;
  }
  const stageBoxSize = { width: stageBoxWidth, height: stageBoxHeight };

  const setZoomClamped = (nextZoom: number) => {
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
    if (z <= MIN_ZOOM) {
      setCenter([widthMm / 2, heightMm / 2]);
    }
    setZoom(z);
  };
  const zoomIn = () => setZoomClamped(zoom * ZOOM_STEP_FACTOR);
  const zoomOut = () => setZoomClamped(zoom / ZOOM_STEP_FACTOR);
  const resetZoom = () => {
    setZoom(MIN_ZOOM);
    setCenter([widthMm / 2, heightMm / 2]);
  };

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

  // Maps a page-space screen point to mm/viewBox space, accounting for both
  // the current zoom/pan slice and the Svg's `preserveAspectRatio="xMidYMid
  // meet"` letterboxing (the stage's own aspect ratio rarely matches the
  // visible slice's aspect ratio exactly).
  const screenToMm = useCallback(
    (screenX: number, screenY: number): Point | null => {
      if (stageSize.width <= 0 || stageSize.height <= 0) return null;
      const scale = Math.min(stageSize.width / viewWmm, stageSize.height / viewHmm);
      const renderedW = viewWmm * scale;
      const renderedH = viewHmm * scale;
      const offsetX = (stageSize.width - renderedW) / 2;
      const offsetY = (stageSize.height - renderedH) / 2;
      const localX = screenX - pageOffsetRef.current.x;
      const localY = screenY - pageOffsetRef.current.y;
      const mmX = viewBoxMinX + (localX - offsetX) / scale;
      const mmY = viewBoxMinY + (localY - offsetY) / scale;
      if (mmX < viewBoxMinX - 1 || mmY < viewBoxMinY - 1 || mmX > viewBoxMinX + viewWmm + 1 || mmY > viewBoxMinY + viewHmm + 1)
        return null;
      return [mmX, mmY];
    },
    [stageSize, viewWmm, viewHmm, viewBoxMinX, viewBoxMinY]
  );

  // Dragging on the stage pans the visible slice instead of drawing, iff
  // we're not in a draw tool and there's actually somewhere to pan to
  // (zoom > 1) -- at zoom 1 the whole design is already visible, so a drag
  // there does nothing (same as before zoom existed).
  const beginPan = useCallback(
    (screenX: number, screenY: number) => {
      if (drawMode || zoom <= MIN_ZOOM) return;
      panRef.current = { startX: screenX, startY: screenY, startCenter: [clampedCx, clampedCy] };
    },
    [drawMode, zoom, clampedCx, clampedCy]
  );
  const movePan = useCallback(
    (screenX: number, screenY: number) => {
      if (!panRef.current || stageSize.width <= 0 || stageSize.height <= 0) return;
      const scale = Math.min(stageSize.width / viewWmm, stageSize.height / viewHmm);
      const dxMm = (screenX - panRef.current.startX) / scale;
      const dyMm = (screenY - panRef.current.startY) / scale;
      setCenter([panRef.current.startCenter[0] - dxMm, panRef.current.startCenter[1] - dyMm]);
    },
    [stageSize, viewWmm, viewHmm]
  );
  const endPan = useCallback(() => {
    panRef.current = null;
  }, []);

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

  // Calls `onRedrawRegion`/`onAddRegion` (which bubble up to a parent's
  // setState, e.g. the wizard's region list) directly in this handler --
  // NOT from inside the `setLivePoints` updater function above, the way an
  // earlier version of this (and BackgroundMaskBrush's analogous
  // `endStroke`) did. A state-updater callback passed to `setState` can be
  // invoked during React's render phase (React may replay it to check
  // purity), so calling a parent-state-mutating prop from inside one is a
  // real bug, not just a style nit -- it produced an actual console error,
  // "Cannot update a component while rendering a different component".
  // Reading `livePoints` directly here (this function only ever runs from
  // a genuine mouseup/responder-release event) is the correct fix.
  const endDraw = useCallback(() => {
    if (!drawingRef.current || !drawMode) return;
    drawingRef.current = false;
    const raw = livePoints;
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
    setLivePoints(null);
    setDrawMode(null);
  }, [drawMode, longerSideMm, onRedrawRegion, onAddRegion, livePoints]);

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

  const isDrawing = !!drawMode;
  const canPan = !isDrawing && zoom > MIN_ZOOM;

  // Draw and pan share the same press/move/release stream but are
  // mutually exclusive per-gesture: draw wins whenever a draw tool is
  // active, otherwise a drag pans (only possible once zoomed in).
  const handleGestureStart = useCallback(
    (x: number, y: number) => {
      if (isDrawing) beginDraw(x, y);
      else beginPan(x, y);
    },
    [isDrawing, beginDraw, beginPan]
  );
  const handleGestureMove = useCallback(
    (x: number, y: number) => {
      if (drawingRef.current) extendDraw(x, y);
      else if (panRef.current) movePan(x, y);
    },
    [extendDraw, movePan]
  );
  const handleGestureEnd = useCallback(() => {
    if (drawingRef.current) endDraw();
    else endPan();
  }, [endDraw, endPan]);

  // IMPORTANT: this is spread onto the stage View *after* `style={...}` in
  // the JSX below -- deliberately does NOT include a `style` key (even
  // `style: undefined`), because an object-spread's `undefined` value for
  // a key that's *present* still overwrites an earlier explicit prop of
  // the same name. That exact mistake here previously wiped out the
  // stage's entire style (fixed size, border, background, overflow
  // clipping) on every render where the draw tool was off, which is most
  // of the time -- the stage silently grew to whatever size its SVG child
  // happened to report instead of the intended fixed box. Cursor styling
  // is applied separately via a style *array* on the View itself, which
  // merges correctly instead of overwriting.
  //
  // Mouse coordinates here deliberately use `clientX`/`clientY` (viewport-
  // relative), paired with `refreshWebStageOffset`'s `getBoundingClientRect()`
  // (also viewport-relative) -- see that function's comment for why
  // `pageX`/`pageY` + `measure()` (the old approach, still used for native)
  // silently broke every freehand draw on web.
  const webOnlyProps: Record<string, unknown> = isWeb
    ? {
        onMouseDown: (e: any) => {
          refreshWebStageOffset();
          handleGestureStart(e.nativeEvent.clientX, e.nativeEvent.clientY);
        },
        onMouseMove: (e: any) => handleGestureMove(e.nativeEvent.clientX, e.nativeEvent.clientY),
        onMouseUp: handleGestureEnd,
        onMouseLeave: handleGestureEnd,
      }
    : {};
  const webCursorStyle = isWeb ? (isDrawing ? styles.cursorCrosshair : canPan ? styles.cursorGrab : undefined) : undefined;

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

      <View style={styles.zoomRow}>
        <Pressable
          onPress={zoomOut}
          disabled={zoom <= MIN_ZOOM}
          style={[styles.zoomBtn, zoom <= MIN_ZOOM && styles.zoomBtnDisabled]}
          accessibilityLabel="Zoom out"
        >
          <ZoomOut size={16} color={zoom <= MIN_ZOOM ? colors.textTertiary : colors.textSecondary} />
        </Pressable>
        <Text style={[typography.caption, styles.zoomLabel]}>{Math.round(zoom * 100)}%</Text>
        <Pressable
          onPress={zoomIn}
          disabled={zoom >= MAX_ZOOM}
          style={[styles.zoomBtn, zoom >= MAX_ZOOM && styles.zoomBtnDisabled]}
          accessibilityLabel="Zoom in"
        >
          <ZoomIn size={16} color={zoom >= MAX_ZOOM ? colors.textTertiary : colors.textSecondary} />
        </Pressable>
        {zoom > MIN_ZOOM && (
          <Pressable onPress={resetZoom} style={styles.zoomResetBtn} accessibilityLabel="Reset zoom">
            <RotateCcw size={13} color={colors.textSecondary} />
            <Text style={[typography.caption, styles.zoomResetLabel]}>Reset</Text>
          </Pressable>
        )}
        {canPan && (
          <Text style={[typography.caption, styles.zoomHint]} numberOfLines={1}>
            Drag to pan
          </Text>
        )}
      </View>

      <View
        style={styles.stageWrap}
        onLayout={(e) => setWrapWidth(e.nativeEvent.layout.width)}
      >
      <View
        ref={stageRef}
        style={[styles.stage, stageBoxSize, webCursorStyle]}
        onLayout={onLayout}
        {...(isWeb
          ? {}
          : {
              onStartShouldSetResponder: () => isDrawing || canPan,
              onMoveShouldSetResponder: () => isDrawing || canPan,
              onResponderGrant: (e: any) => handleGestureStart(e.nativeEvent.pageX, e.nativeEvent.pageY),
              onResponderMove: (e: any) => handleGestureMove(e.nativeEvent.pageX, e.nativeEvent.pageY),
              onResponderRelease: handleGestureEnd,
              onResponderTerminate: handleGestureEnd,
            })}
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
  // Centers the stage box (which is now sized to the design's own aspect
  // ratio, not stretched to the full row width -- see `stageBoxSize`
  // above) within the available row width.
  stageWrap: {
    width: '100%',
    alignItems: 'center',
  },
  stage: {
    height: STAGE_HEIGHT,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  // `cursor` isn't part of React Native's ViewStyle type (it's web-only),
  // hence the `as any` -- applied via a style *array* alongside
  // `styles.stage` above, never by overwriting it (see the long comment by
  // `webOnlyProps` for why that distinction matters).
  cursorCrosshair: { cursor: 'crosshair' } as any,
  cursorGrab: { cursor: 'grab' } as any,
  zoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  zoomBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomBtnDisabled: {
    opacity: 0.5,
  },
  zoomLabel: {
    color: colors.textSecondary,
    minWidth: 38,
    textAlign: 'center',
  },
  zoomResetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  zoomResetLabel: {
    color: colors.textSecondary,
  },
  zoomHint: {
    color: colors.textTertiary,
    marginLeft: spacing.xs,
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
