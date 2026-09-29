/**
 * Tajima DST embroidery file writer — a real, byte-accurate binary encoder
 * for the industry-standard .dst machine embroidery format. This produces
 * an actual file that real embroidery machines (Tajima, Barudan, SWF,
 * Brother, Melco, and virtually every commercial multi-head machine) can
 * read and stitch out — not a preview image, not a simulation.
 *
 * The stitch-record bit layout and header field formats implemented here
 * are a direct, verified port of the algorithm used by pyembroidery
 * (https://github.com/EmbroidePy/pyembroidery), the most widely used
 * open-source embroidery file library, cross-checked by round-tripping
 * generated files back through pyembroidery's own reader during
 * development. DST has no published vendor spec — every implementation
 * (commercial or open-source) is built on the same decades of community
 * reverse-engineering, which is exactly what this port is based on.
 *
 * Units: all coordinates in this module are in 0.1mm ("DST units"), with
 * +X to the right and +Y downward (screen-like), matching the rest of the
 * app's canvas-based coordinate conventions. This module flips Y
 * internally so the encoded file matches real machines' native
 * up-positive Y axis — callers never need to think about that.
 */

export type DstCommand = 'stitch' | 'jump' | 'colorChange' | 'end';

export interface DstPoint {
  /** Absolute X position in 0.1mm units, screen-style (+right). */
  x: number;
  /** Absolute Y position in 0.1mm units, screen-style (+down). */
  y: number;
  command: DstCommand;
}

export interface DstMeta {
  /** Design label, max 16 chars (Tajima header convention). */
  name?: string;
}

const MAX_STEP = 121; // max |dx| or |dy| encodable in a single 3-byte record (12.1mm)
const HEADER_SIZE = 512;

function bit(b: number): number {
  return 1 << b;
}

/**
 * Encodes one 3-byte stitch record. `dx`/`dy` must already be integers in
 * [-121, 121] (0.1mm units) — callers are responsible for splitting any
 * longer move into multiple records first (see `splitLongMoves`).
 */
function encodeRecord(dx: number, dy: number, command: DstCommand): [number, number, number] {
  // DST's native axis is Y-up; this module works in screen-style Y-down,
  // so flip once here at the encoding boundary.
  let x = dx;
  let y = -dy;
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;

  if (command === 'jump') {
    b2 += bit(7);
  }
  if (command === 'stitch' || command === 'jump') {
    b2 += bit(0);
    b2 += bit(1);
    if (x > 40) {
      b2 += bit(2);
      x -= 81;
    }
    if (x < -40) {
      b2 += bit(3);
      x += 81;
    }
    if (x > 13) {
      b1 += bit(2);
      x -= 27;
    }
    if (x < -13) {
      b1 += bit(3);
      x += 27;
    }
    if (x > 4) {
      b0 += bit(2);
      x -= 9;
    }
    if (x < -4) {
      b0 += bit(3);
      x += 9;
    }
    if (x > 1) {
      b1 += bit(0);
      x -= 3;
    }
    if (x < -1) {
      b1 += bit(1);
      x += 3;
    }
    if (x > 0) {
      b0 += bit(0);
      x -= 1;
    }
    if (x < 0) {
      b0 += bit(1);
      x += 1;
    }
    if (x !== 0) {
      throw new Error(`DST encode: dx out of range (residual ${x}); split moves before encoding.`);
    }
    if (y > 40) {
      b2 += bit(5);
      y -= 81;
    }
    if (y < -40) {
      b2 += bit(4);
      y += 81;
    }
    if (y > 13) {
      b1 += bit(5);
      y -= 27;
    }
    if (y < -13) {
      b1 += bit(4);
      y += 27;
    }
    if (y > 4) {
      b0 += bit(5);
      y -= 9;
    }
    if (y < -4) {
      b0 += bit(4);
      y += 9;
    }
    if (y > 1) {
      b1 += bit(7);
      y -= 3;
    }
    if (y < -1) {
      b1 += bit(6);
      y += 3;
    }
    if (y > 0) {
      b0 += bit(7);
      y -= 1;
    }
    if (y < 0) {
      b0 += bit(6);
      y += 1;
    }
    if (y !== 0) {
      throw new Error(`DST encode: dy out of range (residual ${y}); split moves before encoding.`);
    }
  } else if (command === 'colorChange') {
    b2 = 0b11000011;
  } else if (command === 'end') {
    b2 = 0b11110011;
  }
  return [b0, b1, b2];
}

/**
 * Splits any stitch/jump whose dx or dy exceeds the 12.1mm per-record limit
 * into multiple intermediate moves of the same command type, each within
 * range. Real digitizing software does this transparently; DST itself has
 * no notion of a "long" stitch.
 */
function splitLongMoves(points: DstPoint[]): DstPoint[] {
  const out: DstPoint[] = [];
  let cx = 0;
  let cy = 0;
  for (const p of points) {
    if (p.command === 'colorChange' || p.command === 'end') {
      out.push(p);
      cx = p.x;
      cy = p.y;
      continue;
    }
    let dx = p.x - cx;
    let dy = p.y - cy;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / MAX_STEP));
    for (let i = 1; i <= steps; i++) {
      const stepX = cx + Math.round((dx * i) / steps);
      const stepY = cy + Math.round((dy * i) / steps);
      out.push({ x: stepX, y: stepY, command: p.command });
    }
    cx = p.x;
    cy = p.y;
  }
  return out;
}

function padHeaderField(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/**
 * Builds a complete, real .dst file from an ordered list of absolute-
 * position points (screen-style, 0.1mm units). The first "stitch" after
 * the implicit origin (0,0) is treated as a move from the origin.
 */
export function buildDstFile(points: DstPoint[], meta: DstMeta = {}): Uint8Array {
  const withEnd: DstPoint[] = [...points];
  if (withEnd.length === 0 || withEnd[withEnd.length - 1].command !== 'end') {
    const last = withEnd[withEnd.length - 1] ?? { x: 0, y: 0, command: 'stitch' as DstCommand };
    withEnd.push({ x: last.x, y: last.y, command: 'end' });
  }
  const split = splitLongMoves(withEnd);

  // bounds + counts, computed from the real point list (used in the header)
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;
  let stitchCount = 0;
  let colorChanges = 0;
  for (const p of split) {
    if (p.command === 'stitch' || p.command === 'jump') {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    if (p.command === 'stitch' || p.command === 'jump') stitchCount++;
    if (p.command === 'colorChange') colorChanges++;
  }
  const lastReal = [...split].reverse().find((p) => p.command === 'stitch' || p.command === 'jump');
  const ax = lastReal?.x ?? 0;
  const ay = lastReal ? -lastReal.y : 0; // header reports in DST's native (Y-up) axis, like the stitch data

  const name = (meta.name ?? 'STITCHPRO').slice(0, 16);
  const pad3 = (n: number) => String(Math.abs(Math.round(n))).padStart(5, ' ');
  const sign = (n: number) => (n >= 0 ? '+' : '-');

  const headerLines =
    `LA:${name.padEnd(16, ' ')}\r` +
    `ST:${String(stitchCount).padStart(7, ' ')}\r` +
    `CO:${String(colorChanges).padStart(3, ' ')}\r` +
    `+X:${pad3(maxX)}\r` +
    `-X:${pad3(minX)}\r` +
    `+Y:${pad3(maxY)}\r` +
    `-Y:${pad3(minY)}\r` +
    `AX:${sign(ax)}${pad3(ax)}\r` +
    `AY:${sign(ay)}${pad3(ay)}\r` +
    `MX:+${pad3(0)}\r` +
    `MY:+${pad3(0)}\r` +
    `PD:${'******'.padStart(6, ' ')}\r`;

  const headerBytes = padHeaderField(headerLines);
  const header = new Uint8Array(HEADER_SIZE);
  header.set(headerBytes, 0);
  header[headerBytes.length] = 0x1a; // EOF marker
  for (let i = headerBytes.length + 1; i < HEADER_SIZE; i++) header[i] = 0x20; // space padding

  const body = new Uint8Array(split.length * 3);
  let cx = 0;
  let cy = 0;
  let offset = 0;
  for (const p of split) {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const [b0, b1, b2] = encodeRecord(dx, dy, p.command);
    body[offset++] = b0;
    body[offset++] = b1;
    body[offset++] = b2;
    cx = p.x;
    cy = p.y;
  }

  const out = new Uint8Array(HEADER_SIZE + body.length);
  out.set(header, 0);
  out.set(body, HEADER_SIZE);
  return out;
}
