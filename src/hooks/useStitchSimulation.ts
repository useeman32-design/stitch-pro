import { useEffect, useState } from 'react';
import { analyzeImage, buildStitchSegments, resolveImageUri, type StitchSegment } from '@/utils/stitchEngine';

interface SimResult {
  segments: StitchSegment[];
  palette: string[];
  gridSize: number;
  loading: boolean;
}

/**
 * Generates a real, per-design stitch path (not a canned animation): it
 * analyzes the actual thumbnail's colors, then scans the posterized image
 * for same-color runs to produce vector segments a "needle" can trace.
 */
export function useStitchSimulation(source: any, maxColors: number): SimResult {
  const uri = resolveImageUri(source);
  const [state, setState] = useState<SimResult>({ segments: [], palette: [], gridSize: 72, loading: !!uri });

  useEffect(() => {
    if (!uri) return undefined;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicking off the async analysis below
    setState((s) => ({ ...s, loading: true }));
    (async () => {
      try {
        const analysis = await analyzeImage(source, maxColors);
        const { segments, size } = await buildStitchSegments(source, analysis.colors, 72);
        if (!cancelled) setState({ segments, palette: analysis.colors, gridSize: size, loading: false });
      } catch {
        if (!cancelled) setState({ segments: [], palette: [], gridSize: 72, loading: false });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri, maxColors]);

  if (!uri) {
    return { segments: [], palette: [], gridSize: 72, loading: false };
  }
  return state;
}
