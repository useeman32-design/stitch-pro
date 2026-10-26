/**
 * Shared "export a real stitch file and trigger a browser download" logic.
 * Originally lived only inside the Auto-Digitize success screen; factored
 * out so My Designs' Download action can do the exact same real export
 * (backend pyembroidery encode, DST client-side fallback) instead of the
 * placeholder toast it used to show.
 */
import { buildDstFile, type DstPoint } from './dstWriter';
import { exportViaBackend, type BackendFormat } from '@/services/digitizing/backendClient';
import type { StitchFormat } from '@/services/types';

// Formats the real backend (pyembroidery) can encode. HUS has no
// pyembroidery writer yet, so it stays unavailable either way.
const BACKEND_FORMATS: Partial<Record<StitchFormat, BackendFormat>> = {
  DST: 'dst',
  PES: 'pes',
  JEF: 'jef',
  EXP: 'exp',
  VP3: 'vp3',
};

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export type DownloadStitchFileResult =
  | { ok: true; filename: string }
  | { ok: false; reason: 'no-points' | 'unsupported-format' | 'backend-unreachable' | 'write-failed' };

/**
 * Exports `points`/`threadColors` as a real machine-readable file and
 * triggers a browser download. Tries the real backend (pyembroidery) first
 * for every format it can encode (including DST, where it's also a more
 * authoritative encoder); falls back to the pure client-side DST writer
 * only when the backend is unreachable/unconfigured and the requested
 * format is DST.
 */
export async function downloadStitchFile(
  points: DstPoint[],
  threadColors: string[],
  format: StitchFormat,
  baseName: string
): Promise<DownloadStitchFileResult> {
  if (!points.length) return { ok: false, reason: 'no-points' };

  const backendFormat = BACKEND_FORMATS[format];
  if (backendFormat) {
    const blob = await exportViaBackend(points, threadColors, backendFormat, baseName);
    if (blob) {
      const filename = `${baseName}.${backendFormat}`;
      triggerBlobDownload(blob, filename);
      return { ok: true, filename };
    }
  }

  if (format !== 'DST') {
    return { ok: false, reason: backendFormat ? 'backend-unreachable' : 'unsupported-format' };
  }

  try {
    const bytes = buildDstFile(points, { name: baseName.replace(/[^A-Za-z0-9]/g, '').slice(0, 16) || 'STITCHPRO' });
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/octet-stream' });
    const filename = `${baseName}.dst`;
    triggerBlobDownload(blob, filename);
    return { ok: true, filename };
  } catch {
    return { ok: false, reason: 'write-failed' };
  }
}
