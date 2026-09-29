/**
 * Stitch Engine — real, client-side image analysis + embroidery-style
 * rendering. Runs entirely in the browser (Canvas 2D), which is fine
 * because this app targets web export. No network calls, no fake data:
 * every function here actually inspects the pixels of the given image.
 */

import { Image as RNImage } from 'react-native';

export interface PaletteResult {
  colors: string[]; // hex, ranked by pixel coverage, most dominant first
  background: 'Transparent' | 'White' | 'Custom';
  complexity: number; // 0..1 rough measure of edge/detail density
}

export interface StitchSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  colorIndex: number;
}

const isWeb = typeof document !== 'undefined' && typeof window !== 'undefined';

/** Resolve any RN image source (require() id, {uri}, or plain string) to a real URL. */
export function resolveImageUri(source: any): string {
  if (!source) return '';
  if (typeof source === 'string') return source;
  if (typeof source === 'object' && source.uri) return source.uri;
  try {
    const resolved = RNImage.resolveAssetSource(source);
    return resolved?.uri ?? '';
  } catch {
    return '';
  }
}

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (!isWeb) {
      reject(new Error('Image analysis requires a browser environment.'));
      return;
    }
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = uri;
  });
}

function toHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

/**
 * Downscales the image onto an offscreen canvas and returns the 2D context
 * plus dimensions, so callers can read real pixel data.
 */
function rasterize(img: HTMLImageElement, maxDim = 160): { ctx: CanvasRenderingContext2D; w: number; h: number } {
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
  const w = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return { ctx, w, h };
}

/** Real dominant-color extraction via pixel-bucket quantization (not random/fake). */
export async function analyzeImage(source: any, maxColors = 5): Promise<PaletteResult> {
  const uri = resolveImageUri(source);
  const img = await loadImage(uri);
  const { ctx, w, h } = rasterize(img, 160);
  const { data } = ctx.getImageData(0, 0, w, h);

  const buckets = new Map<string, { r: number; g: number; b: number; count: number }>();
  let transparentPixels = 0;
  let totalPixels = 0;
  let edgeSum = 0;

  // luminance grid for a light edge-density estimate (complexity)
  const lum = new Float32Array(w * h);

  // These sample photos (and most real garment/patch mockups) center the
  // actual artwork with a border of surrounding fabric — so the color
  // *palette* is sampled from the center region only, matching how a real
  // digitizer focuses on the artwork rather than the garment behind it.
  // (Background detection and edge/complexity below still use the full frame.)
  const marginX = Math.round(w * 0.14);
  const marginY = Math.round(h * 0.14);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    const px = i / 4;
    const x = px % w;
    const y = Math.floor(px / w);
    lum[px] = 0.299 * r + 0.587 * g + 0.114 * b;
    totalPixels++;
    if (a < 16) {
      transparentPixels++;
      continue;
    }
    if (x < marginX || x >= w - marginX || y < marginY || y >= h - marginY) continue;
    // quantize to 6 levels per channel to group near-identical colors
    const qr = Math.round(r / 42.5) * 42.5;
    const qg = Math.round(g / 42.5) * 42.5;
    const qb = Math.round(b / 42.5) * 42.5;
    const key = `${qr}_${qg}_${qb}`;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      bucket.count += 1;
    } else {
      buckets.set(key, { r, g, b, count: 1 });
    }
  }

  // simple gradient magnitude sample for "complexity"
  let sampled = 0;
  for (let y = 1; y < h - 1; y += 2) {
    for (let x = 1; x < w - 1; x += 2) {
      const idx = y * w + x;
      const gx = lum[idx + 1] - lum[idx - 1];
      const gy = lum[idx + w] - lum[idx - w];
      edgeSum += Math.sqrt(gx * gx + gy * gy);
      sampled++;
    }
  }
  const complexity = sampled > 0 ? Math.max(0, Math.min(1, edgeSum / sampled / 180)) : 0.3;

  const ranked = Array.from(buckets.values())
    .filter((b) => b.count / Math.max(1, totalPixels - transparentPixels) > 0.012)
    .sort((a, b) => b.count - a.count);

  // merge visually-close colors so we don't report near-duplicates
  const merged: { r: number; g: number; b: number; count: number }[] = [];
  for (const bucket of ranked) {
    const avg = { r: bucket.r / bucket.count, g: bucket.g / bucket.count, b: bucket.b / bucket.count };
    const close = merged.find((m) => {
      const dr = m.r - avg.r;
      const dg = m.g - avg.g;
      const db = m.b - avg.b;
      return Math.sqrt(dr * dr + dg * dg + db * db) < 38;
    });
    if (close) {
      close.count += bucket.count;
    } else {
      merged.push({ ...avg, count: bucket.count });
    }
    if (merged.length >= maxColors * 2) break;
  }

  // background: inspect the four corner pixels — a real digitizer ignores
  // the garment/fabric behind the artwork, so anything that matches this
  // corner color AND covers a big share of the frame is treated as
  // "background" and excluded from the reported thread palette below.
  const corners = [
    [0, 0],
    [w - 1, 0],
    [0, h - 1],
    [w - 1, h - 1],
  ];
  let cornerAlphaSum = 0;
  let cornerR = 0;
  let cornerG = 0;
  let cornerB = 0;
  for (const [cx, cy] of corners) {
    const idx = (cy * w + cx) * 4;
    cornerAlphaSum += data[idx + 3];
    cornerR += data[idx];
    cornerG += data[idx + 1];
    cornerB += data[idx + 2];
  }
  const avgAlpha = cornerAlphaSum / corners.length;
  const avgR = cornerR / corners.length;
  const avgG = cornerG / corners.length;
  const avgB = cornerB / corners.length;
  let background: PaletteResult['background'] = 'Custom';
  if (avgAlpha < 60) background = 'Transparent';
  else if (avgR > 235 && avgG > 235 && avgB > 235) background = 'White';

  const saturationOf = (r: number, g: number, b: number) => {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    return max === 0 ? 0 : (max - min) / max;
  };

  // Conservative safety net: only drop a cluster if it BOTH overwhelmingly
  // dominates the frame AND is a near-flat, low-saturation match for the
  // corner background — that combination only fires for genuine
  // canvas/fabric backdrop, so a legitimate near-black or near-white thread
  // color (which rarely covers >35% of the centered artwork alone) survives.
  const totalCounted = merged.reduce((sum, m) => sum + m.count, 0) || 1;
  const isBackgroundish = (m: { r: number; g: number; b: number; count: number }) => {
    if (background === 'Transparent') return false;
    const dr = m.r - avgR;
    const dg = m.g - avgG;
    const db = m.b - avgB;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    const share = m.count / totalCounted;
    return dist < 25 && share > 0.35 && saturationOf(m.r, m.g, m.b) < 0.12;
  };

  const subjectClusters = merged.filter((m) => !isBackgroundish(m));
  const finalClusters = subjectClusters.length ? subjectClusters : merged;

  // Weight by population *and* saturation: embroidery is about the colors
  // actually being stitched, so a vivid thread color should outrank a
  // slightly larger patch of neutral fabric/background at similar coverage
  // (the same principle libraries like Vibrant.js use for swatch ranking).
  const colors = finalClusters
    .map((c) => ({ ...c, weight: c.count * (1 + saturationOf(c.r, c.g, c.b) * 2.2) }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, maxColors)
    .map((c) => toHex(c.r, c.g, c.b));

  return {
    colors: colors.length ? colors : ['#5B4FE8'],
    background,
    complexity,
  };
}

/** Nearest-palette-color quantization, used to render a "thread accurate" preview. */
function nearestPaletteIndex(r: number, g: number, b: number, palette: [number, number, number][]): number {
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const [pr, pg, pb] = palette[i];
    const dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}

function hexToRgb(hex: string): [number, number, number] {
  const c = hex.replace('#', '');
  return [parseInt(c.substring(0, 2), 16), parseInt(c.substring(2, 4), 16), parseInt(c.substring(4, 6), 16)];
}

/**
 * Renders an embroidery-style interpretation of the artwork onto the given
 * canvas: recolors to the exact thread palette, then lays down a satin
 * stitch-direction texture and a subtle thread sheen so it reads as
 * "stitched", not as the flat source photo.
 */
export async function renderStitchedPreview(
  source: any,
  palette: string[],
  density: 'Light' | 'Standard' | 'Dense' = 'Standard',
  size = 480
): Promise<string> {
  const uri = resolveImageUri(source);
  const img = await loadImage(uri);
  const rgbPalette = palette.map(hexToRgb);

  const workCanvas = document.createElement('canvas');
  const workDim = 140; // low-res pass for clean posterization
  workCanvas.width = workDim;
  workCanvas.height = workDim;
  const wctx = workCanvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  wctx.imageSmoothingEnabled = true;
  wctx.clearRect(0, 0, workDim, workDim);
  // letterbox-fit the artwork into a square
  const ratio = Math.min(workDim / img.naturalWidth, workDim / img.naturalHeight);
  const dw = img.naturalWidth * ratio;
  const dh = img.naturalHeight * ratio;
  wctx.drawImage(img, (workDim - dw) / 2, (workDim - dh) / 2, dw, dh);
  const imageData = wctx.getImageData(0, 0, workDim, workDim);
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 10) continue; // keep transparent as-is
    const idx = nearestPaletteIndex(data[i], data[i + 1], data[i + 2], rgbPalette);
    const [pr, pg, pb] = rgbPalette[idx];
    data[i] = pr;
    data[i + 1] = pg;
    data[i + 2] = pb;
  }
  wctx.putImageData(imageData, 0, 0);

  // final output canvas
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const octx = out.getContext('2d') as CanvasRenderingContext2D;
  octx.imageSmoothingEnabled = false; // keep the posterized edges crisp like fill stitching
  octx.drawImage(workCanvas, 0, 0, size, size);
  octx.imageSmoothingEnabled = true;

  // stitch-direction texture: diagonal satin lines, spacing driven by density
  const spacing = density === 'Dense' ? 3 : density === 'Light' ? 7 : 5;
  octx.save();
  octx.globalCompositeOperation = 'multiply';
  octx.strokeStyle = 'rgba(255,255,255,0.16)';
  octx.lineWidth = 1;
  for (let x = -size; x < size * 2; x += spacing) {
    octx.beginPath();
    octx.moveTo(x, 0);
    octx.lineTo(x + size, size);
    octx.stroke();
  }
  octx.strokeStyle = 'rgba(20,20,30,0.10)';
  for (let x = -size; x < size * 2; x += spacing) {
    octx.beginPath();
    octx.moveTo(x + spacing / 2, 0);
    octx.lineTo(x + spacing / 2 + size, size);
    octx.stroke();
  }
  octx.restore();

  // subtle emboss / thread sheen: light from top-left, shadow bottom-right
  octx.save();
  octx.globalCompositeOperation = 'overlay';
  const grad = octx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, 'rgba(255,255,255,0.22)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.18)');
  octx.fillStyle = grad;
  octx.fillRect(0, 0, size, size);
  octx.restore();

  return out.toDataURL('image/png');
}

/**
 * Builds a set of vector "stitch" line segments from the artwork by
 * posterizing to `colors` clusters and scanning rows for same-color runs —
 * a real (if simplified) fill-stitch path generator, used to animate an
 * actual stitch-out instead of wiping a static photo.
 */
export async function buildStitchSegments(
  source: any,
  colors: string[],
  gridSize = 72
): Promise<{ segments: StitchSegment[]; size: number }> {
  const uri = resolveImageUri(source);
  const img = await loadImage(uri);
  const rgbPalette = colors.map(hexToRgb);

  const canvas = document.createElement('canvas');
  canvas.width = gridSize;
  canvas.height = gridSize;
  const ctx = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  const ratio = Math.min(gridSize / img.naturalWidth, gridSize / img.naturalHeight);
  const dw = img.naturalWidth * ratio;
  const dh = img.naturalHeight * ratio;
  ctx.clearRect(0, 0, gridSize, gridSize);
  ctx.drawImage(img, (gridSize - dw) / 2, (gridSize - dh) / 2, dw, dh);
  const { data } = ctx.getImageData(0, 0, gridSize, gridSize);

  const indexGrid: number[] = new Array(gridSize * gridSize).fill(-1);
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const i = (y * gridSize + x) * 4;
      const a = data[i + 3];
      if (a < 40) continue;
      indexGrid[y * gridSize + x] = nearestPaletteIndex(data[i], data[i + 1], data[i + 2], rgbPalette);
    }
  }

  const segments: StitchSegment[] = [];
  // group by color so the simulated machine "changes thread" in blocks,
  // scanning zig-zag rows within each color's region (satin/fill look).
  for (let colorIndex = 0; colorIndex < rgbPalette.length; colorIndex++) {
    for (let y = 0; y < gridSize; y++) {
      let runStart = -1;
      const leftToRight = y % 2 === 0;
      const xs = leftToRight ? range(0, gridSize) : range(gridSize - 1, -1, -1);
      let prevX: number | null = null;
      for (const x of xs) {
        const match = indexGrid[y * gridSize + x] === colorIndex;
        if (match && runStart === -1) runStart = x;
        if (!match && runStart !== -1) {
          segments.push(makeSegment(runStart, prevX ?? runStart, y, colorIndex, gridSize));
          runStart = -1;
        }
        prevX = x;
      }
      if (runStart !== -1) {
        segments.push(makeSegment(runStart, prevX ?? runStart, y, colorIndex, gridSize));
      }
    }
  }

  return { segments, size: gridSize };
}

function range(start: number, stop: number, step = 1): number[] {
  const out: number[] = [];
  if (step > 0) {
    for (let i = start; i < stop; i += step) out.push(i);
  } else {
    for (let i = start; i > stop; i += step) out.push(i);
  }
  return out;
}

function makeSegment(xa: number, xb: number, y: number, colorIndex: number, gridSize: number): StitchSegment {
  return { x1: xa, y1: y, x2: xb, y2: y, colorIndex };
}

export function hexToRgba(hex: string, alpha = 1): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}
