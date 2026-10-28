/**
 * Thin client for the real `stitchpro-backend` Flask API (see the sibling
 * `stitchpro-backend` repo, `api/app.py`). This is the first real wiring
 * between this app's Auto-Digitize flow and the Python engine — previously
 * the two were completely disconnected codebases (the frontend did its own
 * full client-side analysis + stitch math + DST encoding in
 * stitchEngine.ts/stitchPlanner.ts/dstWriter.ts, and the backend was never
 * called at all).
 *
 * Design: the frontend's own artwork analysis + stitch-plan math stay
 * exactly as they are (they're real, and porting canvas pixel analysis to
 * a server round-trip would only add latency for no benefit). What the
 * backend adds that pure client-side JS genuinely cannot do is encode
 * real, byte-accurate multi-format embroidery files — PES/JEF/VP3/EXP, not
 * just DST — via its pyembroidery dependency. So this client sends the
 * already-computed stitch plan (DstPoint[] + thread colors) to
 * `POST /api/design/points-to-file` and gets back a real file in whatever
 * format was requested.
 *
 * No backend is deployed anywhere permanent yet (see continue.md), so this
 * is written to fail soft: every call has a short timeout and any failure
 * (unreachable host, non-200, network error) resolves to `null` rather
 * than throwing, so callers can always fall back to the pure client-side
 * DST path and the app keeps working with zero backend at all.
 */

import type { DstPoint } from '@/utils/dstWriter';

/**
 * Backend base URL. Empty string disables backend calls entirely (every
 * export falls back to the client-side DST-only path) — this is the safe
 * default for production until a real, persistent backend host exists.
 *
 * To test against a running backend (e.g. `python3 api/app.py` in the
 * stitchpro-backend repo, or this session's in-sandbox instance), either
 * edit this constant or, without rebuilding, run in the browser console:
 *   localStorage.setItem('stitchpro_backend_url', 'http://localhost:5050')
 * (clear it again with localStorage.removeItem(...) to go back to the
 * default above). See continue.md for the full cPanel deployment steps
 * needed to make a URL here permanent.
 */
export const DEFAULT_BACKEND_URL = '';

export function getBackendUrl(): string {
  if (typeof window !== 'undefined' && window.localStorage) {
    const override = window.localStorage.getItem('stitchpro_backend_url');
    if (override) return override.replace(/\/+$/, '');
  }
  return DEFAULT_BACKEND_URL.replace(/\/+$/, '');
}

export type BackendFormat = 'dst' | 'pes' | 'jef' | 'vp3' | 'exp';

const FETCH_TIMEOUT_MS = 8000;

/**
 * Converts the app's DstCommand union to exactly what the backend expects
 * — both already use the same names, this just narrows/validates the type
 * at the network boundary.
 */
function serializePoints(points: DstPoint[]) {
  return points.map((p) => ({ x: p.x, y: p.y, command: p.command }));
}

/**
 * Asks the real backend to encode `points` as a real `format` file.
 * Returns the raw file bytes as a Blob on success, or `null` on any
 * failure (backend disabled, unreachable, timed out, or returned an
 * error) — callers should always have a client-side fallback ready.
 */
export async function exportViaBackend(
  points: DstPoint[],
  colors: string[],
  format: BackendFormat,
  name: string
): Promise<Blob | null> {
  const baseUrl = getBackendUrl();
  if (!baseUrl || !points.length) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/api/design/points-to-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        points: serializePoints(points),
        colors,
        format,
        name: name.replace(/[^A-Za-z0-9-_]/g, '').slice(0, 32) || 'design',
      }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await response.blob();
  } catch {
    // Network error, timeout, CORS failure, backend down, etc. — the
    // whole point of this client is that none of these should ever break
    // the user's export; the caller falls back to the client-side writer.
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Quick liveness probe, used only to decide whether to show the user a
 * "connected to backend" style hint — never required for exports to work. */
export async function isBackendReachable(): Promise<boolean> {
  const baseUrl = getBackendUrl();
  if (!baseUrl) return false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${baseUrl}/api/health`, { signal: controller.signal });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

/** One entry of the backend's per-stitch-type breakdown -- see
 * stitchpro-backend's digitizer/points_export.py docstring. The
 * auto-digitizer classifies each detected region independently (thin
 * strokes/border bars -> SATIN, larger fills -> FILL, etc. -- see
 * digitizer/stitches/satin/thin_region.py), so a single design routinely
 * mixes stitch types across its regions; this is purely informational
 * (never part of the `points`/DST export contract) and lets a UI show
 * e.g. "SATIN · 4 regions" chips without parsing per-object detail out of
 * the flat point stream. Sorted by the backend in descending stitch-count
 * order. */
export interface StitchTypeBreakdownEntry {
  type:
    | 'RUNNING'
    | 'SATIN'
    | 'FILL'
    | 'CROSS_STITCH'
    | 'BEAN'
    | 'MOTIF'
    | 'PUFF_3D'
    | 'APPLIQUE';
  objectCount: number;
  stitchCount: number;
}

export interface BackendPointsResult {
  widthMm: number;
  heightMm: number;
  threads: string[];
  points: DstPoint[];
  stitchTypeBreakdown: StitchTypeBreakdownEntry[];
}

const IMAGE_FETCH_TIMEOUT_MS = 20000;

/**
 * Milestone 5 wiring: asks the real backend to actually digitize `imageUri`
 * server-side (decode -> segment -> embroidery objects -> real stitches,
 * see stitchpro-backend's digitizer/pipeline.py) and returns the result as
 * a plain point stream — the same `DstPoint`-shaped contract the app
 * already speaks everywhere else, so every existing point-based
 * converter/renderer keeps working unmodified.
 *
 * This is the one stitch-plan source that works identically on native and
 * web: the browser-canvas-only client analysis in stitchEngine.ts simply
 * cannot run on native at all (see useStitchPreview.ts, which tries this
 * first and only falls back to the client analysis on web). Returns `null`
 * on any failure (backend disabled/unreachable/timeout/error, or an image
 * with no detectable foreground) — callers should treat that as "no
 * backend preview available" rather than an error to surface loudly.
 */
export interface AnalyzeImageOptions {
  /** How many distinct thread colors to reduce the artwork to. Default 6. */
  maxColors?: number;
  /** "fill" (default, tatami rows) or "cross" (a grid of X's) -- see
   * stitchpro-backend's digitizer/pipeline.py. Applies to every detected
   * region in the design. */
  stitchStyle?: 'fill' | 'cross';
  /** Stitch/grid direction in degrees. Default 0. */
  angleDeg?: number;
  /** Adaptive corner-preserving curve smoothing on detected region
   * boundaries. Default true -- sharp corners are always preserved either
   * way; only set false to see the raw simplified-polygon boundary. */
  smoothCurves?: boolean;
  /** FILL row spacing, or CROSS_STITCH grid cell size, in mm. Omit to use
   * the backend's own style-appropriate default (0.4mm fill / 1.8mm
   * cross). */
  densityMm?: number;
  /** Target stitch length along a row, in mm. Default 3.0. */
  stitchLengthMm?: number;
  /** Width (in mm) of the satin edge-walk border traced around every
   * FILL/CROSS_STITCH region's outline and holes, on top of the fill --
   * see stitchpro-backend's digitizer/stitches/satin/border.py. Omit to
   * use the backend's own style-appropriate default (1.2mm for Fill, off
   * for Cross-Stitch); pass 0 to disable it even for Fill. See
   * `resolveBorderWidthMm` in services/digitizing/index.ts for the single
   * place that maps the wizard's border UI choice to this value. */
  borderWidthMm?: number;
  /** Whether to remove the detected background/surrounding material before
   * digitizing (default true, matching the backend's own default). Set to
   * `false` only once the user has explicitly chosen "keep original" on
   * the background-removal preview step (see
   * `removeBackgroundPreviewViaBackend` above) -- the server recomputes
   * the identical mask, so this stays consistent with what they saw. */
  removeBackground?: boolean;
}

/** Converts a `Blob` into a `data:` URI -- works identically on web and
 * native (React Native's `FileReader`/`Blob` polyfills support exactly
 * this), unlike `URL.createObjectURL`, which isn't reliably available on
 * native. Used so the background-removal preview PNG below can be handed
 * straight to `<Image source={{ uri }}>` on any platform. */
function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Asks the real backend to run just its background/surrounding-material
 * detection (stitchpro-backend's `POST /api/design/remove-background`) on
 * `imageUri` and returns a displayable `data:` URI with the detected
 * background made transparent -- no quantizing, segmentation, or stitch
 * generation, so this is cheap and safe to call right after a user
 * uploads/picks an image, well before they've configured anything else.
 *
 * This is the first half of the "show the user what will be removed and
 * require an explicit choice before continuing, never silently apply it"
 * flow (see create/auto-digitize/background-removal.tsx): callers should
 * show the result next to the original and let the user pick one, then
 * pass that choice as `removeBackground` to `analyzeImageViaBackend`
 * below (and ultimately to the export endpoints) -- the server recomputes
 * the identical mask rather than needing this preview PNG re-uploaded.
 *
 * Returns `null` on any failure (backend disabled/unreachable/timeout/
 * error, or an unreadable image) -- callers should treat that as "no
 * preview available" and let the user continue with the original image
 * untouched rather than blocking the wizard on it.
 */
export async function removeBackgroundPreviewViaBackend(
  imageUri: string,
  maxDim?: number
): Promise<string | null> {
  const baseUrl = getBackendUrl();
  if (!baseUrl || !imageUri) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);

  try {
    const imageResponse = await fetch(imageUri);
    if (!imageResponse.ok) return null;
    const blob = await imageResponse.blob();

    const form = new FormData();
    form.append('image', blob as any, 'artwork.png');
    if (maxDim !== undefined) form.append('max_dim', String(maxDim));

    const response = await fetch(`${baseUrl}/api/design/remove-background`, {
      method: 'POST',
      body: form as any,
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const pngBlob = await response.blob();
    return await blobToDataUri(pngBlob);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function analyzeImageViaBackend(
  imageUri: string,
  widthMm: number,
  heightMm: number,
  options: AnalyzeImageOptions = {}
): Promise<BackendPointsResult | null> {
  const baseUrl = getBackendUrl();
  if (!baseUrl || !imageUri) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);

  try {
    const imageResponse = await fetch(imageUri);
    if (!imageResponse.ok) return null;
    const blob = await imageResponse.blob();

    const form = new FormData();
    // `as any`: React Native's FormData/Blob typings don't perfectly match
    // the DOM lib's, but this is the standard RN pattern for multipart
    // image uploads and works identically on web.
    form.append('image', blob as any, 'artwork.png');
    form.append('width_mm', String(widthMm));
    form.append('height_mm', String(heightMm));
    form.append('max_colors', String(options.maxColors ?? 6));
    if (options.stitchStyle) form.append('stitch_style', options.stitchStyle);
    if (options.angleDeg !== undefined) form.append('angle_deg', String(options.angleDeg));
    if (options.smoothCurves !== undefined) form.append('smooth_curves', String(options.smoothCurves));
    if (options.densityMm !== undefined) form.append('density_mm', String(options.densityMm));
    if (options.stitchLengthMm !== undefined) form.append('stitch_length_mm', String(options.stitchLengthMm));
    if (options.borderWidthMm !== undefined) form.append('border_width_mm', String(options.borderWidthMm));
    if (options.removeBackground !== undefined) form.append('remove_background', String(options.removeBackground));

    const response = await fetch(`${baseUrl}/api/design/image-to-points`, {
      method: 'POST',
      body: form as any,
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!Array.isArray(data.points) || !data.points.length) return null;

    return {
      widthMm: data.width_mm,
      heightMm: data.height_mm,
      threads: data.threads ?? [],
      points: data.points,
      stitchTypeBreakdown: Array.isArray(data.stitchTypeBreakdown) ? data.stitchTypeBreakdown : [],
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

const TEXT_FETCH_TIMEOUT_MS = 8000;

export interface AnalyzeTextOptions {
  /** Cap height in mm (matches how embroidery lettering is normally
   * quoted, e.g. "1 inch letters"). */
  sizeMm: number;
  /** Hex thread color for every letter (lettering is always single-color
   * -- see stitchpro-backend's digitizer/lettering/engine.py). */
  color: string;
  /** Only "straight" is supported by the dedicated lettering engine so
   * far -- see that module's docstring for why "Arc Up"/"Arc Down" aren't
   * wired here yet. */
  layout?: 'straight';
  /** FILL/SATIN crossing spacing in mm, reusing the same live density
   * slider every other design type already has. Omit for the engine's
   * own default. */
  densityMm?: number;
}

/**
 * Asks the real backend's dedicated lettering engine
 * (stitchpro-backend's digitizer/lettering) to build `text` as real
 * satin-column letterforms and returns the result as the same `DstPoint`-
 * shaped point-stream contract `analyzeImageViaBackend` above returns --
 * so every existing point-based renderer/converter (EmbossedStitchCanvas,
 * stitchPlanner summaries, the final DST/PES/etc export) keeps working
 * completely unmodified, whether the design came from an image or typed
 * text.
 *
 * Unlike the generic image pipeline, there's no client-side fallback for
 * this -- lettering with correct satin columns genuinely requires the
 * backend's glyph alphabet, there's no equivalent browser-canvas
 * approximation worth building. Returns `null` on any failure (backend
 * disabled/unreachable/timeout, or a character outside the dedicated
 * alphabet) -- callers should fall back to the older render-text-to-image
 * + generic-auto-digitize path in that case (see create/text.tsx).
 */
export async function textToPointsViaBackend(
  text: string,
  options: AnalyzeTextOptions
): Promise<BackendPointsResult | null> {
  const baseUrl = getBackendUrl();
  if (!baseUrl || !text.trim()) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TEXT_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/api/design/text-to-points`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        size_mm: options.sizeMm,
        color: options.color,
        layout: options.layout ?? 'straight',
        ...(options.densityMm !== undefined ? { density_mm: options.densityMm } : {}),
      }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (!Array.isArray(data.points) || !data.points.length) return null;

    return {
      widthMm: data.width_mm,
      heightMm: data.height_mm,
      threads: data.threads ?? [],
      points: data.points,
      stitchTypeBreakdown: Array.isArray(data.stitchTypeBreakdown) ? data.stitchTypeBreakdown : [],
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Same dedicated lettering engine as `textToPointsViaBackend`, but asks
 * the backend to encode the result directly as a real downloadable file
 * (`POST /api/design/text-to-file`) -- mirrors `exportViaBackend`'s shape
 * for the generic point-stream path. Returns `null` on any failure.
 */
export async function textToFileViaBackend(
  text: string,
  options: AnalyzeTextOptions,
  format: BackendFormat,
  name: string
): Promise<Blob | null> {
  const baseUrl = getBackendUrl();
  if (!baseUrl || !text.trim()) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TEXT_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}/api/design/text-to-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        size_mm: options.sizeMm,
        color: options.color,
        layout: options.layout ?? 'straight',
        ...(options.densityMm !== undefined ? { density_mm: options.densityMm } : {}),
        format,
        name: name.replace(/[^A-Za-z0-9-_]/g, '').slice(0, 32) || 'text-design',
      }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return await response.blob();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

