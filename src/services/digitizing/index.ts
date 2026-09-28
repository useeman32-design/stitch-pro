/**
 * Digitizing service — mock implementation.
 *
 * Encapsulates the artwork -> analysis -> stitch-plan pipeline. Every
 * function below currently returns deterministic mock data on a timer to
 * simulate real processing; the public shape is what the real digitizing
 * engine/API should eventually fulfil.
 */

export interface AnalysisResult {
  colorsDetected: number;
  objectsIdentified: number;
  background: 'Transparent' | 'White' | 'Custom';
  recommendedStitchTypes: string[];
}

export interface StitchPlanSummary {
  stitches: number;
  colors: number;
  estimatedThreadMeters: number;
  estimatedTimeMinutes: number;
  threadChanges: number;
  jumps: number;
  trims: number;
  sizeMm: { width: number; height: number };
}

function delay<T>(value: T, ms = 400): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export const digitizingService = {
  async analyzeArtwork(_imageUri: string): Promise<AnalysisResult> {
    return delay({
      colorsDetected: 5,
      objectsIdentified: 8,
      background: 'Transparent',
      recommendedStitchTypes: ['Fill', 'Satin', 'Running'],
    });
  },

  async generateStitchPlan(): Promise<StitchPlanSummary> {
    return delay({
      stitches: 12482,
      colors: 5,
      estimatedThreadMeters: 98,
      estimatedTimeMinutes: 11,
      threadChanges: 4,
      jumps: 3,
      trims: 2,
      sizeMm: { width: 80, height: 80 },
    });
  },
};
