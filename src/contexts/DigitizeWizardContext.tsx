import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  defaultDigitizeSettings,
  densityPercentToBucket,
  type AnalysisResult,
  type DigitizeSettings,
  type StitchPlanSummary,
} from '@/services/digitizing';
import type { DstPoint } from '@/utils/dstWriter';
import type { BgStroke, DesignRegionCrop, VectorRegion } from '@/services/digitizing/backendClient';

export interface UploadedArtwork {
  uri: string;
  name: string;
  source: 'upload' | 'sample' | 'generated';
}

/** Which Auto Digitize upload entry point the user came from -- both go
 * through the exact same wizard screens/backend pipeline, but
 * `'embroidered_photo'` (the "Photo of Embroidery" card on
 * create/index.tsx, for "extract a design from a photo of an item that's
 * already stitched") tailors the upload screen's copy for that case and
 * sets `forcePhoto: true` on every backend classify/vectorize call, so a
 * sharply-lit close-up photo can't accidentally get misclassified as
 * flat clipart and skip the artworkify flattening it actually needs --
 * see backendClient.ts's `AnalyzeImageOptions.forcePhoto`. `'artwork'`
 * (the default, from the regular "Auto Digitize" card) keeps relying on
 * the automatic classifier, unchanged. */
export type DigitizeSourceMode = 'artwork' | 'embroidered_photo';

interface DigitizeWizardValue {
  /** See `DigitizeSourceMode`. Defaults to `'artwork'`. */
  sourceMode: DigitizeSourceMode;
  setSourceMode: (mode: DigitizeSourceMode) => void;
  artwork: UploadedArtwork | null;
  analysis: AnalysisResult | null;
  settings: DigitizeSettings;
  /** Editable thread palette — starts from analysis but the user can add/remove/replace. */
  threadColors: string[];
  stitchPlan: StitchPlanSummary | null;
  /** Real, physical stitch sequence (0.1mm units) behind `stitchPlan`'s stats — the exact same points a real .dst export encodes, kept here so download doesn't need to regenerate/re-analyze. */
  dstPoints: DstPoint[] | null;
  /** Whether to remove the detected background/surrounding material before
   * digitizing -- set explicitly by the user on the background-removal
   * preview step (create/auto-digitize/background-removal.tsx), never
   * silently defaulted without them seeing the result first. Defaults to
   * `true` (matching the backend's own default) only because that step
   * hasn't necessarily run yet when this is first read; it's always
   * overwritten with the user's actual choice before the real digitize
   * call fires. */
  removeBackground: boolean;
  setRemoveBackground: (value: boolean) => void;
  /** Set only when this design came from create/text.tsx AND the typed
   * text/font/layout combination is fully supported by the backend's
   * dedicated lettering engine (digitizer/lettering) -- see that
   * screen's `isLetteringEligible` check. When present, the rest of the
   * wizard (analyzing/preview/success) uses the real satin-column
   * lettering engine instead of the generic image-based auto-digitizer
   * for every re-digitize call, so curved letters (O/S/C/G/...) come out
   * as clean satin columns instead of whatever the generic per-region
   * classifier would land on for a rasterized text image. `null` for
   * every other design (image upload, monogram, unsupported text/font/
   * layout combination), which keeps the existing image-based path
   * completely unchanged. */
  letterMeta: { text: string; color: string } | null;
  setLetterMeta: (meta: { text: string; color: string } | null) => void;
  /** Real, editable vector regions the user confirmed on
   * create/auto-digitize/vectorize.tsx -- traced from their chosen
   * background-removal image, then possibly selected/deleted/redrawn by
   * hand. `null` until that screen runs (or when it's skipped because the
   * backend was unreachable); every downstream digitize/preview call
   * prefers this over re-tracing the raw image whenever it's set, so the
   * user's region edits are what actually gets stitched, not a fresh
   * re-trace of the original artwork. See `useStitchPreview`'s `regions`
   * param and `regionsToPointsViaBackend`. */
  vectorRegions: VectorRegion[] | null;
  /** The mm canvas size `vectorRegions` was traced/edited at -- needed to
   * correctly rescale those regions if the user later picks a different
   * design size on the Settings screen (see `rescaleVectorRegions`). */
  vectorRegionsSizeMm: { width: number; height: number } | null;
  setVectorRegions: (regions: VectorRegion[] | null, sizeMm?: { width: number; height: number }) => void;
  /** Manual background-mask correction brush strokes recorded on the
   * vectorize screen (adjustable-size restore/erase brush) -- kept here
   * so navigating back to that screen (or re-running vectorization after
   * a settings change) doesn't lose them. */
  bgStrokes: BgStroke[];
  setBgStrokes: (strokes: BgStroke[]) => void;
  /** The crop box the user confirmed/adjusted on create/auto-digitize/
   * design-region.tsx -- the "extract only the design from a photo of
   * someone wearing the garment" requirement. `null` means "use the full
   * image" (either the detector found nothing worth cropping, the upload
   * was flat artwork that step skipped itself for, or the user explicitly
   * chose not to crop). Threaded into every backend call that accepts a
   * `crop` field (vectorize, and the raw image-to-points/image-to-file
   * fallback path) so a vectorize outage doesn't silently re-digitize the
   * whole uncropped photo instead of respecting this choice. */
  designRegionCrop: DesignRegionCrop | null;
  setDesignRegionCrop: (crop: DesignRegionCrop | null) => void;
  setArtwork: (artwork: UploadedArtwork) => void;
  clearArtwork: () => void;
  setAnalysis: (analysis: AnalysisResult) => void;
  updateSettings: (partial: Partial<DigitizeSettings>) => void;
  setThreadColors: (colors: string[]) => void;
  addThreadColor: (hex: string) => void;
  removeThreadColor: (index: number) => void;
  replaceThreadColor: (index: number, hex: string) => void;
  setStitchPlan: (plan: StitchPlanSummary) => void;
  setDstPoints: (points: DstPoint[]) => void;
  reset: () => void;
}

const DigitizeWizardContext = createContext<DigitizeWizardValue | undefined>(undefined);

export function DigitizeWizardProvider({ children }: { children: React.ReactNode }) {
  const [sourceMode, setSourceModeState] = useState<DigitizeSourceMode>('artwork');
  const [artwork, setArtworkState] = useState<UploadedArtwork | null>(null);
  const [analysis, setAnalysisState] = useState<AnalysisResult | null>(null);
  const [settings, setSettings] = useState<DigitizeSettings>(defaultDigitizeSettings);
  const [threadColors, setThreadColorsState] = useState<string[]>([]);
  const [removeBackground, setRemoveBackgroundState] = useState(true);
  const [stitchPlan, setStitchPlanState] = useState<StitchPlanSummary | null>(null);
  const [dstPoints, setDstPointsState] = useState<DstPoint[] | null>(null);
  const [letterMeta, setLetterMetaState] = useState<{ text: string; color: string } | null>(null);
  const [vectorRegions, setVectorRegionsState] = useState<VectorRegion[] | null>(null);
  const [vectorRegionsSizeMm, setVectorRegionsSizeMmState] = useState<{ width: number; height: number } | null>(null);
  const [bgStrokes, setBgStrokesState] = useState<BgStroke[]>([]);
  const [designRegionCrop, setDesignRegionCropState] = useState<DesignRegionCrop | null>(null);

  const setVectorRegions = useCallback(
    (regions: VectorRegion[] | null, sizeMm?: { width: number; height: number }) => {
      setVectorRegionsState(regions);
      setVectorRegionsSizeMmState(regions && sizeMm ? sizeMm : null);
    },
    []
  );

  const updateSettings = useCallback((partial: Partial<DigitizeSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      if (partial.densityPercent !== undefined) {
        next.density = densityPercentToBucket(partial.densityPercent);
      }
      return next;
    });
  }, []);

  const setAnalysis = useCallback((result: AnalysisResult) => {
    setAnalysisState(result);
    setThreadColorsState(result.dominantColors);
  }, []);

  const addThreadColor = useCallback((hex: string) => {
    setThreadColorsState((prev) => [...prev, hex]);
  }, []);

  const removeThreadColor = useCallback((index: number) => {
    setThreadColorsState((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const replaceThreadColor = useCallback((index: number, hex: string) => {
    setThreadColorsState((prev) => prev.map((c, i) => (i === index ? hex : c)));
  }, []);

  const reset = useCallback(() => {
    setSourceModeState('artwork');
    setArtworkState(null);
    setAnalysisState(null);
    setSettings(defaultDigitizeSettings);
    setThreadColorsState([]);
    setStitchPlanState(null);
    setDstPointsState(null);
    setRemoveBackgroundState(true);
    setLetterMetaState(null);
    setVectorRegionsState(null);
    setVectorRegionsSizeMmState(null);
    setBgStrokesState([]);
    setDesignRegionCropState(null);
  }, []);

  const value = useMemo(
    () => ({
      sourceMode,
      setSourceMode: setSourceModeState,
      artwork,
      analysis,
      settings,
      threadColors,
      stitchPlan,
      dstPoints,
      removeBackground,
      setRemoveBackground: setRemoveBackgroundState,
      letterMeta,
      setLetterMeta: setLetterMetaState,
      vectorRegions,
      vectorRegionsSizeMm,
      setVectorRegions,
      bgStrokes,
      setBgStrokes: setBgStrokesState,
      designRegionCrop,
      setDesignRegionCrop: setDesignRegionCropState,
      setArtwork: setArtworkState,
      clearArtwork: () => {
        setArtworkState(null);
        setLetterMetaState(null);
        setVectorRegionsState(null);
        setVectorRegionsSizeMmState(null);
        setBgStrokesState([]);
        setDesignRegionCropState(null);
      },
      setAnalysis,
      updateSettings,
      setThreadColors: setThreadColorsState,
      addThreadColor,
      removeThreadColor,
      replaceThreadColor,
      setStitchPlan: setStitchPlanState,
      setDstPoints: setDstPointsState,
      reset,
    }),
    [
      sourceMode,
      artwork,
      analysis,
      settings,
      threadColors,
      stitchPlan,
      dstPoints,
      removeBackground,
      letterMeta,
      vectorRegions,
      vectorRegionsSizeMm,
      setVectorRegions,
      bgStrokes,
      designRegionCrop,
      setAnalysis,
      updateSettings,
      addThreadColor,
      removeThreadColor,
      replaceThreadColor,
      reset,
    ]
  );

  return <DigitizeWizardContext.Provider value={value}>{children}</DigitizeWizardContext.Provider>;
}

export function useDigitizeWizard(): DigitizeWizardValue {
  const ctx = useContext(DigitizeWizardContext);
  if (!ctx) {
    throw new Error('useDigitizeWizard must be used within DigitizeWizardProvider');
  }
  return ctx;
}
