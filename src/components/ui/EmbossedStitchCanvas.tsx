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

// Above this many *visible* segments, drop the 3-layer emboss treatment
// down to a single gradient stroke (still colored/shaded, just no
// separate shadow/highlight passes) to keep native SVG element counts
// reasonable during a live progress animation.
const EMBOSS_LAYER_CAP = 1200;
// Above this many visible segments, thin out which ones get drawn at all
// while progress is still animating (full fidelity returns once
// progress >= 1) -- a dense fill design can easily have several thousand
// stitches, and redrawing all of them ~10x/second is unnecessary for what
// is, after all, just a preview.
const DECIMATE_ABOVE = 5000;

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

/**
 * Realistic *2D* raised/embossed thread rendering -- not a true 3D scene
 * (no WebGL, no camera, nothing that needs a GPU shader pipeline mobile
 * Expo apps can't reliably ship), just a flat render that *reads* as
 * raised, sheened thread sitting on top of fabric, built from ordinary
 * layered SVG strokes:
 *
 *   1. A soft, dark, slightly-offset "shadow" stroke underneath each
 *      stitch -- the offset (not a blur, which react-native-svg's cross-
 *      platform filter support can't be relied on for) is what reads as
 *      "this sits above the fabric surface, casting a small shadow".
 *   2. The real thread-colored stroke, filled with a fixed-direction
 *      (top-left -> bottom-right) linear gradient from a lightened tint
 *      through the base color to a darkened shade -- simulating a single,
 *      consistent light source catching the rounded cross-section of a
 *      strand of thread, the same way every stitch in a real embroidered
 *      patch catches the light from one direction at once.
 *   3. A thin, semi-transparent white "sheen" stroke offset the opposite
 *      way -- the glossy highlight line real thread shows along its lit
 *      edge.
 *
 * Built with react-native-svg so the exact same component (and the exact
 * same visual result) renders on web *and* native -- unlike the HTML
 * <canvas>-only renderer it replaces (see StitchCanvas.tsx), which drew
 * nothing at all on native.
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

  const visible = useMemo(() => {
    const total = segments.length;
    if (total === 0) return { full: [] as MmSegment[], partial: null as MmSegment | null, tip: null as { x: number; y: number } | null };

    const exact = Math.max(0, Math.min(total, progress * total));
    const fullCount = Math.floor(exact);
    const frac = exact - fullCount;

    let full = segments.slice(0, fullCount);
    let partial: MmSegment | null = null;
    let tip: { x: number; y: number } | null = null;

    if (fullCount < total && frac > 0) {
      const seg = segments[fullCount];
      const x2 = seg.x1 + (seg.x2 - seg.x1) * frac;
      const y2 = seg.y1 + (seg.y2 - seg.y1) * frac;
      partial = { ...seg, x2, y2 };
      tip = { x: x2, y: y2 };
    } else if (fullCount > 0) {
      const last = full[full.length - 1];
      tip = { x: last.x2, y: last.y2 };
    }

    // Thin out mid-animation redraws of very dense designs; always show
    // every segment once the stitch-out is actually complete.
    if (progress < 1 && full.length > DECIMATE_ABOVE) {
      const step = Math.ceil(full.length / DECIMATE_ABOVE);
      full = full.filter((_, i) => i % step === 0);
    }

    return { full, partial, tip };
  }, [segments, progress]);

  React.useEffect(() => {
    if (visible.tip) {
      onNeedlePosition?.({ xPct: (visible.tip.x / Math.max(1, widthMm)) * 100, yPct: (visible.tip.y / Math.max(1, heightMm)) * 100 });
    } else {
      onNeedlePosition?.(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible.tip, widthMm, heightMm]);

  const drawList = useMemo(
    () => (visible.partial ? [...visible.full, visible.partial] : visible.full),
    [visible.full, visible.partial]
  );

  const fullEmboss = drawList.length <= EMBOSS_LAYER_CAP;
  // Thread width scales gently with design size so a tiny monogram and a
  // large back patch both look proportionate rather than either needle-thin
  // or comically thick.
  const strokeW = Math.max(1.6, Math.min(3.2, PX_PER_MM * 0.22));
  const shadowOffset = strokeW * 0.4;
  const highlightOffset = strokeW * 0.22;

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

        {/* fabric backdrop */}
        <Rect x={0} y={0} width={viewW} height={viewH} fill="#F4F3EF" />
        {Array.from({ length: Math.ceil(viewW / (PX_PER_MM * 0.9)) }).map((_, i) => (
          <Line
            key={`weave-${i}`}
            x1={i * PX_PER_MM * 0.9}
            y1={0}
            x2={i * PX_PER_MM * 0.9}
            y2={viewH}
            stroke="rgba(180,178,168,0.3)"
            strokeWidth={0.6}
          />
        ))}

        {/* shadow pass -- gives the raised/embossed look */}
        {!fullEmboss
          ? null
          : drawList.map((s, i) => (
              <Line
                key={`shadow-${i}`}
                x1={s.x1 + shadowOffset}
                y1={s.y1 + shadowOffset}
                x2={s.x2 + shadowOffset}
                y2={s.y2 + shadowOffset}
                stroke="rgba(10,10,20,0.28)"
                strokeWidth={strokeW * 1.1}
                strokeLinecap="round"
              />
            ))}

        {/* main thread-colored pass */}
        {drawList.map((s, i) => (
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

        {/* sheen pass -- thin bright highlight along the lit edge */}
        {!fullEmboss
          ? null
          : drawList.map((s, i) => (
              <Line
                key={`sheen-${i}`}
                x1={s.x1 - highlightOffset}
                y1={s.y1 - highlightOffset}
                x2={s.x2 - highlightOffset}
                y2={s.y2 - highlightOffset}
                stroke="rgba(255,255,255,0.4)"
                strokeWidth={Math.max(0.6, strokeW * 0.32)}
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
