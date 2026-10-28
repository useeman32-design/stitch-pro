/**
 * Small, dependency-free polygon helpers for the vector region editor's
 * "redraw" tool (`VectorRegionEditor.tsx`) -- turning a raw freehand drag
 * (potentially hundreds of points, one per touch-move event) into a clean,
 * reasonably-sized closed ring, plus a client-side area estimate so the
 * editor can show a sensible number immediately after a redraw/add,
 * without waiting on a round trip to the backend (which recomputes the
 * real area anyway once the region list is submitted).
 */

export type Point = [number, number];

/** Perpendicular distance from `p` to the line through `a`-`b` (0 if `a`
 * and `b` coincide, falling back to point-to-point distance). */
function perpendicularDistance(p: Point, a: Point, b: Point): number {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-9) {
    return Math.hypot(px - ax, py - ay);
  }
  // |cross product| / |base| -- the standard point-to-line-segment-as-line distance.
  const cross = Math.abs(dx * (ay - py) - (ax - px) * dy);
  return cross / Math.sqrt(lenSq);
}

/**
 * Ramer-Douglas-Peucker simplification of an open polyline. Keeps the
 * first/last point always; drops any interior point within `epsilon` of
 * the line connecting its surviving neighbors. Used to turn a freehand
 * drag's raw per-touch-move point stream (easily 100-300+ points for a
 * few seconds of dragging) into a clean few-dozen-point polygon before
 * it's sent to the backend as a region's outer ring.
 */
export function simplifyPolyline(points: Point[], epsilon: number): Point[] {
  if (points.length < 3 || epsilon <= 0) return points;

  let maxDist = 0;
  let maxIndex = 0;
  const first = points[0];
  const last = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyPolyline(points.slice(0, maxIndex + 1), epsilon);
    const right = simplifyPolyline(points.slice(maxIndex), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [first, last];
}

/** Cheap incremental decimation applied *while* dragging (before the
 * final RDP simplify on release) so a long, slow drag doesn't grow the
 * live-preview array (and the SVG path it feeds) unbounded. Only keeps a
 * new point if it's at least `minDist` away (in the same units as the
 * incoming points) from the last kept point. */
export function shouldAppendPoint(points: Point[], next: Point, minDist: number): boolean {
  if (points.length === 0) return true;
  const last = points[points.length - 1];
  return Math.hypot(next[0] - last[0], next[1] - last[1]) >= minDist;
}

/** Shoelace-formula area of a simple (non-self-intersecting) closed
 * polygon, given as an open point list (no need to repeat the first point
 * at the end). Returns a positive value regardless of winding order. */
export function polygonArea(ring: Point[]): number {
  if (ring.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}
