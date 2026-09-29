import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  defaultDigitizeSettings,
  type AnalysisResult,
  type DigitizeSettings,
  type StitchPlanSummary,
} from '@/services/digitizing';

export interface UploadedArtwork {
  uri: string;
  name: string;
  source: 'upload' | 'sample';
}

interface DigitizeWizardValue {
  artwork: UploadedArtwork | null;
  analysis: AnalysisResult | null;
  settings: DigitizeSettings;
  stitchPlan: StitchPlanSummary | null;
  setArtwork: (artwork: UploadedArtwork) => void;
  clearArtwork: () => void;
  setAnalysis: (analysis: AnalysisResult) => void;
  updateSettings: (partial: Partial<DigitizeSettings>) => void;
  setStitchPlan: (plan: StitchPlanSummary) => void;
  reset: () => void;
}

const DigitizeWizardContext = createContext<DigitizeWizardValue | undefined>(undefined);

export function DigitizeWizardProvider({ children }: { children: React.ReactNode }) {
  const [artwork, setArtworkState] = useState<UploadedArtwork | null>(null);
  const [analysis, setAnalysisState] = useState<AnalysisResult | null>(null);
  const [settings, setSettings] = useState<DigitizeSettings>(defaultDigitizeSettings);
  const [stitchPlan, setStitchPlanState] = useState<StitchPlanSummary | null>(null);

  const updateSettings = useCallback((partial: Partial<DigitizeSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const reset = useCallback(() => {
    setArtworkState(null);
    setAnalysisState(null);
    setSettings(defaultDigitizeSettings);
    setStitchPlanState(null);
  }, []);

  const value = useMemo(
    () => ({
      artwork,
      analysis,
      settings,
      stitchPlan,
      setArtwork: setArtworkState,
      clearArtwork: () => setArtworkState(null),
      setAnalysis: setAnalysisState,
      updateSettings,
      setStitchPlan: setStitchPlanState,
      reset,
    }),
    [artwork, analysis, settings, stitchPlan, updateSettings, reset]
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
