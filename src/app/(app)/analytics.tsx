import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FolderOpen, Scissors, ClipboardList, Cpu } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { useResponsive } from '@/hooks/useResponsive';
import { designsService } from '@/services/designs';
import { jobsService } from '@/services/jobs';
import { machinesService } from '@/services/machines';
import { formatNumber } from '@/utils/format';
import type { Design, JobStatus, Machine, ProductionJob } from '@/services/types';

const categoryColors: Record<Design['category'], string> = {
  logo: colors.indigo,
  text: colors.blue,
  monogram: '#D9A441',
  badge: colors.success,
  other: colors.textTertiary,
};

const jobStatusColors: Record<JobStatus, string> = {
  Pending: colors.textTertiary,
  Digitized: colors.info,
  Stitching: colors.warning,
  Completed: colors.success,
};

function BarRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <View style={styles.barRow}>
      <View style={styles.barLabelRow}>
        <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[typography.bodySmall, { color: colors.textPrimary }]}>{count}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export default function AnalyticsScreen() {
  const { isDesktop } = useResponsive();
  const [designs, setDesigns] = useState<Design[] | null>(null);
  const [jobs, setJobs] = useState<ProductionJob[] | null>(null);
  const [machines, setMachines] = useState<Machine[] | null>(null);

  useEffect(() => {
    designsService.list().then(setDesigns);
    jobsService.list().then(setJobs);
    machinesService.list().then(setMachines);
  }, []);

  const loading = !designs || !jobs || !machines;

  const totals = useMemo(() => {
    if (!designs || !jobs || !machines) return null;
    const totalStitches = designs.reduce((sum, d) => sum + d.stitches, 0);
    const activeJobs = jobs.filter((j) => j.status !== 'Completed').length;
    const activeMachines = machines.filter((m) => m.status === 'active').length;
    const utilization = machines.length > 0 ? Math.round((activeMachines / machines.length) * 100) : 0;

    const byCategory: Record<string, number> = {};
    designs.forEach((d) => {
      byCategory[d.category] = (byCategory[d.category] ?? 0) + 1;
    });

    const byStatus: Record<string, number> = {};
    jobsService.statusFlow.forEach((s) => {
      byStatus[s] = 0;
    });
    jobs.forEach((j) => {
      byStatus[j.status] = (byStatus[j.status] ?? 0) + 1;
    });

    const topDesigns = [...designs].sort((a, b) => b.stitches - a.stitches).slice(0, 5);

    return { totalStitches, activeJobs, activeMachines, utilization, byCategory, byStatus, topDesigns };
  }, [designs, jobs, machines]);

  return (
    <ScreenContainer>
      <Text style={typography.pageTitle}>Analytics</Text>
      <Text style={[typography.body, styles.subtitle]}>
        Designs created, stitches produced and machine utilization at a glance.
      </Text>

      {loading || !totals ? (
        <View style={styles.grid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={110} borderRadius={radius.card} style={{ flexBasis: 200, flexGrow: 1 }} />
          ))}
        </View>
      ) : (
        <>
          <View style={styles.grid}>
            <StatCard
              label="Total designs"
              value={formatNumber(designs!.length)}
              icon={<FolderOpen size={18} color={colors.indigo} />}
            />
            <StatCard
              label="Stitches produced"
              value={formatNumber(totals.totalStitches)}
              icon={<Scissors size={18} color={colors.indigo} />}
            />
            <StatCard
              label="Active jobs"
              value={formatNumber(totals.activeJobs)}
              icon={<ClipboardList size={18} color={colors.indigo} />}
              accent={colors.warning}
            />
            <StatCard
              label="Machine utilization"
              value={`${totals.utilization}%`}
              icon={<Cpu size={18} color={colors.indigo} />}
              accent={colors.success}
            />
          </View>

          <View style={[styles.layout, isDesktop && styles.layoutDesktop]}>
            <Card style={[styles.panel, isDesktop && styles.panelDesktop]}>
              <Text style={[typography.h3, { marginBottom: spacing.md }]}>Designs by category</Text>
              {Object.entries(totals.byCategory).map(([cat, count]) => (
                <BarRow
                  key={cat}
                  label={cat.charAt(0).toUpperCase() + cat.slice(1)}
                  count={count}
                  total={designs!.length}
                  color={categoryColors[cat as Design['category']] ?? colors.indigo}
                />
              ))}
            </Card>

            <Card style={[styles.panel, isDesktop && styles.panelDesktop]}>
              <Text style={[typography.h3, { marginBottom: spacing.md }]}>Jobs by status</Text>
              {jobsService.statusFlow.map((status) => (
                <BarRow
                  key={status}
                  label={status}
                  count={totals.byStatus[status] ?? 0}
                  total={jobs!.length}
                  color={jobStatusColors[status]}
                />
              ))}
            </Card>
          </View>

          <View style={[styles.layout, isDesktop && styles.layoutDesktop, { marginTop: spacing.lg }]}>
            <Card style={[styles.panel, isDesktop && styles.panelDesktop]}>
              <Text style={[typography.h3, { marginBottom: spacing.md }]}>Top designs by stitch count</Text>
              {totals.topDesigns.map((d, i) => (
                <View key={d.id} style={[styles.rankRow, i === 0 && styles.rankRowFirst]}>
                  <Text style={[typography.bodySmall, styles.rankIndex]}>{i + 1}</Text>
                  <Text style={[typography.bodyMedium, { flex: 1 }]} numberOfLines={1}>
                    {d.name}
                  </Text>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                    {formatNumber(d.stitches)}
                  </Text>
                </View>
              ))}
            </Card>

            <Card style={[styles.panel, isDesktop && styles.panelDesktop]}>
              <Text style={[typography.h3, { marginBottom: spacing.md }]}>Machine roster</Text>
              {machines!.map((m, i) => (
                <View key={m.id} style={[styles.rankRow, i === 0 && styles.rankRowFirst]}>
                  <Text style={[typography.bodyMedium, { flex: 1 }]} numberOfLines={1}>
                    {m.name}
                  </Text>
                  <Badge label={m.status === 'active' ? 'Active' : 'Offline'} tone={m.status === 'active' ? 'success' : 'neutral'} dot />
                </View>
              ))}
            </Card>
          </View>
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
    maxWidth: 560,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  layout: {
    gap: spacing.lg,
  },
  layoutDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  panel: {},
  panelDesktop: {
    flex: 1,
  },
  barRow: {
    marginBottom: spacing.sm,
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gray100,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rankRowFirst: {
    borderTopWidth: 0,
  },
  rankIndex: {
    width: 18,
    color: colors.textTertiary,
  },
});
