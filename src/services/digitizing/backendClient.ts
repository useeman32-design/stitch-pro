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
