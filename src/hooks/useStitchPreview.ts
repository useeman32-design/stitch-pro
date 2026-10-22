import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { analyzeImageViaBackend } from '@/services/digitizing/backendClient';
import { analyzeImage, buildStitchSegments, resolveImageUri } from '@/utils/stitchEngine';
import { gridSegmentsToMm, pointsToMmSegments, type MmSegment } from '@/utils/stitchPreview';

export type StitchPreviewSource = 'backend' | 'client' | 'none';

export interface StitchPreviewResult {
  segments: MmSegment[];
  palette: string[];
  widthMm: number;
  heightMm: number;
  loading: boolean;
  /** Where the rendered plan actually came from -- lets the UI show e.g. a
   * "couldn't reach the digitizing backend" hint instead of a silent blank
   * canvas, without ever blocking the preview on backend availability. */
  source: StitchPreviewSource;
}

const EMPTY: Omit<StitchPreviewResult, 'loading' | 'source'> = {
  segments: [],
  palette: [],
  widthMm: 0,
  heightMm: 0,
};

/**
 * Cross-platform stitch-preview data: tries the real stitchpro-backend
 * digitizing endpoint first (works identically on native and web, and
 * gives Milestone-5-quality segmentation -- real holes, fill, color
 * regions), and only falls back to the legacy browser-canvas-only pixel
 * scan (stitchEngine.ts) on web when the backend is unreachable or
 * disabled. On native with no backend configured/reachable, resolves to
 * `source: 'none'` with empty segments rather than hanging or crashing --
 * callers should show a friendly explanation in that case (see
 * simulator.tsx), not treat it as a bug.
 */
export function useStitchPreview(
  source: any,
  widthMm: number,
  heightMm: number,
  maxColors = 6,
  stitchStyle?: 'fill' | 'cross',
  angleDeg?: number
): StitchPreviewResult {
  const uri = resolveImageUri(source);
  const [state, setState] = useState<StitchPreviewResult>({ ...EMPTY, loading: !!uri, source: 'none' });

  useEffect(() => {
    if (!uri) return undefined;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicking off the async analysis below
    setState((s) => ({ ...s, loading: true }));

    (async () => {
      const backendResult = await analyzeImageViaBackend(uri, widthMm, heightMm, { maxColors, stitchStyle, angleDeg });

      if (cancelled) return;
      if (backendResult) {
        setState({
          segments: pointsToMmSegments(backendResult.points, backendResult.widthMm, backendResult.heightMm),
          palette: backendResult.threads,
          widthMm: backendResult.widthMm,
          heightMm: backendResult.heightMm,
          loading: false,
          source: 'backend',
        });
        return;
      }

      // Fall back to the browser-only client analysis -- impossible on
      // native (stitchEngine.ts hard-requires a DOM canvas), so native with
      // no reachable backend correctly ends up at `source: 'none'`.
      if (Platform.OS !== 'web') {
        if (!cancelled) setState({ ...EMPTY, loading: false, source: 'none' });
        return;
      }

      try {
        const analysis = await analyzeImage(source, maxColors);
        const { segments, size } = await buildStitchSegments(source, analysis.colors, 72);
        if (cancelled) return;
        setState({
          segments: gridSegmentsToMm(segments, size, widthMm, heightMm),
          palette: analysis.colors,
          widthMm,
          heightMm,
          loading: false,
          source: 'client',
        });
      } catch {
        if (!cancelled) setState({ ...EMPTY, loading: false, source: 'none' });
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uri, widthMm, heightMm, maxColors, stitchStyle, angleDeg]);

  if (!uri) {
    return { ...EMPTY, loading: false, source: 'none' };
  }
  return state;
}
