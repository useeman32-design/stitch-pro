import { useEffect, useState } from 'react';
import { textToPointsViaBackend } from '@/services/digitizing/backendClient';
import { pointsToMmSegments } from '@/utils/stitchPreview';
import type { StitchPreviewResult } from '@/hooks/useStitchPreview';

const EMPTY: Omit<StitchPreviewResult, 'loading' | 'source'> = {
  segments: [],
  palette: [],
  widthMm: 0,
  heightMm: 0,
  dstPoints: null,
  stitchTypeBreakdown: [],
};

/**
 * Real satin-column text preview, via stitchpro-backend's dedicated
 * lettering engine (digitizer/lettering -- see its module docstrings for
 * why this is a separate path from the generic auto-digitizer every other
 * design type uses). Returns the exact same `StitchPreviewResult` shape
 * `useStitchPreview` does, so any screen built against that hook already
 * knows how to render/consume this one too (EmbossedStitchCanvas, the
 * live density slider, the final dstPoints export) -- see
 * create/text.tsx for the live-typing preview and
 * create/auto-digitize/preview.tsx for the full-wizard usage.
 *
 * Unlike `useStitchPreview`, there is deliberately no client-side
 * fallback: `source` only ever resolves to `'backend'` or `'none'`.
 * Lettering with correct satin columns genuinely requires the backend's
 * glyph alphabet (digitizer/lettering/alphabet_block.py); a caller should
 * treat `'none'` as "fall back to the older render-text-to-image +
 * generic-auto-digitize path for this text" rather than a dead end.
 *
 * `text === null` (or empty/unsupported) disables the hook entirely,
 * resolving to `source: 'none'` with no network call -- callers decide
 * eligibility (font style + layout + non-empty text) before passing a
 * value in.
 */
export function useLetteringPreview(
  text: string | null,
  sizeMm: number,
  color: string,
  densityMm?: number
): StitchPreviewResult {
  const [state, setState] = useState<StitchPreviewResult>({ ...EMPTY, loading: !!text, source: 'none' });

  useEffect(() => {
    if (!text || !text.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting to the disabled/empty state, not kicking off an async chain
      setState({ ...EMPTY, loading: false, source: 'none' });
      return undefined;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));

    (async () => {
      const result = await textToPointsViaBackend(text, { sizeMm, color, densityMm });
      if (cancelled) return;
      if (result) {
        setState({
          segments: pointsToMmSegments(result.points, result.widthMm, result.heightMm),
          palette: result.threads,
          widthMm: result.widthMm,
          heightMm: result.heightMm,
          loading: false,
          source: 'backend',
          dstPoints: result.points,
          stitchTypeBreakdown: result.stitchTypeBreakdown,
        });
      } else {
        setState({ ...EMPTY, loading: false, source: 'none' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [text, sizeMm, color, densityMm]);

  return state;
}
