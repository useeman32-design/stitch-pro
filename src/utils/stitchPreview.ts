/**
 * Common stitch-preview data shape + converters.
 *
 * Two different sources can produce a stitch plan worth previewing:
 *   1. The browser-only client-side analysis (stitchEngine.ts's
 *      `buildStitchSegments`) — grid-space segments, web only.
 *   2. The real server-digitized plan from stitchpro-backend's
 *      `POST /api/design/image-to-points` (Milestone 5) — a `DstPoint[]`
 *      stream in absolute 0.1mm units, same contract as dstWriter.ts.
 *
 * `MmSegment` is the one shape every renderer (see EmbossedStitchCanvas)
 * actually draws, so both sources just need a converter into it and the
 * rendering code never has to know or care where a design came from.
 */

import type { DstPoint } from './dstWriter';
import type { StitchSegment } from './stitchEngine';

export interface MmSegment {
  /** Top-left-origin mm coordinates (0,0 = top-left of the design box,
   * widthMm/heightMm = bottom-right) — i.e. already un-centered, ready to
   * map straight onto an SVG viewBox sized to the design's physical box. */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  colorIndex: number;
}

export interface StitchPreviewData {
  segments: MmSegment[];
  palette: string[];
  widthMm: number;
  heightMm: number;
}

/** Converts the legacy grid-space client-analysis segments (0..gridSize,
 * no inherent physical size) into mm space for a given target box. */
export function gridSegmentsToMm(
  segments: StitchSegment[],
  gridSize: number,
  widthMm: number,
  heightMm: number
): MmSegment[] {
  const scaleX = widthMm / gridSize;
  const scaleY = heightMm / gridSize;
  return segments.map((s) => ({
    x1: (s.x1 + 0.5) * scaleX,
    y1: (s.y1 + 0.5) * scaleY,
    x2: (s.x2 + 0.5) * scaleX,
    y2: (s.y2 + 0.5) * scaleY,
    colorIndex: s.colorIndex,
  }));
}

/**
 * Converts a server-digitized point stream (absolute 0.1mm units, centered
 * at the design's origin — see stitchpro-backend's points_export.py) into
 * mm-space segments. Mirrors exactly how a real embroidery machine
 * interprets the stream: a `stitch` command lays visible thread from
 * wherever the needle currently is to its new position; a `jump` only
 * moves the needle (no segment drawn); a `colorChange` doesn't move the
 * needle but advances which palette color subsequent segments use.
 */
export function pointsToMmSegments(
  points: DstPoint[],
  widthMm: number,
  heightMm: number
): MmSegment[] {
  const segments: MmSegment[] = [];
  let cx = 0;
  let cy = 0;
  let colorIndex = 0;
  let haveCurrent = false;

  const toMm = (x: number, y: number) => ({
    x: x / 10 + widthMm / 2,
    y: y / 10 + heightMm / 2,
  });

  for (const p of points) {
    const { x: xMm, y: yMm } = toMm(p.x, p.y);
    if (p.command === 'stitch' && haveCurrent) {
      segments.push({ x1: cx, y1: cy, x2: xMm, y2: yMm, colorIndex });
    }
    if (p.command === 'colorChange') {
      colorIndex += 1;
    } else {
      cx = xMm;
      cy = yMm;
      haveCurrent = true;
    }
  }

  return segments;
}
