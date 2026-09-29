import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  defaultDigitizeSettings,
  densityPercentToBucket,
  type AnalysisResult,
  type DigitizeSettings,
  type StitchPlanSummary,
} from '@/services/digitizing';

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
  setArtwork: (artwork: UploadedArtwork) => void;
  clearArtwork: () => void;
  setAnalysis: (analysis: AnalysisResult) => void;
  updateSettings: (partial: Partial<DigitizeSettings>) => void;
  setThreadColors: (colors: string[]) => void;
  addThreadColor: (hex: string) => void;
  removeThreadColor: (index: number) => void;
  replaceThreadColor: (index: number, hex: string) => void;
  setStitchPlan: (plan: StitchPlanSummary) => void;
  reset: () => void;
}

const DigitizeWizardContext = createContext<DigitizeWizardValue | undefined>(undefined);

export function DigitizeWizardProvider({ children }: { children: React.ReactNode }) {
  const [artwork, setArtworkState] = useState<UploadedArtwork | null>(null);
  const [analysis, setAnalysisState] = useState<AnalysisResult | null>(null);
  const [settings, setSettings] = useState<DigitizeSettings>(defaultDigitizeSettings);
  const [threadColors, setThreadColorsState] = useState<string[]>([]);
  const [stitchPlan, setStitchPlanState] = useState<StitchPlanSummary | null>(null);

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
  }, []);

  const value = useMemo(
    () => ({
      artwork,
      analysis,
      settings,
      threadColors,
      stitchPlan,
      setArtwork: setArtworkState,
      clearArtwork: () => setArtworkState(null),
      setAnalysis,
      updateSettings,
      setThreadColors: setThreadColorsState,
      addThreadColor,
      removeThreadColor,
      replaceThreadColor,
      setStitchPlan: setStitchPlanState,
      reset,
    }),
    [
      artwork,
      analysis,
      settings,
      threadColors,
      stitchPlan,
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
