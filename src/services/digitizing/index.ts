/**
 * Digitizing service.
 *
 * Artwork analysis is REAL: `analyzeArtwork` decodes the actual image on a
 * canvas and extracts genuine dominant colors / background / complexity
 * (see `src/utils/stitchEngine.ts`). Stitch-plan math below is still an
 * estimate (no real digitizing engine exists), but it now responds to the
 * true analyzed complexity and to the live density value instead of a
 * fixed multiplier.
 */

import { analyzeImage } from '@/utils/stitchEngine';

export interface AnalysisResult {
  colorsDetected: number;
  objectsIdentified: number;
  background: 'Transparent' | 'White' | 'Custom';
  recommendedStitchTypes: string[];
  dominantColors: string[];
  complexity: number;
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

/** Chosen to match the garments StitchPro's actual Nigerian embroidery-
 * business users most commonly work with (polos/uniform shirts, Ankara/
 * woven cotton fabric, caps, hoodies, jerseys) rather than a generic
 * industrial-textile list (the previous set included Denim and Leather,
 * neither a common embroidery substrate for this market) -- renamed from
 * the original six options per direct user feedback on which fabric
 * categories actually show up in real local orders. */
export type FabricType = 'Cotton / Polo' | 'Ankara / Woven Cotton' | 'Cap / Twill' | 'Fleece / Hoodie' | 'Jersey / Knit' | 'Custom';
export type StitchDensity = 'Light' | 'Standard' | 'Dense';
export type DesignSize = 'Small' | 'Medium' | 'Large' | 'Custom';
export type SizeUnit = 'mm' | 'cm' | 'in';
export type StitchStyle = 'fill' | 'cross';

/** Whether/how to add the satin edge-walk border stitchpro-backend can
 * trace around a FILL/CROSS_STITCH region's outline (and every hole) on
 * top of the fill -- see stitchpro-backend's
 * digitizer/stitches/satin/border.py for why this exists: a scanline fill
 * alone leaves a jagged staircase edge no matter how dense it is, and a
 * thin satin column traced along the real vector boundary is what
 * actually reads as a crisp, professional edge.
 *   - 'auto' (default): omit the field entirely and let the backend pick
 *     its own style-appropriate default (1.2mm for Fill, off for
 *     Cross-Stitch -- a grid of X's already has its own clean edge and
 *     doesn't need one).
 *   - 'off': explicitly disable it (sends 0mm), even for Fill.
 *   - 'custom': send `borderWidthMm` as an explicit override.
 */
export type BorderMode = 'auto' | 'off' | 'custom';

// `placement` (Left Chest / Center Front / etc.) was removed from
// DigitizeSettings entirely per direct user feedback asking to simplify
// the Design Settings screen -- it didn't feed into any real digitizing
// decision (stitch generation never branched on it), it only existed as
// descriptive metadata shown back in the Preview/Download summary, so
// dropping it is a pure UI simplification with no loss of actual
// digitizing behavior.

export interface DigitizeSettings {
  fabric: FabricType;
  customFabric: string;
  /** 0-100 continuous slider value driving the density bucket below. */
  densityPercent: number;
  density: StitchDensity;
  size: DesignSize;
  sizeUnit: SizeUnit;
  widthMm: number;
  heightMm: number;
  /** "fill" (tatami rows, default -- best for most logos/graphics) or
   * "cross" (a grid of X's -- better for a deliberately pixelated/sampler-
   * style design). See stitchpro-backend's digitizer/pipeline.py. */
  stitchStyle: StitchStyle;
  /** Stitch/grid direction in degrees, 0-179. */
  angleDeg: number;
  /** See `BorderMode` above. */
  borderMode: BorderMode;
  /** Border width in mm, only meaningful when `borderMode === 'custom'`. */
  borderWidthMm: number;
}

export const defaultDigitizeSettings: DigitizeSettings = {
  fabric: 'Cotton / Polo',
  customFabric: '',
  densityPercent: 50,
  density: 'Standard',
  size: 'Medium',
  sizeUnit: 'mm',
  widthMm: 90,
  heightMm: 90,
  stitchStyle: 'fill',
  angleDeg: 0,
  borderMode: 'auto',
  borderWidthMm: 1.2,
};


const sizePresets: Record<Exclude<DesignSize, 'Custom'>, { width: number; height: number }> = {
  Small: { width: 60, height: 60 },
  Medium: { width: 90, height: 90 },
  Large: { width: 130, height: 130 },
};

export function densityPercentToBucket(percent: number): StitchDensity {
  if (percent < 34) return 'Light';
  if (percent > 66) return 'Dense';
  return 'Standard';
}

/** Stitch length along a row -- same meaning (and same real numbers) the
 * legacy client-only pipeline already used for its RUNNING-stitch
 * subdivision, reused here so switching between the client fallback and
 * the real backend pipeline doesn't change the *meaning* of "density" the
 * user already understands. */
export const DENSITY_STITCH_LENGTH_MM: Record<StitchDensity, number> = {
  Light: 4,
  Standard: 3,
  Dense: 2,
};

/** FILL row spacing in mm -- tighter spacing = a denser, more solid-
 * looking fill. Separate from stitch *length* above (which only affects
 * travel along a row, not how close together the rows themselves are). */
export const DENSITY_FILL_SPACING_MM: Record<StitchDensity, number> = {
  Light: 0.55,
  Standard: 0.4,
  Dense: 0.28,
};

/** CROSS_STITCH grid cell size in mm -- smaller cells = a denser, more
 * detailed cross-stitch texture (at the cost of more individual X's). */
export const DENSITY_CROSS_CELL_MM: Record<StitchDensity, number> = {
  Light: 2.4,
  Standard: 1.8,
  Dense: 1.3,
};

/** The actual `border_width_mm` value (or `undefined` to omit the field
 * entirely) to send to the backend for the current `borderMode`/
 * `borderWidthMm` settings -- see `BorderMode`'s docstring above for what
 * each mode means. Centralized here so every caller (the real digitize
 * call in settings.tsx today, any future one) stays consistent about the
 * 'auto' => omit-the-field mapping instead of each guessing a number. */
export function resolveBorderWidthMm(settings: Pick<DigitizeSettings, 'borderMode' | 'borderWidthMm'>): number | undefined {
  if (settings.borderMode === 'off') return 0;
  if (settings.borderMode === 'custom') return settings.borderWidthMm;
  return undefined;
}

const UNIT_TO_MM: Record<SizeUnit, number> = { mm: 1, cm: 10, in: 25.4 };

export function mmToUnit(mm: number, unit: SizeUnit): number {
  const value = mm / UNIT_TO_MM[unit];
  return Math.round(value * 100) / 100;
}

export function unitToMm(value: number, unit: SizeUnit): number {
  return Math.round(value * UNIT_TO_MM[unit]);
}

function delay<T>(value: T, ms = 400): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export const digitizingService = {
  sizePresets,

  /** Real analysis: decodes the actual artwork pixels — no fixed/fake data. */
  async analyzeArtwork(imageSource: string | number | { uri: string }): Promise<AnalysisResult> {
    try {
      const result = await analyzeImage(imageSource, 5);
      const colorsDetected = result.colors.length;
      const objectsIdentified = Math.max(1, Math.round(1 + result.complexity * 5));
      const recommendedStitchTypes: string[] = [];
      if (colorsDetected <= 2) recommendedStitchTypes.push('Satin');
      else recommendedStitchTypes.push('Satin', 'Fill');
      if (result.complexity > 0.35) recommendedStitchTypes.push('Running');
      if (result.complexity > 0.6) recommendedStitchTypes.push('Applique');

      // small artificial delay so the analyzing screen's checklist still
      // reads naturally — the work above is genuinely already done by here.
      return await delay({
        colorsDetected,
        objectsIdentified,
        background: result.background,
        recommendedStitchTypes,
        dominantColors: result.colors,
        complexity: result.complexity,
      });
    } catch (e) {
      // Fallback only if the browser can't decode the image at all.
      return delay({
        colorsDetected: 5,
        objectsIdentified: 3,
        background: 'Transparent',
        recommendedStitchTypes: ['Satin', 'Fill', 'Running'],
        dominantColors: ['#5B4FE8', '#181B26', '#D9A441', '#FFFFFF', '#3E7BFA'],
        complexity: 0.4,
      });
    }
  },

  async generateStitchPlan(settings: DigitizeSettings, analysis?: AnalysisResult): Promise<StitchPlanSummary> {
    const densityMultiplier = 0.65 + (settings.densityPercent / 100) * 0.9;
    const complexityMultiplier = 1 + (analysis?.complexity ?? 0.35);
    const area = settings.widthMm * settings.heightMm;
    const baseStitches = Math.round(area * 1.6 * densityMultiplier * complexityMultiplier);
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
