import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Plus, ArrowRight, Calendar, Cpu, User } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useToast } from '@/components/ui/Toast';
import { useResponsive } from '@/hooks/useResponsive';
import { jobsService } from '@/services/jobs';
import { machinesService } from '@/services/machines';
import type { JobStatus, ProductionJob } from '@/services/types';

const statusTone: Record<JobStatus, 'neutral' | 'info' | 'warning' | 'success'> = {
  Pending: 'neutral',
  Digitized: 'info',
  Stitching: 'warning',
  Completed: 'success',
};

function JobCard({ job, onAdvance }: { job: ProductionJob; onAdvance: () => void }) {
  const isLast = job.status === 'Completed';
  return (
    <Card style={styles.jobCard}>
      <View style={styles.jobCardHeader}>
        <Text style={typography.cardTitle} numberOfLines={1}>
          {job.design}
        </Text>
        <Badge label={job.status} tone={statusTone[job.status]} dot />
      </View>
      <View style={styles.metaRow}>
        <User size={13} color={colors.textTertiary} />
        <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{job.customer}</Text>
      </View>
      <Text style={[typography.bodySmall, { color: colors.textSecondary, marginBottom: 4 }]}>
        {job.quantity}
      </Text>
      <View style={styles.metaRow}>
        <Calendar size={13} color={colors.textTertiary} />
        <Text style={[typography.caption, { color: colors.textTertiary }]}>Due {job.dueDate}</Text>
      </View>
      <View style={styles.metaRow}>
        <Cpu size={13} color={colors.textTertiary} />
        <Text style={[typography.caption, { color: colors.textTertiary }]}>{job.machine}</Text>
      </View>
      {!isLast && (
        <Pressable style={styles.advanceBtn} onPress={onAdvance}>
          <Text style={styles.advanceLabel}>Move to next stage</Text>
          <ArrowRight size={14} color={colors.indigo} />
        </Pressable>
      )}
    </Card>
  );
}

export default function JobsScreen() {
  const { show } = useToast();
  const { isDesktop } = useResponsive();
  const [jobs, setJobs] = useState<ProductionJob[] | null>(null);
  const [machineNames, setMachineNames] = useState<string[]>([]);
  const [mobileFilter, setMobileFilter] = useState<JobStatus>('Pending');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [customer, setCustomer] = useState('');
  const [design, setDesign] = useState('');
  const [quantity, setQuantity] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [machine, setMachine] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    jobsService.list().then(setJobs);
    machinesService.list().then((list) => setMachineNames(list.map((m) => m.name)));
  }, []);

  const columns = jobsService.statusFlow;

  const grouped = useMemo(() => {
    const map: Record<JobStatus, ProductionJob[]> = { Pending: [], Digitized: [], Stitching: [], Completed: [] };
    jobs?.forEach((j) => map[j.status].push(j));
    return map;
  }, [jobs]);

  const advance = async (id: string) => {
    const updated = await jobsService.advanceStatus(id);
    if (updated) {
      setJobs((prev) => prev?.map((j) => (j.id === id ? updated : j)) ?? prev);
      show(`Job moved to "${updated.status}".`, 'success');
    }
  };

  const resetForm = () => {
    setCustomer('');
    setDesign('');
    setQuantity('');
    setDueDate('');
    setMachine('');
  };

  const handleCreate = async () => {
    if (!customer.trim() || !design.trim() || !quantity.trim() || !dueDate.trim() || !machine.trim()) {
      show('Please fill in every field to create a job.', 'error');
      return;
    }
    setSaving(true);
    try {
      const job = await jobsService.create({
        customer: customer.trim(),
        design: design.trim(),
        quantity: quantity.trim(),
        dueDate: dueDate.trim(),
        machine: machine.trim(),
      });
      setJobs((prev) => (prev ? [job, ...prev] : [job]));
      show('New production job created.', 'success');
      setSheetOpen(false);
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={typography.pageTitle}>Production Jobs</Text>
          <Text style={[typography.body, styles.subtitle]}>
            Track every order from pending to completed across your machines.
          </Text>
        </View>
        <Button label="New Job" icon={<Plus size={16} color={colors.white} />} onPress={() => setSheetOpen(true)} />
      </View>

      {!jobs ? (
        <View style={styles.grid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height={220} borderRadius={radius.card} style={{ flexBasis: 260, flexGrow: 1 }} />
          ))}
        </View>
      ) : jobs.length === 0 ? (
        <EmptyState title="No jobs yet" description="Create your first production job to get started." />
      ) : isDesktop ? (
        <View style={styles.board}>
          {columns.map((status) => (
            <View key={status} style={styles.column}>
              <View style={styles.columnHeader}>
                <Text style={typography.h3}>{status}</Text>
                <Badge label={String(grouped[status].length)} tone={statusTone[status]} />
              </View>
              <View style={{ gap: spacing.md }}>
                {grouped[status].length === 0 ? (
                  <Text style={[typography.bodySmall, { color: colors.textTertiary }]}>No jobs</Text>
                ) : (
                  grouped[status].map((job) => (
                    <JobCard key={job.id} job={job} onAdvance={() => advance(job.id)} />
                  ))
                )}
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View>
          <View style={{ marginBottom: spacing.lg }}>
            <SegmentedControl
              value={mobileFilter}
              onChange={(v) => setMobileFilter(v as JobStatus)}
              options={columns.map((c) => ({ label: `${c} (${grouped[c].length})`, value: c }))}
            />
          </View>
          <View style={{ gap: spacing.md }}>
            {grouped[mobileFilter].length === 0 ? (
              <EmptyState title="No jobs here" description={`No jobs are currently in "${mobileFilter}".`} />
            ) : (
              grouped[mobileFilter].map((job) => (
                <JobCard key={job.id} job={job} onAdvance={() => advance(job.id)} />
              ))
            )}
          </View>
        </View>
      )}

      <BottomSheet
        visible={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          resetForm();
        }}
        title="New Production Job"
      >
        <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
          <Input label="Customer" placeholder="e.g. Musa Garba" value={customer} onChangeText={setCustomer} />
          <Input label="Design" placeholder="e.g. Company Logo" value={design} onChangeText={setDesign} />
          <Input label="Quantity" placeholder="e.g. 25 Polo Shirts" value={quantity} onChangeText={setQuantity} />
          <Input label="Due date" placeholder="e.g. May 3, 2026" value={dueDate} onChangeText={setDueDate} />
          <View>
            <Text style={[typography.bodySmall, styles.propLabel]}>Machine</Text>
            <View style={styles.chipRow}>
              {machineNames.map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setMachine(m)}
                  style={[styles.chip, machine === m && styles.chipActive]}
                >
                  <Text style={[typography.bodySmall, { color: machine === m ? colors.white : colors.textSecondary }]}>
                    {m}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Button label="Create Job" onPress={handleCreate} loading={saving} fullWidth />
        </View>
      </BottomSheet>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  subtitle: {
    color: colors.textSecondary,
    marginTop: spacing.xs,
    maxWidth: 520,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  board: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignItems: 'flex-start',
  },
  column: {
    flex: 1,
    minWidth: 240,
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  jobCard: {
    gap: 4,
  },
  jobCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  advanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  advanceLabel: {
    fontSize: 13,
    color: colors.indigo,
    fontFamily: typography.bodyMedium.fontFamily,
  },
  propLabel: {
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.gray100,
  },
  chipActive: {
    backgroundColor: colors.indigo,
  },
});
