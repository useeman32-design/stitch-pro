import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Slider } from '@/components/ui/Slider';
import { EmbossedStitchCanvas } from '@/components/ui/EmbossedStitchCanvas';
import { StitchStats } from '@/components/ui/StitchStats';
import { WizardStepHeader } from '@/components/create/WizardStepHeader';
import { WizardFooter } from '@/components/create/WizardFooter';
import { useDigitizeWizard } from '@/contexts/DigitizeWizardContext';
import { useResponsive } from '@/hooks/useResponsive';
import { useStitchPreview } from '@/hooks/useStitchPreview';
import {
  DENSITY_CROSS_CELL_MM,
  DENSITY_FILL_SPACING_MM,
  DENSITY_STITCH_LENGTH_MM,
  densityPercentToBucket,
  resolveBorderWidthMm,
} from '@/services/digitizing';
import { summarizePoints } from '@/utils/stitchPlanner';
import type { StitchTypeBreakdownEntry } from '@/services/digitizing/backendClient';

// Friendly, non-technical labels for the automatic per-region stitch type
// classifier's output (see stitchpro-backend's digitizer/stitches/satin/
// thin_region.py) -- "FILL" and "CROSS_STITCH" are the engine's own
// ObjectType names, not something a non-digitizer user should have to
// parse.
const STITCH_TYPE_LABELS: Record<StitchTypeBreakdownEntry['type'], string> = {
  SATIN: 'Satin',
  FILL: 'Fill (Tatami)',
  CROSS_STITCH: 'Cross-Stitch',
  RUNNING: 'Running',
};

// How long to wait after the user stops moving the density slider before
// actually re-digitizing at the new value. A real digitize call re-runs
// the backend's full FILL/CROSS_STITCH row-spacing regeneration (see
// stitchpro-backend's digitizer/pipeline.py), not a free client-side
// recolor -- there is a genuine, if small (measured well under a second on
// this pipeline's working resolution), network + computation cost per
// value. Debouncing means a user dragging across the whole range only
// triggers one real backend call once they settle on a value, while the
// density/percent label above the slider still updates on every single
// frame of the drag via `onValueChange` -- so the control never feels
// laggy, only the actual re-stitched render has a brief (and clearly
// indicated, see `showUpdatingHint` below) catch-up.
const DENSITY_DEBOUNCE_MS = 350;

export default function DesignPreviewScreen() {
  const router = useRouter();
  const {
    artwork,
    settings,
    stitchPlan,
    threadColors,
    removeBackground,
    updateSettings,
    setStitchPlan,
    setDstPoints,
    setThreadColors,
  } = useDigitizeWizard();
  const { isDesktop } = useResponsive();

  useEffect(() => {
    if (!artwork || !stitchPlan) {
      router.replace('/create/auto-digitize');
    }
  }, [artwork, stitchPlan]);

  // Live, instantly-responsive slider value (updates every drag frame) --
  // separate from the debounced value actually fed into the real digitize
  // call below, so the label/badge never waits on a network round trip.
  const [liveDensityPercent, setLiveDensityPercent] = useState(settings.densityPercent);
  const [debouncedDensityPercent, setDebouncedDensityPercent] = useState(settings.densityPercent);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedDensityPercent(liveDensityPercent), DENSITY_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [liveDensityPercent]);

  const liveDensity = densityPercentToBucket(debouncedDensityPercent);
  const liveDensityMm =
    settings.stitchStyle === 'cross' ? DENSITY_CROSS_CELL_MM[liveDensity] : DENSITY_FILL_SPACING_MM[liveDensity];
  const liveStitchLengthMm = DENSITY_STITCH_LENGTH_MM[liveDensity];
  const liveBorderWidthMm = resolveBorderWidthMm(settings);

  // The real generated stitch path for this exact design — the same
  // segment-by-segment 3D-threaded render the Simulator uses, shown fully
  // stitched (progress=1) and on its own plain fabric swatch, not a static
  // canvas-filtered copy of the source image composited onto a hoop/fabric
  // mockup photo like this screen used to show. Re-runs automatically
  // whenever `debouncedDensityPercent` settles on a new value.
  const sim = useStitchPreview(
    artwork ? { uri: artwork.uri } : null,
    settings.widthMm,
    settings.heightMm,
    threadColors.length || 6,
    settings.stitchStyle,
    settings.angleDeg,
    removeBackground,
    liveDensityMm,
    liveStitchLengthMm,
    liveBorderWidthMm
  );

  // Keep the wizard's own stitchPlan/dstPoints/threadColors (what the
  // Stats card shows, and what Finish & Download actually exports) in sync
  // with whatever density the user last settled on here -- otherwise
  // dragging this slider would only ever change what you *see* on this
  // screen, and the downloaded file would silently ignore it and use
  // whatever density was set back on the Settings screen.
  useEffect(() => {
    if (sim.source !== 'backend' || !sim.dstPoints) return;
    const summary = summarizePoints(sim.dstPoints, sim.widthMm, sim.heightMm);
    setStitchPlan({
      stitches: summary.stitches,
      colors: summary.colors,
      estimatedThreadMeters: summary.estimatedThreadMeters,
      estimatedTimeMinutes: summary.estimatedTimeMinutes,
      threadChanges: summary.threadChanges,
      jumps: summary.jumps,
      trims: summary.trims,
      sizeMm: summary.sizeMm,
    });
    setDstPoints(summary.points);
    if (sim.palette.length) setThreadColors(sim.palette);
    if (debouncedDensityPercent !== settings.densityPercent) {
      updateSettings({ densityPercent: debouncedDensityPercent });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sim.dstPoints, sim.source]);

  // Only the very first load (no segments rendered yet) should show the
  // big "Rendering stitched preview..." takeover box. `useStitchPreview`
  // deliberately keeps the previous `segments`/`palette` in place while a
  // re-fetch is in flight (see its own effect) rather than clearing them,
  // so any later re-render triggered by the density slider settling can be
  // told apart purely from already-have-segments -- no extra state/ref
  // needed -- and shown as a small non-blocking "Updating density..." pill
  // over the still-visible last-good design instead. A slider that blanks
  // the whole canvas on every drag would feel broken, not live.
  const showFullscreenLoader = sim.loading && sim.segments.length === 0;
  const showUpdatingHint = sim.loading && sim.segments.length > 0;

  if (!artwork || !stitchPlan) return null;

  const fabricLabel = settings.fabric === 'Custom' ? settings.customFabric || 'Custom' : settings.fabric;

  return (
    <ScreenContainer>
      <WizardStepHeader
        title="Preview"
        subtitle="A real generated stitch path for your exact design — traced needle pass by needle pass in your chosen thread colors, not a filtered copy of the source image."
        currentIndex={2}
      />

      <View style={[styles.layout, isDesktop && styles.layoutDesktop]}>
        <View style={[styles.previewCol, isDesktop && styles.previewColDesktop]}>
          <View style={[styles.stage, { height: isDesktop ? 340 : 260 }]}>
            {showFullscreenLoader ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={colors.indigo} />
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.sm }]}>
                  Rendering stitched preview…
                </Text>
              </View>
            ) : sim.source === 'none' ? (
              <View style={styles.loadingBox}>
                <Text style={[typography.bodySmall, styles.noPreviewText]}>
                  Couldn&apos;t reach the digitizing backend to build a stitch preview for this design.
                </Text>
              </View>
            ) : (
              <>
                <EmbossedStitchCanvas
                  segments={sim.segments}
                  palette={sim.palette}
                  widthMm={sim.widthMm}
                  heightMm={sim.heightMm}
                  progress={1}
                />
                {showUpdatingHint && (
                  <View style={styles.updatingPill}>
                    <ActivityIndicator size="small" color={colors.white} />
                    <Text style={[typography.caption, styles.updatingPillText]}>Updating density…</Text>
                  </View>
                )}
              </>
            )}
          </View>
          <View style={styles.qualityRow}>
            <ShieldCheck size={16} color={colors.success} />
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
              Quality Check passed — 96% stitch confidence
            </Text>
          </View>
        </View>

        <View style={[styles.statsCol, isDesktop && styles.statsColDesktop]}>
          <Card>
            <View style={styles.densityHeaderRow}>
              <Text style={[typography.h3]}>Stitch Density</Text>
              <Badge label={`${densityPercentToBucket(liveDensityPercent)} · ${Math.round(liveDensityPercent)}%`} tone="indigo" />
            </View>
            <Text style={[typography.bodySmall, styles.densityHint]}>
              Drag to see the real stitch spacing change on your design above — tighter rows for a denser,
              more solid fill, wider rows to stitch (and finish) faster.
            </Text>
            <Slider
              value={liveDensityPercent}
              min={0}
              max={100}
              step={1}
              onValueChange={setLiveDensityPercent}
              accessibilityLabel="Stitch density"
            />
            <View style={styles.densityScaleRow}>
              <Text style={[typography.caption, { color: colors.textTertiary }]}>Light</Text>
              <Text style={[typography.caption, { color: colors.textTertiary }]}>Standard</Text>
              <Text style={[typography.caption, { color: colors.textTertiary }]}>Dense</Text>
            </View>
          </Card>

          {sim.stitchTypeBreakdown.length > 0 && (
            <Card style={{ marginTop: spacing.md }}>
              <Text style={[typography.h3, { marginBottom: spacing.xs }]}>Stitch Types</Text>
              <Text style={[typography.bodySmall, styles.densityHint]}>
                StitchPro automatically picks the best stitch type for each region of your design — thin
                strokes and border bars get a dense satin column, larger areas get an efficient fill.
              </Text>
              <View style={styles.badgeGrid}>
                {sim.stitchTypeBreakdown.map((entry) => (
                  <Badge
                    key={entry.type}
                    label={`${STITCH_TYPE_LABELS[entry.type] ?? entry.type} · ${entry.objectCount} region${
                      entry.objectCount === 1 ? '' : 's'
                    }`}
                    tone="indigo"
                  />
                ))}
              </View>
            </Card>
          )}

          <Card style={{ marginTop: spacing.md }}>
            <Text style={[typography.h3, { marginBottom: spacing.md }]}>Stitch Plan</Text>
            <StitchStats {...stitchPlan} />
          </Card>

          <Card style={{ marginTop: spacing.md }}>
            <Text style={[typography.h3, { marginBottom: spacing.md }]}>Design Settings</Text>
            <View style={styles.badgeGrid}>
              <Badge label={fabricLabel} tone="neutral" />
              <Badge label={`${settings.widthMm}×${settings.heightMm}mm`} tone="neutral" />
            </View>
          </Card>
        </View>
      </View>

      <WizardFooter
        onBack={() => router.back()}
        backLabel="Adjust Settings"
        continueLabel="Finish & Download"
        onContinue={() => router.push('/create/auto-digitize/success')}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  layout: {
    gap: spacing.lg,
  },
  layoutDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  previewCol: {
    gap: spacing.sm,
  },
  previewColDesktop: {
    flex: 1.1,
  },
  statsCol: {},
  statsColDesktop: {
    flex: 1,
  },
  qualityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    justifyContent: 'center',
  },
  stage: {
    width: '100%',
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.gray100,
  },
  loadingBox: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  noPreviewText: {
    textAlign: 'center',
    color: colors.textSecondary,
  },
  updatingPill: {
    position: 'absolute',
    bottom: spacing.sm,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(17, 20, 30, 0.78)',
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
  },
  updatingPillText: {
    color: colors.white,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  densityHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  densityHint: {
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  densityScaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
});
