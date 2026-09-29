import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Play, Pause, RotateCcw, Zap } from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { colors, radius, shadows, spacing, typography } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptyState } from '@/components/ui/EmptyState';
import { StitchCanvas } from '@/components/ui/StitchCanvas';
import { useResponsive } from '@/hooks/useResponsive';
import { useStitchSimulation } from '@/hooks/useStitchSimulation';
import { designsService, type Design } from '@/services/designs';
import { formatNumber } from '@/utils/format';

type Speed = '1' | '2' | '4';

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SimulatorScreen() {
  const { isDesktop } = useResponsive();
  const [designs, setDesigns] = useState<Design[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>('1');
  const [needlePos, setNeedlePos] = useState<{ xPct: number; yPct: number } | null>(null);
  const needleBob = useSharedValue(0);

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
  const sim = useStitchSimulation(selected?.thumbnail, plan?.colorCount ?? 5);

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

  useEffect(() => {
    if (playing) {
      needleBob.value = withRepeat(withTiming(1, { duration: 220, easing: Easing.linear }), -1, true);
    } else {
      needleBob.value = withTiming(0, { duration: 150 });
    }
  }, [playing]);

  const needleStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: needleBob.value * -6 }],
  }));

  const selectDesign = (id: string) => {
    setSelectedId(id);
    setProgress(0);
    setPlaying(false);
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
            ) : (
              <StitchCanvas
                segments={sim.segments}
                palette={palette}
                gridSize={sim.gridSize}
                progress={progress}
                onNeedlePosition={setNeedlePos}
              />
            )}
            {progress > 0 && progress < 1 && needlePos && (
              <Animated.View
                style={[
                  styles.needleWrap,
                  { left: `${needlePos.xPct}%`, top: `${needlePos.yPct}%` },
                  needleStyle,
                ]}
              >
                <View style={styles.needleDot} />
              </Animated.View>
            )}
            {progress >= 1 && (
              <View style={styles.completeBadge}>
                <Badge label="Stitch-out complete" tone="success" />
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
  },
  needleWrap: {
    position: 'absolute',
    marginLeft: -6,
    marginTop: -6,
    alignItems: 'center',
  },
  needleDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.indigo,
  },
  completeBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
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
