import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Play, Pause, RotateCcw, Zap, MousePointerClick, X } from 'lucide-react-native';
import { colors, radius, shadows, spacing, typography } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Slider } from '@/components/ui/Slider';
import { EmptyState } from '@/components/ui/EmptyState';
import { EmbossedStitchCanvas, type SelectedStitchInfo } from '@/components/ui/EmbossedStitchCanvas';
import { useResponsive } from '@/hooks/useResponsive';
import { useStitchPreview } from '@/hooks/useStitchPreview';
import { designsService, type Design } from '@/services/designs';
import { formatNumber } from '@/utils/format';

type Speed = '1' | '2' | '4';

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Friendly label for the preview-only thread-thickness slider's current
// value, matching the identical control on the Preview screen.
function threadThicknessLabel(scale: number): string {
  if (scale < 0.85) return 'Fine';
  if (scale > 1.2) return 'Heavy';
  return 'Standard';
}

export default function SimulatorScreen() {
  const { isDesktop } = useResponsive();
  const [designs, setDesigns] = useState<Design[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>('1');
  const [selectedStitch, setSelectedStitch] = useState<SelectedStitchInfo | null>(null);
  // Preview-only visualization aid (see the identical control on the Preview
  // screen) -- doesn't affect the actual stitch geometry, just how thick the
  // rendered thread looks.
  const [threadThicknessScale, setThreadThicknessScale] = useState(1);

  useEffect(() => {
    designsService.list().then((list) => {
      setDesigns(list);
      if (list.length > 0) setSelectedId(list[0].id);
    });
  }, []);

  const selected = designs?.find((d) => d.id === selectedId) ?? null;

  const plan = useMemo(() => {
    if (!selected) return null;
    const totalSeconds = Math.max(16, Math.round(selected.stitches / 900));
    return { totalSeconds, colorCount: Math.max(1, selected.colors) };
  }, [selected]);

  // Real generated stitch path for the selected design's actual thumbnail —
  // this drives the canvas animation below instead of a static-image wipe.
  // Tries the real stitchpro-backend digitizer first (works on native and
  // web alike), and only falls back to the browser-only client analysis on
  // web if the backend is unreachable — see useStitchPreview.ts.
  const sim = useStitchPreview(
    selected?.thumbnail,
    selected?.sizeMm.width ?? 90,
    selected?.sizeMm.height ?? 90,
    plan?.colorCount ?? 5
  );

  useEffect(() => {
    if (!playing || !plan) return;
    const speedMultiplier = Number(speed);
    const interval = setInterval(() => {
      setProgress((p) => {
        const next = p + (1 / (plan.totalSeconds * 10)) * speedMultiplier;
        if (next >= 1) {
          setPlaying(false);
          return 1;
        }
        return next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [playing, plan, speed]);

  const selectDesign = (id: string) => {
    setSelectedId(id);
    setProgress(0);
    setPlaying(false);
    setSelectedStitch(null);
  };

  const restart = () => {
    setProgress(0);
    setPlaying(true);
  };

  if (!designs) {
    return (
      <ScreenContainer>
        <Text style={typography.pageTitle}>Simulator</Text>
        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          <Skeleton height={280} borderRadius={radius.card} />
          <Skeleton height={140} borderRadius={radius.card} />
        </View>
      </ScreenContainer>
    );
  }

  if (designs.length === 0 || !selected || !plan) {
    return (
      <ScreenContainer>
        <Text style={typography.pageTitle}>Simulator</Text>
        <EmptyState
          title="No designs to simulate"
          description="Create or upload a design first, then come back to preview its stitch-out here."
        />
      </ScreenContainer>
    );
  }

  const palette = sim.palette;
  const totalSegments = sim.segments.length;
  const activeSegmentIndex = Math.min(totalSegments - 1, Math.floor(progress * totalSegments));
  const colorIndex = totalSegments > 0 && activeSegmentIndex >= 0 ? sim.segments[activeSegmentIndex].colorIndex : 0;
  const elapsed = progress * plan.totalSeconds;
  const stitchesDone = Math.round(progress * selected.stitches);

  return (
    <ScreenContainer>
      <Text style={typography.pageTitle}>Simulator</Text>
      <Text style={[typography.body, styles.subtitle]}>
        A real generated stitch path — traced needle pass by needle pass from your design&apos;s actual colors —
        before it hits the machine.
      </Text>

      <View style={styles.pickerRow}>
        {designs.map((d) => {
          const active = d.id === selectedId;
          return (
            <Pressable
              key={d.id}
              onPress={() => selectDesign(d.id)}
              style={[styles.pickerThumb, active && styles.pickerThumbActive]}
            >
              <Image source={d.thumbnail as any} style={styles.pickerImage} resizeMode="cover" />
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.layout, isDesktop && styles.layoutDesktop]}>
        <View style={[styles.stageCol, isDesktop && styles.stageColDesktop]}>
          <View style={[styles.stage, shadows.card as object]}>
            {sim.loading ? (
              <View style={styles.stageLoading} />
            ) : sim.source === 'none' ? (
              <View style={styles.stageLoading}>
                <Text style={[typography.bodySmall, styles.noPreviewText]}>
                  Couldn&apos;t reach the digitizing backend to build a stitch preview for this design.
                </Text>
              </View>
            ) : (
              <EmbossedStitchCanvas
                segments={sim.segments}
                palette={palette}
                widthMm={sim.widthMm}
                heightMm={sim.heightMm}
                progress={progress}
                onSelectStitch={setSelectedStitch}
                needleBobbing={playing}
                threadThicknessScale={threadThicknessScale}
              />
            )}
            {progress >= 1 && (
              <View style={styles.completeBadge}>
                <Badge label="Stitch-out complete" tone="success" />
              </View>
            )}
            {!selectedStitch && sim.source !== 'none' && !sim.loading && (
              <View style={styles.inspectHint} pointerEvents="none">
                <MousePointerClick size={12} color={colors.textTertiary} />
                <Text style={[typography.caption, { color: colors.textTertiary }]}>
                  Tap any stitch to inspect it
                </Text>
              </View>
            )}
            {selectedStitch && (
              <View style={styles.inspectCard}>
                <View style={styles.inspectCardHeader}>
                  <Badge
                    label={selectedStitch.kind === 'jump' ? 'Jump' : 'Stitch'}
                    tone={selectedStitch.kind === 'jump' ? 'neutral' : 'indigo'}
                  />
                  <Pressable onPress={() => setSelectedStitch(null)} hitSlop={8} accessibilityLabel="Close">
                    <X size={15} color={colors.textTertiary} />
                  </Pressable>
                </View>
                <Text style={[typography.bodySmall, { color: colors.textPrimary, marginTop: spacing.xs }]}>
                  #{formatNumber(selectedStitch.index)} of {formatNumber(selectedStitch.total)}
                </Text>
                <View style={styles.inspectRow}>
                  <Text style={[typography.caption, styles.inspectLabel]}>Length</Text>
                  <Text style={[typography.caption, { color: colors.textPrimary }]}>
                    {selectedStitch.lengthMm.toFixed(2)}mm
                  </Text>
                </View>
                <View style={styles.inspectRow}>
                  <Text style={[typography.caption, styles.inspectLabel]}>Position</Text>
                  <Text style={[typography.caption, { color: colors.textPrimary }]}>
                    {selectedStitch.xMm.toFixed(1)}, {selectedStitch.yMm.toFixed(1)}mm
                  </Text>
                </View>
                {selectedStitch.colorHex && (
                  <View style={styles.inspectRow}>
                    <Text style={[typography.caption, styles.inspectLabel]}>Thread</Text>
                    <View style={styles.inspectThreadValue}>
                      <View style={[styles.inspectSwatch, { backgroundColor: selectedStitch.colorHex }]} />
                      <Text style={[typography.caption, { color: colors.textPrimary }]}>{selectedStitch.colorHex}</Text>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>

          <View style={styles.controlsRow}>
            <Pressable
              onPress={() => setPlaying((p) => !p)}
              style={styles.playButton}
              accessibilityLabel={playing ? 'Pause' : 'Play'}
            >
              {playing ? (
                <Pause size={20} color={colors.white} fill={colors.white} />
              ) : (
                <Play size={20} color={colors.white} fill={colors.white} />
              )}
            </Pressable>
            <Pressable onPress={restart} style={styles.restartButton} accessibilityLabel="Restart">
              <RotateCcw size={17} color={colors.textSecondary} />
            </Pressable>
            <View style={{ flex: 1 }} />
            <SegmentedControl
              value={speed}
              onChange={setSpeed}
              options={[
                { label: '1x', value: '1' },
                { label: '2x', value: '2' },
                { label: '4x', value: '4' },
              ]}
            />
          </View>
        </View>

        <View style={[styles.statsCol, isDesktop && styles.statsColDesktop]}>
          <Card>
            <Text style={[typography.h3, { marginBottom: spacing.md }]}>{selected.name}</Text>
            <View style={styles.statRow}>
              <Text style={[typography.bodySmall, styles.statLabel]}>Stitches</Text>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
                {formatNumber(stitchesDone)} / {formatNumber(selected.stitches)}
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={[typography.bodySmall, styles.statLabel]}>Elapsed</Text>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
                {formatClock(elapsed)} / {formatClock(plan.totalSeconds)}
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={[typography.bodySmall, styles.statLabel]}>Thread changes</Text>
              <Text style={[typography.bodyMedium, { color: colors.textPrimary }]}>
                {colorIndex} / {Math.max(0, palette.length - 1)}
              </Text>
            </View>
          </Card>

          <Card style={{ marginTop: spacing.md }}>
            <View style={styles.cardTitleRow}>
              <Zap size={15} color={colors.textSecondary} />
              <Text style={typography.h3}>Current thread</Text>
            </View>
            <View style={styles.threadRow}>
              {palette.map((hex, i) => (
                <View
                  key={i}
                  style={[styles.threadSwatch, { backgroundColor: hex }, i === colorIndex && styles.threadSwatchActive]}
                />
              ))}
            </View>
            <Text style={[typography.bodySmall, { color: colors.textTertiary, marginTop: spacing.sm }]}>
              Color {colorIndex + 1} of {Math.max(1, palette.length)} — extracted from this design&apos;s real artwork
            </Text>
          </Card>

          <Card style={{ marginTop: spacing.md }}>
            <View style={styles.densityHeaderRow}>
              <Text style={typography.h3}>Thread Thickness</Text>
              <Badge label={threadThicknessLabel(threadThicknessScale)} tone="indigo" />
            </View>
            <Text style={[typography.bodySmall, { color: colors.textTertiary, marginTop: spacing.xs }]}>
              Preview-only — visualizes a finer or heavier thread, doesn&apos;t change the real stitch file.
            </Text>
            <Slider
              value={threadThicknessScale}
              min={0.6}
              max={1.8}
              step={0.05}
              onValueChange={setThreadThicknessScale}
              accessibilityLabel="Thread thickness preview"
            />
          </Card>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    maxWidth: 560,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
    flexWrap: 'wrap',
  },
  pickerThumb: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  pickerThumbActive: {
    borderColor: colors.indigo,
  },
  pickerImage: {
    width: '100%',
    height: '100%',
  },
  layout: {
    gap: spacing.lg,
  },
  layoutDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stageCol: {
    gap: spacing.md,
  },
  stageColDesktop: {
    flex: 1.2,
  },
  statsCol: {},
  statsColDesktop: {
    flex: 1,
  },
  stage: {
    width: '100%',
    aspectRatio: 1.15,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.gray100,
  },
  stageLoading: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.gray200,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  noPreviewText: {
    textAlign: 'center',
    color: colors.textSecondary,
  },
  completeBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },
  inspectHint: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  inspectCard: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    width: 190,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.white,
    ...(shadows.card as object),
  },
  inspectCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inspectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xxs,
  },
  inspectLabel: {
    color: colors.textTertiary,
  },
  inspectThreadValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  inspectSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.indigo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restartButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  densityHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  statLabel: {
    color: colors.textSecondary,
  },
  threadRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  threadSwatch: {
    width: 28,
    height: 28,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
  },
  threadSwatchActive: {
    borderWidth: 2,
    borderColor: colors.indigo,
  },
});
