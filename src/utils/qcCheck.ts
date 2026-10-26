/**
 * Real, computed quality-check for a finished stitch plan -- replaces the
 * old hardcoded "Quality check passed — 96% stitch confidence" toast, which
 * never actually looked at the design's real points and said the exact
 * same thing for every design, good or bad.
 *
 * This inspects the actual DstPoint sequence a design will export and
 * flags the same classes of problems a human digitizer checks for before
 * sending a file to a machine: stitches too long to be safe (snag/break
 * risk), stitches so short they're wasted motion, an excessive jump ratio
 * (poor path planning -> slow, thread-hungry production), and basic
 * sanity on stitch/color counts. It's intentionally conservative/simple
 * (no fabric-specific pull-compensation modeling yet) but every number in
 * its output is derived from this design's real data, not a constant.
 */
import type { DstPoint } from './dstWriter';

// Industry-standard safe limits (see e.g. maggieframes.com / zdigitizing.com
// digitizing guides cited in the stitch-type research): most commercial
// machines auto-trim/fault above ~12.1mm per stitch, and sub-0.1mm
// "stitches" are really just duplicate needle penetrations.
const MAX_SAFE_STITCH_MM = 12.1;
const MIN_USEFUL_STITCH_MM = 0.1;
const MAX_HEALTHY_JUMP_RATIO = 0.12; // >12% of all moves being jumps = messy pathing

export interface QualityCheckResult {
  passed: boolean;
  /** 0-100, derived from real issues found -- not a constant. */
  score: number;
  issues: string[];
  stats: {
    stitchCount: number;
    jumpCount: number;
    colorChangeCount: number;
    longestStitchMm: number;
    tooLongCount: number;
    tooShortCount: number;
  };
}

export function runQualityCheck(points: DstPoint[], threadColors: string[]): QualityCheckResult {
  const issues: string[] = [];
  let score = 100;

  if (points.length === 0) {
    return {
      passed: false,
      score: 0,
      issues: ['No stitch data to check.'],
      stats: { stitchCount: 0, jumpCount: 0, colorChangeCount: 0, longestStitchMm: 0, tooLongCount: 0, tooShortCount: 0 },
    };
  }

  let stitchCount = 0;
  let jumpCount = 0;
  let colorChangeCount = 0;
  let tooLongCount = 0;
  let tooShortCount = 0;
  let longestStitchMm = 0;
  let px = 0;
  let py = 0;

  for (const p of points) {
    if (p.command === 'stitch' || p.command === 'jump') {
      const dx = (p.x - px) / 10; // 0.1mm units -> mm
      const dy = (p.y - py) / 10;
      const lengthMm = Math.sqrt(dx * dx + dy * dy);
      if (lengthMm > longestStitchMm) longestStitchMm = lengthMm;
      if (lengthMm > MAX_SAFE_STITCH_MM) tooLongCount++;
      if (p.command === 'stitch') {
        stitchCount++;
        if (lengthMm < MIN_USEFUL_STITCH_MM) tooShortCount++;
      } else {
        jumpCount++;
      }
    } else if (p.command === 'colorChange') {
      colorChangeCount++;
    }
    px = p.x;
    py = p.y;
  }

  if (tooLongCount > 0) {
    const pct = (tooLongCount / Math.max(1, stitchCount + jumpCount)) * 100;
    issues.push(
      `${tooLongCount} stitch${tooLongCount === 1 ? '' : 'es'} longer than ${MAX_SAFE_STITCH_MM}mm — snag/thread-break risk on the machine.`
    );
    score -= Math.min(35, 10 + pct * 2);
  }

  if (tooShortCount > 0) {
    const pct = (tooShortCount / Math.max(1, stitchCount)) * 100;
    if (pct > 2) {
      issues.push(`${tooShortCount} near-zero-length stitches found — wasted needle penetrations.`);
      score -= Math.min(15, pct);
    }
  }

  const totalMoves = stitchCount + jumpCount;
  const jumpRatio = totalMoves > 0 ? jumpCount / totalMoves : 0;
  if (jumpRatio > MAX_HEALTHY_JUMP_RATIO) {
    issues.push(
      `High jump ratio (${Math.round(jumpRatio * 100)}% of all moves) — pathing could be tightened to cut production time and thread waste.`
    );
    score -= Math.min(25, (jumpRatio - MAX_HEALTHY_JUMP_RATIO) * 100);
  }

  const expectedColorChanges = Math.max(0, threadColors.length - 1);
  if (colorChangeCount > expectedColorChanges + 2) {
    issues.push(
      `${colorChangeCount} color changes for only ${threadColors.length} thread${threadColors.length === 1 ? '' : 's'} — the same color is being revisited more than expected.`
    );
    score -= 10;
  }

  if (stitchCount < 20) {
    issues.push('Very low stitch count — this design may be too sparse to hold its shape on fabric.');
    score -= 20;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    passed: score >= 70,
    score,
    issues,
    stats: { stitchCount, jumpCount, colorChangeCount, longestStitchMm: Math.round(longestStitchMm * 10) / 10, tooLongCount, tooShortCount },
  };
}
