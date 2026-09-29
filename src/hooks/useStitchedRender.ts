import { useEffect, useState } from 'react';
import { renderStitchedPreview } from '@/utils/stitchEngine';
import type { StitchDensity } from '@/services/digitizing';

interface StitchedRenderState {
  uri: string | null;
  loading: boolean;
  error: boolean;
}

/**
 * Produces a genuinely different, embroidery-styled render of the artwork:
 * recolored to the exact thread palette, with a stitch-direction texture
 * and thread sheen baked in via canvas — not just the raw uploaded photo.
 */
export function useStitchedRender(
  source: { uri: string } | null,
  palette: string[],
  density: StitchDensity
): StitchedRenderState {
  const hasInput = !!source && palette.length > 0;
  const [state, setState] = useState<StitchedRenderState>({ uri: null, loading: hasInput, error: false });

  useEffect(() => {
    if (!source || !palette.length) return undefined;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicking off the async render below
    setState((s) => ({ ...s, loading: true, error: false }));
    renderStitchedPreview(source, palette, density)
      .then((dataUrl) => {
        if (!cancelled) setState({ uri: dataUrl, loading: false, error: false });
      })
      .catch(() => {
        if (!cancelled) setState({ uri: null, loading: false, error: true });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source?.uri, palette.join(','), density]);

  if (!source || !palette.length) {
    return { uri: null, loading: false, error: false };
  }
  return state;
}
