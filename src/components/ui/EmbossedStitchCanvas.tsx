import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Rect, Stop } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { Maximize2, Minus, Plus } from 'lucide-react-native';
import { colors as themeColors, radius } from '@/theme';
import type { MmSegment } from '@/utils/stitchPreview';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface SelectedStitchInfo {
  /** 1-based ordinal among every playback unit (stitches + jumps) up to
   * and including this one -- "stitch #412 of 1,897", matching how a real
   * machine operator would refer to a position in the stitch-out. */
  index: number;
  total: number;
  kind: 'stitch' | 'jump' | 'stop';
  lengthMm: number;
  /** Design-space mm position (already un-centered, matching widthMm/
   * heightMm), of the unit's end point -- where the needle is after it. */
  xMm: number;
  yMm: number;
  colorIndex: number;
  colorHex: string | null;
}

interface EmbossedStitchCanvasProps {
  segments: MmSegment[];
  palette: string[];
  widthMm: number;
  heightMm: number;
  progress: number; // 0..1
  onNeedlePosition?: (pos: { xPct: number; yPct: number } | null) => void;
  /** Tap-to-inspect: fires with details of whichever currently-visible
   * stitch or jump was closest to the tap, or null when the tap didn't
   * land near anything (or the design has nothing visible yet). */
  onSelectStitch?: (info: SelectedStitchInfo | null) => void;
  /** Multiplies the rendered thread width (and its shadow/sheen offsets)
   * around the physically-accurate default of ~0.22mm. 1 = default real
   * thread thickness; <1 thinner, >1 thicker -- lets a user visually
   * "zoom in" on how dense/heavy a design will stitch out without
   * changing the actual geometry. */
  threadThicknessScale?: number;
  /** Plays a small up/down bob on the live needle-tip marker while true --
   * intended for "currently stitching" playback (the simulator screen);
   * left off (static tip, no marker at all once stitched to completion)
   * everywhere else. */
  needleBobbing?: boolean;
  /** Hides the built-in pan/zoom control pill (the design is still
   * draggable/zoomable either way) -- for callers with limited vertical
   * space who want to render their own zoom affordance instead. */
  hideZoomControls?: boolean;
}

// 1 "preview unit" = 0.1mm of real design size -- gives plenty of
// resolution for round line caps/gradients without the viewBox numbers
// getting unwieldy for a typical 20-150mm design.
const PX_PER_MM = 10;

// Real embroidery is made of many short individual stitches, not one long
// continuous line -- a long straight stroke reads as "a drawn line" no
// matter how it's shaded, which was exactly the "not just lines" feedback
// this rewrite addresses. Every renderable run gets chopped into dashes
// around this long before it's drawn, each with its own small gap, so
// consecutive stitches read as individually raised and slightly separated
// -- the actual visual signature of real thread, not a filter applied to
// one shape.
const STITCH_LEN_MM = 2.6;
const STITCH_GAP_MM = 0.5;

// Above this many *visible* dashes, drop the 3-layer emboss treatment down
// to a single gradient stroke per dash (still colored/shaded and still
// visibly separated into individual stitches, just no separate shadow/
// highlight passes) to keep native SVG element counts reasonable during a
// live progress animation.
const EMBOSS_LAYER_CAP = 1200;
// Above this many visible dashes, thin out which ones get drawn at all
// while progress is still animating (full fidelity returns once
// progress >= 1) -- a dense fill design can easily have several thousand
// stitches, and redrawing all of them ~10x/second is unnecessary for what
// is, after all, just a preview.
const DECIMATE_ABOVE = 5000;
// Above this many *pre-dash* raw segments, subdividing every one of them
// into individual stitches would produce an SVG tree far too large to
// stay smooth (tens of thousands of elements) -- fall back to one long
// shaded stroke per raw segment instead, same as this component's
// original approach, rather than let the page hang.
const MAX_SEGMENTS_FOR_DASHING = 2500;

// Pan/zoom bounds -- 1x always shows the whole design (the original,
// un-zoomable behavior); 6x is roughly "inspect individual stitches on a
// small monogram" territory, matched to the kind of zoom level real
// digitizing tools (and embroidai's own viewer) settle on.
const MIN_ZOOM = 1;
const MAX_ZOOM = 6;
const ZOOM_BUTTON_STEP = 1.6;
const TAP_MOVE_THRESHOLD_PX = 8;
const DOUBLE_TAP_MS = 320;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, v));
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const num = parseInt(full, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => clamp255(Math.round(n)).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Mixes `hex` toward white (`amt` 0..1) -- simulates the lit, rounded
 * top of a strand of thread catching the light. */
function lighten(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
}

/** Mixes `hex` toward black (`amt` 0..1) -- simulates the shaded underside
 * of a strand of thread, away from the light. */
function darken(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 - amt), g * (1 - amt), b * (1 - amt));
}

interface Dash extends MmSegment {
  /** Unit vector perpendicular to this dash's own direction -- used to
   * offset its shadow/sheen strokes *across* the thread's width rather
   * than along a single fixed page-diagonal, so the highlight sits on
   * whichever edge of the rounded thread actually faces the light for
   * that stitch's own orientation. This is what a satin/fill row's
   * characteristic ribbed sheen pattern actually follows in real
   * embroidery -- the ridges run with the stitch direction, not with the
   * page. */
  nx: number;
  ny: number;
  kind: 'stitch' | 'jump' | 'stop';
  /** Real mm-space length of this exact playback unit (a whole jump, or
   * one subdivided stitch dash) -- precomputed once here rather than
   * recomputed from scaled view-space coordinates at inspect time. Always
   * 0 for a 'stop' marker (no movement). */
  lengthMm: number;
}

/**
 * Chops every *stitch* segment into short, individually-separated dashes
 * (see `STITCH_LEN_MM`/`STITCH_GAP_MM` above) -- the single biggest visual
 * difference between "a rendered line" and "a row of real stitches". Jump
 * segments (the needle travelling with the thread trimmed/lifted, laying
 * down nothing) are kept as a single whole unit instead -- subdividing a
 * jump into fake "stitch" pieces would misrepresent exactly the kind of
 * machine behavior a "click to inspect jumps" feature needs to report
 * accurately.
 */
function subdivideIntoDashes(segments: MmSegment[]): Dash[] {
  const out: Dash[] = [];
  for (const seg of segments) {
    if (seg.kind === 'stop') {
      // A real machine pause -- a zero-movement point marker, not a line,
      // so it must be handled before the (otherwise correct) `len < 1e-6`
      // degenerate-segment skip below, or it would silently vanish.
      out.push({ ...seg, kind: 'stop', nx: 0, ny: -1, lengthMm: 0 });
      continue;
    }

    const dx = seg.x2 - seg.x1;
    const dy = seg.y2 - seg.y1;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) continue;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;

    if (seg.kind === 'jump') {
      out.push({ ...seg, kind: 'jump', nx, ny, lengthMm: len });
      continue;
    }

    const steps = Math.max(1, Math.round(len / STITCH_LEN_MM));
    const pieceLen = len / steps;
    const trim = Math.min(STITCH_GAP_MM / 2, pieceLen * 0.35);
    for (let i = 0; i < steps; i++) {
      const startT = i * pieceLen + trim;
      const endT = (i + 1) * pieceLen - trim;
      if (endT <= startT) continue;
      out.push({
        x1: seg.x1 + ux * startT,
        y1: seg.y1 + uy * startT,
        x2: seg.x1 + ux * endT,
        y2: seg.y1 + uy * endT,
        colorIndex: seg.colorIndex,
        kind: 'stitch',
        nx,
        ny,
        lengthMm: endT - startT,
      });
    }
  }
  return out;
}

/** Squared distance from point `p` to the closest point on segment `a`-`b`
 * -- used by tap-to-inspect to find the nearest dash to wherever the user
 * tapped, same standard point-to-segment-distance approach the backend's
 * own color-blend-line detection uses (digitizer/segmentation/
 * color_quantize.py's `_point_segment_dist2`), just in 2-D screen space
 * here instead of 3-D color space. */
function pointSegmentDist2(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 < 1e-9 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return (px - cx) ** 2 + (py - cy) ** 2;
}

interface PanState {
  x: number;
  y: number;
}

type DragState = {
  isPinch: boolean;
  moved: boolean;
  // Single-finger / mouse drag tracking (screen px, last-seen position).
  lastX: number;
  lastY: number;
  startX: number;
  startY: number;
  // Two-finger pinch tracking.
  pinchStartDist: number;
  pinchStartZoom: number;
};

/**
 * Realistic *2D* raised/embossed thread rendering -- not a true 3D scene
 * (no WebGL, no camera, nothing that needs a GPU shader pipeline mobile
 * Expo apps can't reliably ship), just a flat render built from many short,
 * individually-raised stitch dashes (not one long line per fill row) so it
 * actually reads as real stitched thread up close, not a drawn outline:
 *
 *   1. Every design segment is first chopped into short dashes with a
 *      small gap between each (`subdivideIntoDashes`) -- real embroidery
 *      is visibly made of individual stitches, and a long unbroken stroke
 *      reads as "a line" no matter how it's shaded.
 *   2. Each dash gets a soft, dark shadow stroke offset *across its own
 *      width* (perpendicular to that dash's direction, not a fixed page
 *      diagonal) -- what reads as "this sits above the fabric surface,
 *      catching light on one rounded edge and casting a shadow on the
 *      other", consistently with the stitch's own orientation the way a
 *      satin row's ridges actually follow the stitch direction.
 *   3. The real thread-colored dash itself, filled with a linear gradient
 *      from a lightened tint through the base color to a darkened shade --
 *      simulating a single light source catching the rounded cross-section
 *      of a strand of thread.
 *   4. A thin, semi-transparent white "sheen" stroke offset the opposite
 *      way across the dash's width -- the glossy highlight real thread
 *      shows along its lit edge.
 *
 * Jumps (needle travel with no thread laid down) render as a thin, flat,
 * dashed gray line instead -- visually distinct from real thread on sight,
 * matching the convention every professional digitizing tool uses, and
 * (see `onSelectStitch`) tappable just like a real stitch so a jump run
 * that looks suspiciously long can actually be inspected, not just seen.
 *
 * On top of that render, this component is its own interactive stage:
 * mouse-wheel / pinch-to-zoom (anchored under the cursor/pinch midpoint),
 * click-and-drag / single-finger pan, and a small zoom control pill
 * (+ / reset / -, plus the current zoom %) -- all implemented as a
 * variable SVG `viewBox` window rather than a CSS transform, so stroke
 * widths and hit-testing both stay exactly correct at any zoom level with
 * no extra coordinate math anywhere else in the app.
 *
 * Built with react-native-svg so the exact same component (and the exact
 * same visual result) renders on web *and* native, rather than relying on
 * an HTML <canvas>, which has no native equivalent in Expo.
 */
export function EmbossedStitchCanvas({
  segments,
  palette,
  widthMm,
  heightMm,
  progress,
  onNeedlePosition,
  onSelectStitch,
  threadThicknessScale = 1,
  needleBobbing = false,
  hideZoomControls = false,
}: EmbossedStitchCanvasProps) {
  const viewW = Math.max(1, widthMm * PX_PER_MM);
  const viewH = Math.max(1, heightMm * PX_PER_MM);

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [selectedKey, setSelectedKey] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<PanState>({ x: 0, y: 0 });
  // Tracks which design (by its real-world size) the current zoom/pan
  // belongs to -- compared during render, not in an effect, using React's
  // own sanctioned "adjust state when a prop changes" pattern: reset
  // zoom/pan synchronously in the same render a genuinely different
  // design's dimensions show up, without an extra effect-triggered
  // re-render. Deliberately keyed on widthMm/heightMm only (not
  // `segments`), so re-digitizing the same design at a different density
  // leaves whatever region the user zoomed into exactly where they left
  // it.
  const [viewDesignKey, setViewDesignKey] = useState({ widthMm, heightMm });
  if (viewDesignKey.widthMm !== widthMm || viewDesignKey.heightMm !== heightMm) {
    setViewDesignKey({ widthMm, heightMm });
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  // Used for hit-testing taps/drags: `measure()` reliably returns this
  // node's on-screen page offset on BOTH native (iOS/Android) and web,
  // unlike `nativeEvent.locationX/locationY` -- react-native-web leaves
  // `nativeEvent` as the raw browser MouseEvent, which has no
  // locationX/locationY at all, so relying on those silently broke every
  // tap on web (desktop + the web preview this app actually ships to
  // first). pageX/pageY + measure() works identically everywhere.
  const stageRef = useRef<React.ElementRef<typeof View> | null>(null);
  const containerPageOffsetRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef<DragState | null>(null);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);

  const refreshContainerOffset = useCallback(() => {
    const node = stageRef.current as unknown as {
      measure?: (cb: (x: number, y: number, w: number, h: number, pageX: number, pageY: number) => void) => void;
    } | null;
    node?.measure?.((_x, _y, _w, _h, pageX, pageY) => {
      containerPageOffsetRef.current = { x: pageX, y: pageY };
    });
  }, []);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      setContainerSize({ width, height });
      refreshContainerOffset();
    },
    [refreshContainerOffset]
  );

  // Dash every segment into individual stitches, and scale into view-space,
  // exactly ONCE per design (keyed only on `segments`/dimensions, never on
  // `progress`) -- see MAX_SEGMENTS_FOR_DASHING for the one case this is
  // skipped. This used to be the actual root cause of simulator slowness:
  // the animation driver advances `progress` roughly every 100ms, and this
  // same chopping-into-dashes + mm-to-view-space scaling work was being
  // redone from scratch, over the entire *growing* prefix of visible
  // segments, on every single one of those ticks -- so by the time
  // playback neared 100% each tick was re-dashing and re-scaling nearly
  // the whole design's worth of geometry ten times a second. Precomputing
  // the full dash list once and slicing it per frame below turns that
  // per-tick cost into an (almost free) array slice instead.
  const allDashes = useMemo(
    () =>
      segments.length <= MAX_SEGMENTS_FOR_DASHING
        ? subdivideIntoDashes(segments)
        : segments.map((s) => ({
            ...s,
            nx: 0,
            ny: 0,
            kind: (s.kind ?? 'stitch') as 'stitch' | 'jump' | 'stop',
            lengthMm: Math.hypot(s.x2 - s.x1, s.y2 - s.y1),
          })),
    [segments]
  );

  const scaledAllDashes = useMemo(
    () =>
      allDashes.map((s) => ({
        ...s,
        x1: s.x1 * PX_PER_MM,
        y1: s.y1 * PX_PER_MM,
        x2: s.x2 * PX_PER_MM,
        y2: s.y2 * PX_PER_MM,
      })),
    [allDashes]
  );

  // The only per-frame computation now: how far into the precomputed dash
  // list `progress` currently reaches, plus (for a smoothly-moving needle
  // tip) a linear interpolation partway through the current in-progress
  // dash -- both O(1), not a re-walk of the whole design.
  const total = scaledAllDashes.length;
  const exact = total === 0 ? 0 : Math.max(0, Math.min(total, progress * total));
  const fullCount = Math.floor(exact);
  const frac = exact - fullCount;

  const partialDash = useMemo(() => {
    if (fullCount >= total || frac <= 0) return null;
    const d = scaledAllDashes[fullCount];
    return { ...d, x2: d.x1 + (d.x2 - d.x1) * frac, y2: d.y1 + (d.y2 - d.y1) * frac };
  }, [scaledAllDashes, fullCount, frac, total]);

  // View-space (0.1mm units) needle tip, for the in-SVG marker -- kept
  // separate from the mm-space `tip` reported via `onNeedlePosition` below
  // so the marker itself stays correctly placed under any zoom/pan without
  // any external caller needing to know this component's view transform.
  const tipView = useMemo(() => {
    if (partialDash) return { x: partialDash.x2, y: partialDash.y2 };
    if (fullCount > 0) {
      const last = scaledAllDashes[fullCount - 1];
      return { x: last.x2, y: last.y2 };
    }
    return null;
  }, [partialDash, scaledAllDashes, fullCount]);

  React.useEffect(() => {
    if (tipView) {
      onNeedlePosition?.({
        xPct: (tipView.x / PX_PER_MM / Math.max(1, widthMm)) * 100,
        yPct: (tipView.y / PX_PER_MM / Math.max(1, heightMm)) * 100,
      });
    } else {
      onNeedlePosition?.(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipView, widthMm, heightMm]);

  // Small up/down bob for the live needle marker while actively playing --
  // mirrors the pulse the simulator screen used to animate externally,
  // just internalized here so it stays correctly positioned at any zoom.
  const needleBob = useSharedValue(0);
  useEffect(() => {
    if (needleBobbing) {
      needleBob.value = withRepeat(withTiming(1, { duration: 220, easing: Easing.linear }), -1, true);
    } else {
      needleBob.value = withTiming(0, { duration: 150 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needleBobbing]);

  const needleAnimatedProps = useAnimatedProps(() => ({
    cy: (tipView?.y ?? 0) - needleBob.value * PX_PER_MM * 0.6,
  }));

  let drawDashes: Dash[] = useMemo(
    () => (partialDash ? [...scaledAllDashes.slice(0, fullCount), partialDash] : scaledAllDashes.slice(0, fullCount)),
    [scaledAllDashes, fullCount, partialDash]
  );

  // Thin out mid-animation redraws of very dense designs; always show
  // every dash once the stitch-out is actually complete. The decimation
  // step is deliberately derived from `total` (the design's fixed, final
  // dash count), never from `drawDashes.length` (how many are visible
  // *so far*, which keeps growing as playback progresses) -- that was a
  // real, observed bug: as the visible count crossed each multiple of
  // DECIMATE_ABOVE, `step` would jump (e.g. 1 -> 2 at 5000), and since
  // "keep every Nth dash" selects a completely different subset of
  // indices for a different N, a large fraction of dashes that were
  // already drawn and visible the previous frame would suddenly fail the
  // new `i % step === 0` test and vanish in a single frame -- reproduced
  // directly: crossing 5000 dashes this way instantly hid 2500 of the
  // 5000 previously-visible stitches. Keying `step` to the stable final
  // total instead means the exact same subset of indices is kept for the
  // entire animation, so decimation only ever adds detail as playback
  // advances, never removes something the user already saw stitched in.
  let decimateStep = 1;
  if (progress < 1 && total > DECIMATE_ABOVE) {
    decimateStep = Math.ceil(total / DECIMATE_ABOVE);
    if (decimateStep > 1) {
      drawDashes = drawDashes.filter((_, i) => i % decimateStep === 0);
    }
  }

  const scaledDashes = drawDashes;
  const stitchDashes = useMemo(
    () => scaledDashes.filter((d) => d.kind !== 'jump' && d.kind !== 'stop'),
    [scaledDashes]
  );
  const jumpDashes = useMemo(() => scaledDashes.filter((d) => d.kind === 'jump'), [scaledDashes]);
  // Real machine pauses (PUFF_3D/APPLIQUE regions) -- see
  // stitchpro-backend's formats/dst/writer.py STOP handling. Rendered as
  // a distinct marker (not a line, since these are zero-length) so a user
  // can see exactly where their machine will stop for fabric/foam
  // placement before they even export.
  const stopDashes = useMemo(() => scaledDashes.filter((d) => d.kind === 'stop'), [scaledDashes]);

  const fullEmboss = stitchDashes.length <= EMBOSS_LAYER_CAP;

  // Thread width is tied to a physically-accurate real-world diameter
  // (~0.22mm, a typical embroidery thread) rather than scaling with
  // design size -- PX_PER_MM is a fixed mm<->view-space ratio, so this is
  // already "to scale" for any design. `threadThicknessScale` is the only
  // thing that moves it now, letting a user see a heavier/lighter thread
  // without that being confused for a change in the actual digitized
  // geometry.
  const thicknessScale = clamp(threadThicknessScale, 0.4, 2.5);
  const strokeW = Math.max(1.6, Math.min(3.2, PX_PER_MM * 0.22)) * thicknessScale;
  const shadowOffset = strokeW * 0.42;
  const highlightOffset = strokeW * 0.24;

  // --- Pan/zoom geometry -----------------------------------------------
  // Zooming is implemented as a variable SVG viewBox window rather than a
  // CSS/Animated transform: the <Svg> element's own on-screen rendered
  // size (and therefore its "xMidYMid meet" letterboxing offsets) never
  // changes as the viewBox shrinks, so `baseScale` below -- the familiar
  // "fit the whole design in the container" scale -- stays valid as a
  // building block at every zoom level; the actual screen-to-content
  // scale at a given zoom is just `zoom * baseScale`.
  const baseScale = containerSize.width > 0 && containerSize.height > 0
    ? Math.min(containerSize.width / viewW, containerSize.height / viewH)
    : 0;
  const renderedW = viewW * baseScale;
  const renderedH = viewH * baseScale;
  const letterboxX = (containerSize.width - renderedW) / 2;
  const letterboxY = (containerSize.height - renderedH) / 2;

  const visibleW = viewW / zoom;
  const visibleH = viewH / zoom;
  const effectiveViewBox = `${pan.x} ${pan.y} ${visibleW} ${visibleH}`;

  const clampPan = useCallback(
    (p: PanState, z: number): PanState => {
      const vw = viewW / z;
      const vh = viewH / z;
      const maxX = Math.max(0, viewW - vw);
      const maxY = Math.max(0, viewH - vh);
      return { x: clamp(p.x, 0, maxX), y: clamp(p.y, 0, maxY) };
    },
    [viewW, viewH]
  );

  /** Maps a point in local (container-relative) screen pixels to SVG
   * user-space (view-space) coordinates, at an arbitrary zoom/pan --
   * shared by tap-resolution, wheel-zoom anchoring, and pinch anchoring. */
  const localToSvg = useCallback(
    (localX: number, localY: number, z: number, p: PanState) => {
      if (baseScale <= 0) return { x: 0, y: 0 };
      const scale = z * baseScale;
      return { x: p.x + (localX - letterboxX) / scale, y: p.y + (localY - letterboxY) / scale };
    },
    [baseScale, letterboxX, letterboxY]
  );

  /** Zooms to `newZoomRaw`, keeping whatever content point was under
   * (localX, localY) *before* the change in exactly the same screen spot
   * afterwards -- the standard "zoom to cursor / pinch midpoint" feel. */
  const zoomAt = useCallback(
    (localX: number, localY: number, newZoomRaw: number) => {
      if (baseScale <= 0) return;
      const newZoom = clamp(newZoomRaw, MIN_ZOOM, MAX_ZOOM);
      setZoom((prevZoom) => {
        if (Math.abs(newZoom - prevZoom) < 1e-4) return prevZoom;
        setPan((prevPan) => {
          const anchor = localToSvg(localX, localY, prevZoom, prevPan);
          const scaleNew = newZoom * baseScale;
          const panXNew = anchor.x - (localX - letterboxX) / scaleNew;
          const panYNew = anchor.y - (localY - letterboxY) / scaleNew;
          return clampPan({ x: panXNew, y: panYNew }, newZoom);
        });
        return newZoom;
      });
    },
    [baseScale, letterboxX, letterboxY, localToSvg, clampPan]
  );

  const zoomCenter = useCallback(
    (factor: number) => {
      zoomAt(containerSize.width / 2, containerSize.height / 2, zoom * factor);
    },
    [zoomAt, containerSize, zoom]
  );

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Tap-to-inspect: maps a tap's on-screen pixel position back into the
  // SVG's own viewBox coordinate space (now zoom/pan-aware via
  // `localToSvg`), then finds whichever currently-visible dash (stitch or
  // jump) is closest, by real on-screen distance, and reports it back via
  // `onSelectStitch` -- the actual "click to inspect lines/jumps/points"
  // feature: without it, the simulator could only be watched, never
  // interrogated.
  const resolveTapAtLocalPoint = useCallback(
    (localX: number, localY: number) => {
      if (!onSelectStitch || containerSize.width <= 0 || containerSize.height <= 0 || scaledDashes.length === 0) {
        onSelectStitch?.(null);
        return;
      }
      const { x: svgX, y: svgY } = localToSvg(localX, localY, zoom, pan);

      let bestIdx = -1;
      let bestDist = Infinity;
      for (let i = 0; i < scaledDashes.length; i++) {
        const d = scaledDashes[i];
        const dist = pointSegmentDist2(svgX, svgY, d.x1, d.y1, d.x2, d.y2);
        if (dist < bestDist) {
          bestDist = dist;
          bestIdx = i;
        }
      }
      // A generous-but-bounded hit radius in *screen* pixels, converted to
      // view-space at the current zoom -- the same forgiving-fingertip
      // radius whether the user is zoomed out or zoomed in close.
      const hitRadiusViewSpace = (PX_PER_MM * 12) / zoom;
      if (bestIdx < 0 || bestDist > hitRadiusViewSpace * hitRadiusViewSpace) {
        setSelectedKey(null);
        onSelectStitch(null);
        return;
      }

      const picked = scaledDashes[bestIdx];
      // Recover this dash's real ordinal position in the *un-decimated*
      // full timeline (not just its index within the thinned-out
      // `scaledDashes` draw list) so "stitch #N of total" means the same
      // N a real machine readout would show, regardless of how much the
      // live preview happens to be decimating for performance right now.
      const realIndex = scaledAllDashes.indexOf(picked as (typeof scaledAllDashes)[number]);
      const ordinal = realIndex >= 0 ? realIndex + 1 : bestIdx + 1;
      setSelectedKey(ordinal);
      onSelectStitch({
        index: ordinal,
        total,
        kind: picked.kind,
        lengthMm: picked.lengthMm,
        xMm: picked.x2 / PX_PER_MM,
        yMm: picked.y2 / PX_PER_MM,
        colorIndex: picked.colorIndex,
        colorHex:
          picked.kind === 'jump' || picked.kind === 'stop'
            ? null
            : palette[picked.colorIndex % Math.max(1, palette.length)] ?? null,
      });
    },
    [containerSize, scaledDashes, scaledAllDashes, total, palette, onSelectStitch, localToSvg, zoom, pan]
  );

  const maybeDoubleTap = useCallback((localX: number, localY: number): boolean => {
    const now = Date.now();
    const last = lastTapRef.current;
    lastTapRef.current = { time: now, x: localX, y: localY };
    if (last && now - last.time < DOUBLE_TAP_MS && Math.hypot(localX - last.x, localY - last.y) < 30) {
      lastTapRef.current = null;
      return true;
    }
    return false;
  }, []);

  const handleTapAt = useCallback(
    (localX: number, localY: number) => {
      if (maybeDoubleTap(localX, localY)) {
        resetView();
        return;
      }
      resolveTapAtLocalPoint(localX, localY);
    },
    [maybeDoubleTap, resetView, resolveTapAtLocalPoint]
  );

  const panBy = useCallback(
    (dxScreen: number, dyScreen: number) => {
      if (baseScale <= 0) return;
      const scale = zoom * baseScale;
      setPan((p) => clampPan({ x: p.x - dxScreen / scale, y: p.y - dyScreen / scale }, zoom));
    },
    [baseScale, zoom, clampPan]
  );

  // --- Web: wheel-to-zoom + mouse drag-to-pan ---------------------------
  // Attached as a raw, non-passive DOM listener (rather than the React
  // `onWheel` prop) specifically so `preventDefault()` actually works --
  // modern browsers/React register synthetic wheel listeners as passive
  // by default, which silently makes `preventDefault()` a no-op (and logs
  // a console warning) and lets the whole page scroll along with the zoom
  // gesture.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = stageRef.current as unknown as HTMLElement | null;
    if (!node || typeof node.addEventListener !== 'function') return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      refreshContainerOffset();
      const localX = e.clientX - containerPageOffsetRef.current.x;
      const localY = e.clientY - containerPageOffsetRef.current.y;
      const factor = Math.exp(clamp(-e.deltaY * 0.0015, -0.4, 0.4));
      zoomAt(localX, localY, zoom * factor);
    };
    node.addEventListener('wheel', handleWheel, { passive: false });
    return () => node.removeEventListener('wheel', handleWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, zoomAt, refreshContainerOffset]);

  const handleMouseDown = useCallback(
    (e: { clientX: number; clientY: number }) => {
      refreshContainerOffset();
      dragRef.current = {
        isPinch: false,
        moved: false,
        lastX: e.clientX,
        lastY: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
        pinchStartDist: 0,
        pinchStartZoom: zoom,
      };
    },
    [refreshContainerOffset, zoom]
  );

  const handleMouseMove = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.lastX;
      const dy = e.clientY - drag.lastY;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > TAP_MOVE_THRESHOLD_PX) {
        drag.moved = true;
      }
      if (drag.moved) panBy(dx, dy);
    },
    [panBy]
  );

  const endMouseDrag = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const drag = dragRef.current;
      dragRef.current = null;
      if (!drag) return;
      if (!drag.moved) {
        handleTapAt(e.clientX - containerPageOffsetRef.current.x, e.clientY - containerPageOffsetRef.current.y);
      }
    },
    [handleTapAt]
  );

  // --- Native: touch pan + pinch-zoom (RN responder system) -------------
  const touchDist = (a: Readonly<{ pageX: number; pageY: number }>, b: Readonly<{ pageX: number; pageY: number }>) =>
    Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);

  const onResponderGrant = useCallback(
    (evt: GestureResponderEvent) => {
      refreshContainerOffset();
      const touches = evt.nativeEvent.touches ?? [];
      if (touches.length >= 2) {
        dragRef.current = {
          isPinch: true,
          moved: true,
          lastX: 0,
          lastY: 0,
          startX: 0,
          startY: 0,
          pinchStartDist: touchDist(touches[0], touches[1]),
          pinchStartZoom: zoom,
        };
      } else {
        const t = touches[0];
        dragRef.current = {
          isPinch: false,
          moved: false,
          lastX: t?.pageX ?? 0,
          lastY: t?.pageY ?? 0,
          startX: t?.pageX ?? 0,
          startY: t?.pageY ?? 0,
          pinchStartDist: 0,
          pinchStartZoom: zoom,
        };
      }
    },
    [refreshContainerOffset, zoom]
  );

  const onResponderMove = useCallback(
    (evt: GestureResponderEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const touches = evt.nativeEvent.touches ?? [];
      if (touches.length >= 2) {
        if (!drag.isPinch) {
          drag.isPinch = true;
          drag.pinchStartDist = touchDist(touches[0], touches[1]);
          drag.pinchStartZoom = zoom;
        }
        const dist = touchDist(touches[0], touches[1]);
        const ratio = drag.pinchStartDist > 1 ? dist / drag.pinchStartDist : 1;
        const midX = (touches[0].pageX + touches[1].pageX) / 2 - containerPageOffsetRef.current.x;
        const midY = (touches[0].pageY + touches[1].pageY) / 2 - containerPageOffsetRef.current.y;
        drag.moved = true;
        zoomAt(midX, midY, drag.pinchStartZoom * ratio);
      } else {
        const t = touches[0];
        if (!t) return;
        const dx = t.pageX - drag.lastX;
        const dy = t.pageY - drag.lastY;
        drag.lastX = t.pageX;
        drag.lastY = t.pageY;
        if (!drag.moved && Math.hypot(t.pageX - drag.startX, t.pageY - drag.startY) > TAP_MOVE_THRESHOLD_PX) {
          drag.moved = true;
        }
        if (drag.moved) panBy(dx, dy);
      }
    },
    [zoom, zoomAt, panBy]
  );

  const onResponderRelease = useCallback(() => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag && !drag.moved && !drag.isPinch) {
      handleTapAt(drag.startX - containerPageOffsetRef.current.x, drag.startY - containerPageOffsetRef.current.y);
    }
  }, [handleTapAt]);

  const selectedDash = useMemo(() => {
    if (selectedKey === null) return null;
    return scaledAllDashes[selectedKey - 1] ?? null;
  }, [selectedKey, scaledAllDashes]);

  const isWeb = Platform.OS === 'web';
  const zoomPct = Math.round(zoom * 100);

  // react-native-web accepts standard DOM mouse events and CSS cursor
  // styling on a plain View; RN's own prop/style types don't know about
  // either, so this one small slice of props is built as `any` rather than
  // fighting the types prop-by-prop.
  const webOnlyProps: Record<string, unknown> = isWeb
    ? {
        onMouseDown: handleMouseDown,
        onMouseMove: handleMouseMove,
        onMouseUp: endMouseDrag,
        onMouseLeave: () => {
          dragRef.current = null;
        },
        style: [styles.wrap, { cursor: zoom > 1 ? 'grab' : 'default' }],
      }
    : {};

  return (
    <View
      ref={stageRef}
      style={styles.wrap}
      onLayout={onLayout}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={onResponderGrant}
      onResponderMove={onResponderMove}
      onResponderRelease={onResponderRelease}
      onResponderTerminate={onResponderRelease}
      {...webOnlyProps}
    >
      <Svg width="100%" height="100%" viewBox={effectiveViewBox}>
        <Defs>
          {palette.map((hex, i) => (
            // gradientUnits="userSpaceOnUse" with a FIXED direction spanning
            // the whole canvas (not each line's own bounding box, the SVG
            // default) is deliberate, not just a style choice: a perfectly
            // horizontal or perfectly vertical stitch has a zero-width or
            // zero-height bounding box, and per the SVG spec a gradient
            // keyed to a degenerate bounding box is ignored entirely --
            // which silently drops the thread color back to flat gray on
            // exactly the axis-aligned stitches real fill/satin rows are
            // full of. Spanning the whole viewBox instead sidesteps that
            // entirely and, as a bonus, gives every stitch in the design a
            // consistent global light direction, like real thread catching
            // one light source across a whole embroidered patch.
            <LinearGradient
              key={`grad-${i}`}
              id={`thread-grad-${i}`}
              gradientUnits="userSpaceOnUse"
              x1={0}
              y1={0}
              x2={viewW}
              y2={viewH}
            >
              <Stop offset="0%" stopColor={lighten(hex, 0.5)} />
              <Stop offset="48%" stopColor={hex} />
              <Stop offset="100%" stopColor={darken(hex, 0.38)} />
            </LinearGradient>
          ))}
        </Defs>

        {/* fabric backdrop with a woven cross-hatch texture */}
        <Rect x={0} y={0} width={viewW} height={viewH} fill="#F4F3EF" />
        {Array.from({ length: Math.ceil(viewW / (PX_PER_MM * 0.9)) }).map((_, i) => (
          <Line
            key={`weave-v-${i}`}
            x1={i * PX_PER_MM * 0.9}
            y1={0}
            x2={i * PX_PER_MM * 0.9}
            y2={viewH}
            stroke="rgba(180,178,168,0.3)"
            strokeWidth={0.6}
          />
        ))}
        {Array.from({ length: Math.ceil(viewH / (PX_PER_MM * 0.9)) }).map((_, i) => (
          <Line
            key={`weave-h-${i}`}
            x1={0}
            y1={i * PX_PER_MM * 0.9}
            x2={viewW}
            y2={i * PX_PER_MM * 0.9}
            stroke="rgba(180,178,168,0.22)"
            strokeWidth={0.6}
          />
        ))}

        {/* jump pass -- thin dashed gray lines, visually distinct from real
            thread, matching the convention every digitizing tool uses */}
        {jumpDashes.map((s, i) => (
          <Line
            key={`jump-${i}`}
            x1={s.x1}
            y1={s.y1}
            x2={s.x2}
            y2={s.y2}
            stroke="rgba(90,95,110,0.55)"
            strokeWidth={Math.max(0.8, strokeW * 0.3)}
            strokeDasharray={`${PX_PER_MM * 0.6} ${PX_PER_MM * 0.4}`}
          />
        ))}

        {/* shadow pass -- gives each dash its raised/embossed look, offset
            across its OWN width rather than a fixed page diagonal */}
        {!fullEmboss
          ? null
          : stitchDashes.map((s, i) => (
              <Line
                key={`shadow-${i}`}
                x1={s.x1 + s.nx * shadowOffset}
                y1={s.y1 + s.ny * shadowOffset}
                x2={s.x2 + s.nx * shadowOffset}
                y2={s.y2 + s.ny * shadowOffset}
                stroke="rgba(10,10,20,0.3)"
                strokeWidth={strokeW * 1.1}
                strokeLinecap="round"
              />
            ))}

        {/* main thread-colored pass -- one dash per stitch */}
        {stitchDashes.map((s, i) => (
          <Line
            key={`body-${i}`}
            x1={s.x1}
            y1={s.y1}
            x2={s.x2}
            y2={s.y2}
            stroke={`url(#thread-grad-${s.colorIndex % Math.max(1, palette.length)})`}
            strokeWidth={strokeW}
            strokeLinecap="round"
          />
        ))}

        {/* sheen pass -- thin bright highlight along each dash's own lit edge */}
        {!fullEmboss
          ? null
          : stitchDashes.map((s, i) => (
              <Line
                key={`sheen-${i}`}
                x1={s.x1 - s.nx * highlightOffset}
                y1={s.y1 - s.ny * highlightOffset}
                x2={s.x2 - s.nx * highlightOffset}
                y2={s.y2 - s.ny * highlightOffset}
                stroke="rgba(255,255,255,0.42)"
                strokeWidth={Math.max(0.6, strokeW * 0.3)}
                strokeLinecap="round"
              />
            ))}

        {/* machine-pause markers -- real pyembroidery STOP commands
            (PUFF_3D/APPLIQUE regions only). Drawn as an amber ring with a
            pause glyph so it reads unmistakably as "the machine stops
            here", distinct from the indigo tap-to-inspect selection ring
            below. */}
        {stopDashes.map((s, i) => (
          <React.Fragment key={`stop-${i}`}>
            <Circle
              cx={s.x2}
              cy={s.y2}
              r={PX_PER_MM * 1.5}
              fill="rgba(217,164,65,0.18)"
              stroke="#D9A441"
              strokeWidth={1.8}
            />
            <Rect
              x={s.x2 - PX_PER_MM * 0.45}
              y={s.y2 - PX_PER_MM * 0.55}
              width={PX_PER_MM * 0.3}
              height={PX_PER_MM * 1.1}
              rx={PX_PER_MM * 0.1}
              fill="#D9A441"
            />
            <Rect
              x={s.x2 + PX_PER_MM * 0.15}
              y={s.y2 - PX_PER_MM * 0.55}
              width={PX_PER_MM * 0.3}
              height={PX_PER_MM * 1.1}
              rx={PX_PER_MM * 0.1}
              fill="#D9A441"
            />
          </React.Fragment>
        ))}

        {/* selection marker -- the tapped stitch/jump's end point */}
        {selectedDash && (
          <>
            <Circle cx={selectedDash.x2} cy={selectedDash.y2} r={PX_PER_MM * 1.4} fill="none" stroke={themeColors.indigo} strokeWidth={1.6} />
            <Circle cx={selectedDash.x2} cy={selectedDash.y2} r={PX_PER_MM * 0.35} fill={themeColors.indigo} />
          </>
        )}

        {/* live needle-tip marker -- in-SVG so it stays correctly placed
            under any zoom/pan without any external caller needing to know
            this component's view transform */}
        {tipView && progress > 0 && progress < 1 && (
          <AnimatedCircle
            cx={tipView.x}
            animatedProps={needleAnimatedProps}
            r={PX_PER_MM * 0.6}
            fill="#FFFFFF"
            stroke={themeColors.indigo}
            strokeWidth={2}
          />
        )}
      </Svg>

      {!hideZoomControls && (
        <View style={styles.zoomPill} pointerEvents="box-none">
          <Pressable
            onPress={() => zoomCenter(1 / ZOOM_BUTTON_STEP)}
            style={styles.zoomBtn}
            disabled={zoom <= MIN_ZOOM + 0.01}
          >
            <Minus size={14} color={zoom <= MIN_ZOOM + 0.01 ? themeColors.textTertiary : themeColors.textPrimary} />
          </Pressable>
          <Pressable onPress={resetView} style={styles.zoomBtn}>
            {zoom > 1.01 ? (
              <Text style={styles.zoomPct}>{zoomPct}%</Text>
            ) : (
              <Maximize2 size={13} color={themeColors.textPrimary} />
            )}
          </Pressable>
          <Pressable
            onPress={() => zoomCenter(ZOOM_BUTTON_STEP)}
            style={styles.zoomBtn}
            disabled={zoom >= MAX_ZOOM - 0.01}
          >
            <Plus size={14} color={zoom >= MAX_ZOOM - 0.01 ? themeColors.textTertiary : themeColors.textPrimary} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    height: '100%',
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: '#F4F3EF',
  },
  zoomPill: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 999,
    paddingHorizontal: 2,
    paddingVertical: 2,
    gap: 2,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  zoomBtn: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomPct: {
    fontSize: 11,
    fontWeight: '600',
    color: themeColors.textPrimary,
    minWidth: 30,
    textAlign: 'center',
  },
});
