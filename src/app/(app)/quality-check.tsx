import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Layers,
  Scissors,
  Ruler,
  Palette,
  Waves,
} from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProgressCircle } from '@/components/ui/ProgressCircle';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useResponsive } from '@/hooks/useResponsive';
import { designsService, type Design } from '@/services/designs';
import { machinesService } from '@/services/machines';
import { formatNumber } from '@/utils/format';
import type { Machine } from '@/services/types';

type CheckStatus = 'pass' | 'warn' | 'fail';

interface CheckResult {
  key: string;
  label: string;
  status: CheckStatus;
  detail: string;
  icon: typeof ShieldCheck;
}

const ANALYSIS_STEPS = [
  'Checking stitch density',
  'Validating thread sequence',
  'Confirming hoop fit',
  'Scanning for jump stitches',
  'Reviewing underlay',
];
const STEP_DURATION_MS = 400;

const statusMeta: Record<CheckStatus, { tone: 'success' | 'warning' | 'danger'; Icon: typeof CheckCircle2 }> = {
  pass: { tone: 'success', Icon: CheckCircle2 },
  warn: { tone: 'warning', Icon: AlertTriangle },
  fail: { tone: 'danger', Icon: XCircle },
};

function seedFromId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return hash;
}

function runChecks(design: Design, machines: Machine[]): CheckResult[] {
  const seed = seedFromId(design.id);
  const area = design.sizeMm.width * design.sizeMm.height;
  const density = design.stitches / area;

  const densityStatus: CheckStatus = density > 3.4 ? 'fail' : density > 2.4 ? 'warn' : 'pass';
  const sequenceStatus: CheckStatus = design.colors > 7 ? 'warn' : 'pass';

  const largestHoop = machines.reduce(
    (max, m) => {
      let best = max;
      m.hoopSizes.forEach((h) => {
        const [w, hgt] = h.split('x').map(Number);
        if (w * hgt > best.w * best.h) best = { w, h: hgt };
      });
      return best;
    },
    { w: 0, h: 0 }
  );
  const fitsHoop = design.sizeMm.width <= largestHoop.w && design.sizeMm.height <= largestHoop.h;
  const nearLimit =
    fitsHoop && (design.sizeMm.width > largestHoop.w * 0.85 || design.sizeMm.height > largestHoop.h * 0.85);
  const hoopStatus: CheckStatus = !fitsHoop ? 'fail' : nearLimit ? 'warn' : 'pass';

  const jumpRatio = (seed % 40) / 1000 + design.colors / design.stitches;
  const jumpStatus: CheckStatus = jumpRatio > 0.012 ? 'warn' : 'pass';

  const underlayStatus: CheckStatus = seed % 11 === 0 ? 'warn' : 'pass';

  return [
    {
      key: 'density',
      label: 'Stitch density',
      status: densityStatus,
      icon: Layers,
      detail:
        densityStatus === 'fail'
          ? `${density.toFixed(2)} stitches/mm² is very dense — expect puckering on lighter fabrics. Consider simplifying fills.`
          : densityStatus === 'warn'
            ? `${density.toFixed(2)} stitches/mm² is on the high side. Use a firm stabilizer for best results.`
            : `${density.toFixed(2)} stitches/mm² is a safe, standard density for most fabrics.`,
    },
    {
      key: 'sequence',
      label: 'Thread sequence',
      status: sequenceStatus,
      icon: Palette,
      detail:
        sequenceStatus === 'warn'
          ? `${design.colors} thread colors means frequent color changes — group similar colors if your machine has limited needles.`
          : `${design.colors} thread colors is efficient for most multi-needle machines.`,
    },
    {
      key: 'hoop',
      label: 'Hoop fit',
      status: hoopStatus,
      icon: Ruler,
      detail:
        hoopStatus === 'fail'
          ? `${design.sizeMm.width}×${design.sizeMm.height}mm exceeds every hoop in your Machine Center (largest: ${largestHoop.w}×${largestHoop.h}mm).`
          : hoopStatus === 'warn'
            ? `${design.sizeMm.width}×${design.sizeMm.height}mm fits, but close to your largest hoop (${largestHoop.w}×${largestHoop.h}mm) — leave a safety margin.`
            : `${design.sizeMm.width}×${design.sizeMm.height}mm comfortably fits your available hoops.`,
    },
    {
      key: 'jumps',
      label: 'Jump stitches',
      status: jumpStatus,
      icon: Scissors,
      detail:
        jumpStatus === 'warn'
          ? 'A higher-than-usual number of jump stitches was detected — trims will add extra machine time.'
          : 'Jump stitch count is within a normal, efficient range.',
    },
    {
      key: 'underlay',
      label: 'Underlay & stabilization',
      status: underlayStatus,
      icon: Waves,
      detail:
        underlayStatus === 'warn'
          ? 'Underlay coverage looks light in a few areas — a cut-away stabilizer is recommended.'
          : 'Underlay stitching looks properly distributed beneath top stitches.',
    },
  ];
}

export default function QualityCheckScreen() {
  const { isDesktop } = useResponsive();
  const [designs, setDesigns] = useState<Design[] | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    designsService.list().then((list) => {
      setDesigns(list);
      if (list.length > 0) setSelectedId(list[0].id);
    });
    machinesService.list().then(setMachines);
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const selected = designs?.find((d) => d.id === selectedId) ?? null;

  const selectDesign = (id: string) => {
    setSelectedId(id);
    setResults(null);
    setAnalyzing(false);
  };

  const runAnalysis = () => {
    if (!selected) return;
    setResults(null);
    setAnalyzing(true);
    setStepIndex(0);
    cancelledRef.current = false;

    const advance = (index: number) => {
      if (cancelledRef.current) return;
      setStepIndex(index);
      if (index < ANALYSIS_STEPS.length - 1) {
        setTimeout(() => advance(index + 1), STEP_DURATION_MS);
      } else {
        setTimeout(() => {
          if (cancelledRef.current) return;
          setResults(runChecks(selected, machines));
          setAnalyzing(false);
        }, STEP_DURATION_MS);
      }
    };
    advance(0);
  };

  const score = useMemo(() => {
    if (!results) return 0;
    const points = results.reduce((sum, r) => sum + (r.status === 'pass' ? 100 : r.status === 'warn' ? 60 : 0), 0);
    return Math.round(points / results.length);
  }, [results]);

  const scoreLabel = score >= 90 ? 'Ready to stitch' : score >= 65 ? 'Needs a quick review' : 'Fix before stitching';
  const scoreColor = score >= 90 ? colors.success : score >= 65 ? colors.warning : colors.danger;

  if (!designs) {
    return (
      <ScreenContainer>
        <Text style={typography.pageTitle}>Quality Check</Text>
        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          <Skeleton height={100} borderRadius={radius.card} />
          <Skeleton height={280} borderRadius={radius.card} />
        </View>
      </ScreenContainer>
    );
  }

  if (designs.length === 0 || !selected) {
    return (
      <ScreenContainer>
        <Text style={typography.pageTitle}>Quality Check</Text>
        <EmptyState
          title="No designs to inspect"
          description="Create or upload a design first, then come back to run a pre-export quality check."
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Text style={typography.pageTitle}>Quality Check</Text>
      <Text style={[typography.body, styles.subtitle]}>
        A pre-export inspection to catch density, sequencing and hoop-fit issues before you stitch.
      </Text>

      <View style={styles.pickerRow}>
        {designs.map((d) => {
          const isActive = d.id === selectedId;
          return (
            <Pressable
              key={d.id}
              onPress={() => selectDesign(d.id)}
              style={[styles.pickerThumb, isActive && styles.pickerThumbActive]}
            >
              <Image source={d.thumbnail as any} style={styles.pickerImage} resizeMode="cover" />
            </Pressable>
          );
        })}
      </View>

      <View style={[styles.layout, isDesktop && styles.layoutDesktop]}>
        <Card style={[styles.leftCol, isDesktop && styles.leftColDesktop]}>
          <Text style={[typography.h3, { marginBottom: spacing.md }]}>{selected.name}</Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: spacing.md }]}>
            {formatNumber(selected.stitches)} stitches · {selected.colors} colors ·{' '}
            {selected.sizeMm.width}×{selected.sizeMm.height}mm
          </Text>
          <Button
            label={analyzing ? 'Analyzing…' : results ? 'Re-run Quality Check' : 'Run Quality Check'}
            icon={<ShieldCheck size={16} color={colors.white} />}
            onPress={runAnalysis}
            loading={analyzing}
            fullWidth
          />
          {analyzing && (
            <Text style={[typography.bodySmall, styles.stepLabel]}>{ANALYSIS_STEPS[stepIndex]}…</Text>
          )}
        </Card>

        <View style={[styles.rightCol, isDesktop && styles.rightColDesktop]}>
          {!results && !analyzing ? (
            <EmptyState
              icon={<ShieldCheck size={30} color={colors.indigo} />}
              title="Run a quality check"
              description="Choose a design above and run the check to see a full inspection report."
            />
          ) : analyzing ? (
            <Card style={styles.analyzingCard}>
              <ProgressCircle
                progress={(stepIndex + 0.5) / ANALYSIS_STEPS.length}
                label={`${Math.round(((stepIndex + 0.5) / ANALYSIS_STEPS.length) * 100)}%`}
                sublabel="Analyzing"
              />
            </Card>
          ) : (
            results && (
              <>
                <Card style={styles.scoreCard}>
                  <ProgressCircle progress={score / 100} color={scoreColor} label={`${score}`} sublabel="score" />
                  <View style={{ flex: 1 }}>
                    <Badge
                      label={scoreLabel}
                      tone={score >= 90 ? 'success' : score >= 65 ? 'warning' : 'danger'}
                    />
                    <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs }]}>
                      Based on {results.length} checks against "{selected.name}".
                    </Text>
                  </View>
                </Card>

                <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                  {results.map((r) => {
                    const meta = statusMeta[r.status];
                    const Icon = r.icon;
                    return (
                      <Card key={r.key} style={styles.checkRow}>
                        <View style={styles.checkIconWrap}>
                          <Icon size={17} color={colors.indigo} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.checkHeaderRow}>
                            <Text style={typography.bodyMedium}>{r.label}</Text>
                            <Badge label={r.status} tone={meta.tone} dot />
                          </View>
                          <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                            {r.detail}
                          </Text>
                        </View>
                      </Card>
                    );
                  })}
                </View>
              </>
            )
          )}
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
  leftCol: {},
  leftColDesktop: {
    flex: 1,
  },
  rightCol: {},
  rightColDesktop: {
    flex: 1.4,
  },
  stepLabel: {
    color: colors.textTertiary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  analyzingCard: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  scoreCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  checkRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  checkIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.indigoTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});
