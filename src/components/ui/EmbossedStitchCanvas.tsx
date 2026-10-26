import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Rect, Stop } from 'react-native-svg';
import { radius } from '@/theme';
import type { MmSegment } from '@/utils/stitchPreview';

interface EmbossedStitchCanvasProps {
  segments: MmSegment[];
  palette: string[];
  widthMm: number;
  heightMm: number;
  progress: number; // 0..1
  onNeedlePosition?: (pos: { xPct: number; yPct: number } | null) => void;
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
}

/**
 * Chops every segment into short, individually-separated stitch dashes
 * (see `STITCH_LEN_MM`/`STITCH_GAP_MM` above) -- the single biggest visual
 * difference between "a rendered line" and "a row of real stitches".
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
        nx,
        ny,
      });
    }
  }
  return out;
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
}: EmbossedStitchCanvasProps) {
  const viewW = Math.max(1, widthMm * PX_PER_MM);
  const viewH = Math.max(1, heightMm * PX_PER_MM);

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
    () => (segments.length <= MAX_SEGMENTS_FOR_DASHING ? subdivideIntoDashes(segments) : segments.map((s) => ({ ...s, nx: 0, ny: 0 }))),
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
  if (progress < 1 && total > DECIMATE_ABOVE) {
    const step = Math.ceil(total / DECIMATE_ABOVE);
    if (step > 1) {
      drawDashes = drawDashes.filter((_, i) => i % step === 0);
    }
  }

  const scaledDashes = drawDashes;

  const fullEmboss = scaledDashes.length <= EMBOSS_LAYER_CAP;

  // Thread width scales gently with design size so a tiny monogram and a
  // large back patch both look proportionate rather than either needle-thin
  // or comically thick.
  const strokeW = Math.max(1.6, Math.min(3.2, PX_PER_MM * 0.22));
  const shadowOffset = strokeW * 0.42;
  const highlightOffset = strokeW * 0.24;

  return (
    <View style={styles.wrap}>
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

        {/* shadow pass -- gives each dash its raised/embossed look, offset
            across its OWN width rather than a fixed page diagonal */}
        {!fullEmboss
          ? null
          : scaledDashes.map((s, i) => (
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
        {scaledDashes.map((s, i) => (
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
          : scaledDashes.map((s, i) => (
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
      </Svg>
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
});
