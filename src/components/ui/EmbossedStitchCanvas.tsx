import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors as themeColors, radius } from '@/theme';
import type { MmSegment } from '@/utils/stitchPreview';

export interface SelectedStitchInfo {
  /** 1-based ordinal among every playback unit (stitches + jumps) up to
   * and including this one -- "stitch #412 of 1,897", matching how a real
   * machine operator would refer to a position in the stitch-out. */
  index: number;
  total: number;
  kind: 'stitch' | 'jump';
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
  kind: 'stitch' | 'jump';
  /** Real mm-space length of this exact playback unit (a whole jump, or
   * one subdivided stitch dash) -- precomputed once here rather than
   * recomputed from scaled view-space coordinates at inspect time. */
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
}: EmbossedStitchCanvasProps) {
  const viewW = Math.max(1, widthMm * PX_PER_MM);
  const viewH = Math.max(1, heightMm * PX_PER_MM);

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [selectedKey, setSelectedKey] = useState<number | null>(null);
  // Used for hit-testing taps: `measure()` reliably returns this node's
  // on-screen page offset on BOTH native (iOS/Android) and web, unlike
  // `nativeEvent.locationX/locationY` -- react-native-web's Pressable
  // leaves `nativeEvent` as the raw browser MouseEvent, which has no
  // locationX/locationY at all, so relying on those silently broke every
  // tap on web (desktop + the web preview this app actually ships to
  // first). pageX/pageY + measure() works identically everywhere.
  const pressableRef = useRef<React.ElementRef<typeof Pressable> | null>(null);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setContainerSize({ width, height });
  }, []);

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
            kind: (s.kind ?? 'stitch') as 'stitch' | 'jump',
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

  const tip = useMemo(() => {
    if (partialDash) return { x: partialDash.x2 / PX_PER_MM, y: partialDash.y2 / PX_PER_MM };
    if (fullCount > 0) {
      const last = scaledAllDashes[fullCount - 1];
      return { x: last.x2 / PX_PER_MM, y: last.y2 / PX_PER_MM };
    }
    return null;
  }, [partialDash, scaledAllDashes, fullCount]);

  React.useEffect(() => {
    if (tip) {
      onNeedlePosition?.({ xPct: (tip.x / Math.max(1, widthMm)) * 100, yPct: (tip.y / Math.max(1, heightMm)) * 100 });
    } else {
      onNeedlePosition?.(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tip, widthMm, heightMm]);

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
  const stitchDashes = useMemo(() => scaledDashes.filter((d) => d.kind !== 'jump'), [scaledDashes]);
  const jumpDashes = useMemo(() => scaledDashes.filter((d) => d.kind === 'jump'), [scaledDashes]);

  const fullEmboss = stitchDashes.length <= EMBOSS_LAYER_CAP;

  // Thread width scales gently with design size so a tiny monogram and a
  // large back patch both look proportionate rather than either needle-thin
  // or comically thick.
  const strokeW = Math.max(1.6, Math.min(3.2, PX_PER_MM * 0.22));
  const shadowOffset = strokeW * 0.42;
  const highlightOffset = strokeW * 0.24;

  // Tap-to-inspect: maps a tap's on-screen pixel position back into the
  // SVG's own viewBox coordinate space, accounting for the same
  // "xMidYMid meet" letterboxing the <Svg> itself uses by default when the
  // container's aspect ratio doesn't exactly match the design's -- a
  // square logo in a wider/taller stage frame is letterboxed, and a naive
  // tap-position mapping that ignored that would misread every tap near
  // the letterboxed edges. Then finds whichever currently-visible dash
  // (stitch or jump) is closest, by real on-screen distance, and reports
  // it back via `onSelectStitch` -- this is the actual "click to inspect
  // lines/jumps/points" feature: without it, the simulator could only be
  // watched, never interrogated.
  const resolveTapAtLocalPoint = useCallback(
    (localX: number, localY: number) => {
      if (!onSelectStitch || containerSize.width <= 0 || containerSize.height <= 0 || scaledDashes.length === 0) {
        onSelectStitch?.(null);
        return;
      }
      const scale = Math.min(containerSize.width / viewW, containerSize.height / viewH);
      const renderedW = viewW * scale;
      const renderedH = viewH * scale;
      const offsetX = (containerSize.width - renderedW) / 2;
      const offsetY = (containerSize.height - renderedH) / 2;
      const svgX = (localX - offsetX) / scale;
      const svgY = (localY - offsetY) / scale;

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
      // A generous-but-bounded hit radius (12mm of view-space, i.e.
      // forgiving enough for a fingertip on a small screen without
      // matching a tap that landed nowhere near any thread).
      const hitRadiusPx = PX_PER_MM * 12;
      if (bestIdx < 0 || bestDist > hitRadiusPx * hitRadiusPx) {
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
        colorHex: picked.kind === 'jump' ? null : palette[picked.colorIndex % Math.max(1, palette.length)] ?? null,
      });
    },
    [containerSize, viewW, viewH, scaledDashes, scaledAllDashes, total, palette, onSelectStitch]
  );

  const handlePress = useCallback(
    (evt: {
      nativeEvent: {
        locationX?: number;
        locationY?: number;
        pageX?: number;
        pageY?: number;
      };
    }) => {
      if (!onSelectStitch) return;
      const { locationX, locationY, pageX, pageY } = evt.nativeEvent;
      const node = pressableRef.current as unknown as {
        measure?: (
          cb: (x: number, y: number, w: number, h: number, pageX: number, pageY: number) => void
        ) => void;
      } | null;
      // `locationX`/`locationY` are populated reliably on native iOS/Android,
      // but react-native-web's Pressable leaves `nativeEvent` as the raw
      // browser MouseEvent, which never has them -- so on web we instead
      // combine the event's page coordinates with this node's own
      // on-screen page offset (via `measure`, which works identically on
      // both native and web) to derive the same local, container-relative
      // point.
      if (typeof locationX === 'number' && typeof locationY === 'number') {
        resolveTapAtLocalPoint(locationX, locationY);
        return;
      }
      if (typeof pageX === 'number' && typeof pageY === 'number' && node?.measure) {
        node.measure((_x, _y, _w, _h, containerPageX, containerPageY) => {
          resolveTapAtLocalPoint(pageX - containerPageX, pageY - containerPageY);
        });
        return;
      }
      onSelectStitch(null);
    },
    [onSelectStitch, resolveTapAtLocalPoint]
  );

  const selectedDash = useMemo(() => {
    if (selectedKey === null) return null;
    return scaledAllDashes[selectedKey - 1] ?? null;
  }, [selectedKey, scaledAllDashes]);

  return (
    <Pressable
      ref={pressableRef}
      style={styles.wrap}
      onLayout={onLayout}
      onPress={onSelectStitch ? handlePress : undefined}
    >
      <Svg width="100%" height="100%" viewBox={`0 0 ${viewW} ${viewH}`}>
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

        {/* selection marker -- the tapped stitch/jump's end point */}
        {selectedDash && (
          <>
            <Circle cx={selectedDash.x2} cy={selectedDash.y2} r={PX_PER_MM * 1.4} fill="none" stroke={themeColors.indigo} strokeWidth={1.6} />
            <Circle cx={selectedDash.x2} cy={selectedDash.y2} r={PX_PER_MM * 0.35} fill={themeColors.indigo} />
          </>
        )}
      </Svg>
    </Pressable>
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
});
