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
  dominantColors: string[];
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

export type Placement = 'Left Chest' | 'Center Front' | 'Full Back' | 'Sleeve' | 'Cap Front';
export type FabricType = 'Cotton Twill' | 'Denim' | 'Fleece' | 'Leather' | 'Knit / Jersey';
export type StitchDensity = 'Light' | 'Standard' | 'Dense';
export type DesignSize = 'Small' | 'Medium' | 'Large' | 'Custom';

export interface DigitizeSettings {
  placement: Placement;
  fabric: FabricType;
  density: StitchDensity;
  size: DesignSize;
  widthMm: number;
  heightMm: number;
}

export const defaultDigitizeSettings: DigitizeSettings = {
  placement: 'Left Chest',
  fabric: 'Cotton Twill',
  density: 'Standard',
  size: 'Medium',
  widthMm: 90,
  heightMm: 90,
};

const sizePresets: Record<Exclude<DesignSize, 'Custom'>, { width: number; height: number }> = {
  Small: { width: 60, height: 60 },
  Medium: { width: 90, height: 90 },
  Large: { width: 130, height: 130 },
};

function delay<T>(value: T, ms = 400): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export const digitizingService = {
  sizePresets,

  async analyzeArtwork(_imageUri: string): Promise<AnalysisResult> {
    return delay({
      colorsDetected: 5,
      objectsIdentified: 3,
      background: 'Transparent',
      recommendedStitchTypes: ['Satin', 'Fill', 'Running'],
      dominantColors: ['#5B4FE8', '#181B26', '#D9A441', '#FFFFFF', '#3E7BFA'],
    });
  },

  async generateStitchPlan(settings: DigitizeSettings, analysis?: AnalysisResult): Promise<StitchPlanSummary> {
    const densityMultiplier = { Light: 0.75, Standard: 1, Dense: 1.35 }[settings.density];
    const area = settings.widthMm * settings.heightMm;
    const baseStitches = Math.round(area * 1.85 * densityMultiplier);
    const colors = analysis?.colorsDetected ?? 5;

    return delay({
      stitches: baseStitches,
      colors,
      estimatedThreadMeters: Math.round(baseStitches / 130),
      estimatedTimeMinutes: Math.max(3, Math.round(baseStitches / 1150)),
      threadChanges: Math.max(1, colors - 1),
      jumps: Math.max(2, Math.round(baseStitches / 4200)),
      trims: Math.max(1, Math.round(baseStitches / 5200)),
      sizeMm: { width: settings.widthMm, height: settings.heightMm },
    });
  },
};
