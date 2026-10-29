import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { analyzeImageViaBackend, regionsToPointsViaBackend } from '@/services/digitizing/backendClient';
import { analyzeImage, buildStitchSegments, resolveImageUri } from '@/utils/stitchEngine';
import { gridSegmentsToMm, pointsToMmSegments, type MmSegment } from '@/utils/stitchPreview';
import type { DstPoint } from '@/utils/dstWriter';
import type { DesignRegionCrop, StitchTypeBreakdownEntry, VectorRegion } from '@/services/digitizing/backendClient';

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
  /** The raw `DstPoint[]` stream behind `segments`, only ever populated on
   * `source === 'backend'` (the client-canvas fallback has no equivalent
   * physical-unit point stream to offer). Exists so a caller that needs
   * the exact same real stitch plan for more than just rendering -- stats,
   * `.dst`/`.pes`/etc export -- can reuse this one backend call instead of
   * re-fetching/re-digitizing the same image again for that (see
   * create/auto-digitize/preview.tsx's live density slider, the first
   * caller that needed this). */
  dstPoints: DstPoint[] | null;
  /** Which stitch types the current plan actually uses and how much of it
   * is each (SATIN for thin strokes, FILL for larger areas, etc.), only
   * ever populated on `source === 'backend'` -- see
   * `StitchTypeBreakdownEntry`'s own docstring. Empty on the client-canvas
   * fallback, which has no per-region type classification to offer. */
  stitchTypeBreakdown: StitchTypeBreakdownEntry[];
}

const EMPTY: Omit<StitchPreviewResult, 'loading' | 'source'> = {
  segments: [],
  palette: [],
  widthMm: 0,
  heightMm: 0,
  dstPoints: null,
  stitchTypeBreakdown: [],
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
 *
 * `densityMm`/`stitchLengthMm`/`borderWidthMm` are optional passthroughs to
 * the backend's own style-appropriate defaults when omitted (see
 * `AnalyzeImageOptions` in backendClient.ts) -- pass them when a caller
 * wants a specific density rather than the backend's default (e.g. a live
 * density slider re-triggering this hook's effect every time its debounced
 * value settles).
 */
export function useStitchPreview(
  source: any,
  widthMm: number,
  heightMm: number,
  maxColors = 6,
  stitchStyle?: 'fill' | 'cross',
  angleDeg?: number,
  removeBackground?: boolean,
  densityMm?: number,
  stitchLengthMm?: number,
  borderWidthMm?: number,
  /** When given (non-empty), this is a design the user already ran through
   * the editable-vector pipeline (create/auto-digitize/vectorize.tsx) and
   * possibly edited (selected/deleted/redrawn regions) -- skip the raw-
   * image analysis entirely and build the design straight from these
   * regions instead, so the preview (and the final digitized design)
   * reflects the user's edits, not a fresh re-trace of the original
   * image. See `regionsToPointsViaBackend`. */
  regions?: VectorRegion[] | null,
  /** See `AnalyzeImageOptions.forcePhoto` -- only affects the raw-image
   * `analyzeImageViaBackend` fallback branch below (when `regions` isn't
   * set yet, e.g. the vectorize screen was skipped or unreachable);
   * `regionsToPointsViaBackend` doesn't re-classify, so this has no effect
   * once real regions exist. Pass `true` for the "Photo of Embroidery"
   * entry point (create/index.tsx), same as every other backend call in
   * that wizard. */
  forcePhoto?: boolean,
  /** See `AnalyzeImageOptions.crop` -- only affects the raw-image
   * `analyzeImageViaBackend` fallback branch below, same reasoning as
   * `forcePhoto` above: once real `regions` exist they were already
   * traced from the cropped sub-image (see create/auto-digitize/
   * vectorize.tsx), so this has no further effect in that case. */
  crop?: DesignRegionCrop | null
): StitchPreviewResult {
  const uri = resolveImageUri(source);
  const hasRegions = !!(regions && regions.length);
  const [state, setState] = useState<StitchPreviewResult>({ ...EMPTY, loading: !!uri || hasRegions, source: 'none' });

  useEffect(() => {
    if (!uri && !hasRegions) return undefined;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicking off the async analysis below
    setState((s) => ({ ...s, loading: true }));

    (async () => {
      const backendResult = hasRegions
        ? await regionsToPointsViaBackend(regions as VectorRegion[], widthMm, heightMm, {
            stitchStyle,
            angleDeg,
            densityMm,
            stitchLengthMm,
            borderWidthMm,
          })
        : await analyzeImageViaBackend(uri, widthMm, heightMm, {
            maxColors,
            stitchStyle,
            angleDeg,
            removeBackground,
            densityMm,
            stitchLengthMm,
            borderWidthMm,
            forcePhoto,
            crop,
          });

      if (cancelled) return;
      if (backendResult) {
        setState({
          segments: pointsToMmSegments(backendResult.points, backendResult.widthMm, backendResult.heightMm),
          palette: backendResult.threads,
          widthMm: backendResult.widthMm,
          heightMm: backendResult.heightMm,
          loading: false,
          source: 'backend',
          dstPoints: backendResult.points,
          stitchTypeBreakdown: backendResult.stitchTypeBreakdown,
        });
        return;
      }

      // A regions-based design has no raw pixels for the client-only
      // fallback below to analyze (and falling back to one would silently
      // discard whatever the user edited on the vectorize/region-editor
      // screen) -- end at `source: 'none'` instead, same as native with no
      // reachable backend.
      if (hasRegions) {
        if (!cancelled) setState({ ...EMPTY, loading: false, source: 'none' });
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
          dstPoints: null,
          stitchTypeBreakdown: [],
        });
      } catch {
        if (!cancelled) setState({ ...EMPTY, loading: false, source: 'none' });
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    uri,
    widthMm,
    heightMm,
    maxColors,
    stitchStyle,
    angleDeg,
    removeBackground,
    densityMm,
    stitchLengthMm,
    borderWidthMm,
    regions,
    forcePhoto,
    crop,
  ]);

  if (!uri && !hasRegions) {
    return { ...EMPTY, loading: false, source: 'none' };
  }
  return state;
}

