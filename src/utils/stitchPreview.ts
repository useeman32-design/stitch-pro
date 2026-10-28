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
  /** 'stitch' (default, real thread -- what every existing caller means),
   * 'jump' (the needle moves with the thread trimmed/lifted, no thread
   * laid down between the two points), or 'stop' (a real machine pause --
   * PUFF_3D/APPLIQUE regions only -- the operator places foam/fabric and
   * trims before the machine continues; a zero-length marker at the
   * needle's current position, never a drawn line). Jumps were previously
   * discarded entirely by `pointsToMmSegments` -- real machine behavior,
   * not a renderable stitch -- but that also meant there was no way to
   * show or inspect them at all, which is exactly the "click to inspect
   * lines/jumps/points" ask: you can't click on data that was thrown away
   * before it ever reached the renderer. Kept optional (defaulting to
   * 'stitch' wherever omitted) so the older client-analysis path
   * (`gridSegmentsToMm`, which has no concept of jumps/stops at all) needs
   * no changes. */
  kind?: 'stitch' | 'jump' | 'stop';
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
 * needle but advances which palette color subsequent segments use; a
 * `stop` is a real machine pause at the needle's current position (same
 * x/y as the point before it -- see formats/dst/writer.py's STOP handling)
 * for a PUFF_3D/APPLIQUE region, rendered as a zero-length marker so a
 * client can show the user exactly where their machine will stop.
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
      segments.push({ x1: cx, y1: cy, x2: xMm, y2: yMm, colorIndex, kind: 'stitch' });
    } else if (p.command === 'jump' && haveCurrent) {
      // Previously discarded entirely -- real machine behavior (needle
      // lifted/thread trimmed, nothing stitched), but also real, visible
      // needle travel that a "click to inspect" view should be able to
      // show and report on, not silently hide as if it never happened.
      segments.push({ x1: cx, y1: cy, x2: xMm, y2: yMm, colorIndex, kind: 'jump' });
    } else if (p.command === 'stop' && haveCurrent) {
      // A real machine pause -- zero movement (the backend always emits
      // this at the same position as the preceding point), so x1/y1 and
      // x2/y2 are identical here on purpose. A renderer should draw this
      // as a point marker, never a line.
      segments.push({ x1: cx, y1: cy, x2: cx, y2: cy, colorIndex, kind: 'stop' });
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

