import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Cpu, Plus, Power, Trash2, Layers } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useToast } from '@/components/ui/Toast';
import { machinesService } from '@/services/machines';
import type { Machine, StitchFormat } from '@/services/types';

const formats: StitchFormat[] = ['DST', 'PES', 'JEF', 'EXP', 'VP3', 'HUS'];

export default function MachineCenterScreen() {
  const { show } = useToast();
  const [machines, setMachines] = useState<Machine[] | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [format, setFormat] = useState<StitchFormat>('DST');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    machinesService.list().then(setMachines);
  }, []);

  const resetForm = () => {
    setName('');
    setBrand('');
    setModel('');
    setFormat('DST');
  };

  const handleAdd = async () => {
    if (!name.trim() || !brand.trim() || !model.trim()) {
      show('Please fill in machine name, brand and model.', 'error');
      return;
    }
    setSaving(true);
    try {
      const machine = await machinesService.create({
        name: name.trim(),
        brand: brand.trim(),
        model: model.trim(),
        defaultFormat: format,
        hoopSizes: ['100x100'],
      });
      setMachines((prev) => (prev ? [...prev, machine] : [machine]));
      show('Machine added to your center.', 'success');
      setSheetOpen(false);
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (id: string) => {
    setMachines(
      (prev) =>
        prev?.map((m) => (m.id === id ? { ...m, status: m.status === 'active' ? 'offline' : 'active' } : m)) ?? prev
    );
    await machinesService.toggleStatus(id);
  };

  const remove = async (id: string) => {
    setMachines((prev) => prev?.filter((m) => m.id !== id) ?? prev);
    await machinesService.remove(id);
    show('Machine removed.', 'success');
  };

  return (
    <ScreenContainer>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={typography.pageTitle}>Machine Center</Text>
          <Text style={[typography.body, styles.subtitle]}>
            Track every embroidery machine on your floor — status, hoop sizes and default export
            formats, all in one place.
          </Text>
        </View>
        <Button
          label="Add Machine"
          icon={<Plus size={16} color={colors.white} />}
          onPress={() => setSheetOpen(true)}
        />
      </View>

      {!machines ? (
        <View style={styles.grid}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={190} borderRadius={radius.card} style={{ flexBasis: 280, flexGrow: 1 }} />
          ))}
        </View>
      ) : machines.length === 0 ? (
        <EmptyState
          icon={<Cpu size={30} color={colors.indigo} />}
          title="No machines yet"
          description="Add your first embroidery machine to start tracking jobs and capacity."
          actionLabel="Add Machine"
          onAction={() => setSheetOpen(true)}
        />
      ) : (
        <View style={styles.grid}>
          {machines.map((m) => (
            <Card key={m.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.iconWrap}>
                  <Cpu size={20} color={colors.indigo} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={typography.cardTitle}>{m.name}</Text>
                  <Text style={[typography.caption, { color: colors.textTertiary }]}>
                    {m.brand} · {m.model}
                  </Text>
                </View>
                <Badge
                  label={m.status === 'active' ? 'Active' : 'Offline'}
                  tone={m.status === 'active' ? 'success' : 'neutral'}
                  dot
                />
              </View>

              <View style={styles.metaRow}>
                <Layers size={13} color={colors.textTertiary} />
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                  Default format {m.defaultFormat}
                  {m.needleCount ? ` · ${m.needleCount} needles` : ''}
                </Text>
              </View>

              <View style={styles.hoopRow}>
                {m.hoopSizes.map((h) => (
                  <Badge key={h} label={h} tone="neutral" />
                ))}
              </View>

              {m.notes ? (
                <Text style={[typography.bodySmall, styles.notes]} numberOfLines={2}>
                  {m.notes}
                </Text>
              ) : null}

              <View style={styles.cardFooter}>
                <Pressable style={styles.footerAction} onPress={() => toggleStatus(m.id)}>
                  <Power size={15} color={colors.textSecondary} />
                  <Text style={styles.footerActionLabel}>
                    {m.status === 'active' ? 'Set Offline' : 'Set Active'}
                  </Text>
                </Pressable>
                <Pressable style={styles.footerAction} onPress={() => remove(m.id)}>
                  <Trash2 size={15} color={colors.danger} />
                  <Text style={[styles.footerActionLabel, { color: colors.danger }]}>Remove</Text>
                </Pressable>
              </View>
            </Card>
          ))}
        </View>
      )}

      <BottomSheet
        visible={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          resetForm();
        }}
        title="Add a Machine"
      >
        <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
          <Input label="Machine name" placeholder="e.g. Ricoma MT-1501" value={name} onChangeText={setName} />
          <Input label="Brand" placeholder="e.g. Ricoma" value={brand} onChangeText={setBrand} />
          <Input label="Model" placeholder="e.g. MT-1501" value={model} onChangeText={setModel} />
          <View>
            <Text style={[typography.bodySmall, styles.propLabel]}>Default format</Text>
            <View style={styles.formatRow}>
              {formats.map((f) => (
                <Pressable
                  key={f}
                  onPress={() => setFormat(f)}
                  style={[styles.formatChip, format === f && styles.formatChipActive]}
                >
                  <Text
                    style={[
                      typography.bodySmall,
                      { color: format === f ? colors.white : colors.textSecondary },
                    ]}
                  >
                    {f}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Button label="Add Machine" onPress={handleAdd} loading={saving} fullWidth />
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
  card: {
    flexBasis: 300,
    flexGrow: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.indigoTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  hoopRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  notes: {
    color: colors.textTertiary,
    marginBottom: spacing.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  footerActionLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontFamily: typography.bodySmall.fontFamily,
  },
  propLabel: {
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  formatRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  formatChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.gray100,
  },
  formatChipActive: {
    backgroundColor: colors.indigo,
  },
});
