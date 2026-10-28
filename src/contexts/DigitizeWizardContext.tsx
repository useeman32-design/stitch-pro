import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  defaultDigitizeSettings,
  densityPercentToBucket,
  type AnalysisResult,
  type DigitizeSettings,
  type StitchPlanSummary,
} from '@/services/digitizing';
import type { DstPoint } from '@/utils/dstWriter';

export interface UploadedArtwork {
  uri: string;
  name: string;
  source: 'upload' | 'sample' | 'generated';
}

interface DigitizeWizardValue {
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
  const [artwork, setArtworkState] = useState<UploadedArtwork | null>(null);
  const [analysis, setAnalysisState] = useState<AnalysisResult | null>(null);
  const [settings, setSettings] = useState<DigitizeSettings>(defaultDigitizeSettings);
  const [threadColors, setThreadColorsState] = useState<string[]>([]);
  const [removeBackground, setRemoveBackgroundState] = useState(true);
  const [stitchPlan, setStitchPlanState] = useState<StitchPlanSummary | null>(null);
  const [dstPoints, setDstPointsState] = useState<DstPoint[] | null>(null);
  const [letterMeta, setLetterMetaState] = useState<{ text: string; color: string } | null>(null);

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
    setArtworkState(null);
    setAnalysisState(null);
    setSettings(defaultDigitizeSettings);
    setThreadColorsState([]);
    setStitchPlanState(null);
    setDstPointsState(null);
    setRemoveBackgroundState(true);
    setLetterMetaState(null);
  }, []);

  const value = useMemo(
    () => ({
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
      setArtwork: setArtworkState,
      clearArtwork: () => {
        setArtworkState(null);
        setLetterMetaState(null);
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
      artwork,
      analysis,
      settings,
      threadColors,
      stitchPlan,
      dstPoints,
      removeBackground,
      letterMeta,
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
