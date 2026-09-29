import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Shirt, Ruler, Layers, Palette, Plus, Repeat, Trash2 } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Slider } from '@/components/ui/Slider';
import { Dropdown } from '@/components/ui/Dropdown';
import { ColorSwatch } from '@/components/ui/ColorSwatch';
import { ThreadColorModal } from '@/components/create/ThreadColorModal';
import { WizardStepHeader } from '@/components/create/WizardStepHeader';
import { WizardFooter } from '@/components/create/WizardFooter';
import { useDigitizeWizard } from '@/contexts/DigitizeWizardContext';
import {
  digitizingService,
  mmToUnit,
  unitToMm,
  type DesignSize,
  type FabricType,
  type Placement,
  type SizeUnit,
} from '@/services/digitizing';
import { threadsService } from '@/services/threads';
import type { ThreadColor } from '@/services/types';

const placements: Placement[] = ['Left Chest', 'Center Front', 'Full Back', 'Sleeve', 'Cap Front', 'Custom'];
const fabrics: FabricType[] = ['Cotton Twill', 'Denim', 'Fleece', 'Leather', 'Knit / Jersey', 'Custom'];
const unitOptions: { label: string; value: SizeUnit }[] = [
  { label: 'mm', value: 'mm' },
  { label: 'cm', value: 'cm' },
  { label: 'in', value: 'in' },
];

function closestThread(hex: string, threads: ThreadColor[]): ThreadColor | undefined {
  const toRgb = (h: string) => {
    const c = h.replace('#', '');
    return [parseInt(c.substring(0, 2), 16), parseInt(c.substring(2, 4), 16), parseInt(c.substring(4, 6), 16)];
  };
  const [r, g, b] = toRgb(hex);
  let best: ThreadColor | undefined;
  let bestDist = Infinity;
  for (const t of threads) {
    const [tr, tg, tb] = toRgb(t.hex);
    const dist = (r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = t;
    }
  }
  return best;
}

export default function DesignSettingsScreen() {
  const router = useRouter();
  const {
    artwork,
    analysis,
    settings,
    updateSettings,
    threadColors,
    addThreadColor,
    removeThreadColor,
    replaceThreadColor,
    setStitchPlan,
  } = useDigitizeWizard();
  const [threads, setThreads] = useState<ThreadColor[]>([]);
  const [generating, setGenerating] = useState(false);
  const [colorModal, setColorModal] = useState<{ mode: 'add' | 'replace'; index?: number } | null>(null);

  useEffect(() => {
    if (!artwork) {
      router.replace('/create/auto-digitize');
      return;
    }
    threadsService.list().then(setThreads);
  }, [artwork]);

  const handleSizePreset = (size: DesignSize) => {
    if (size === 'Custom') {
      updateSettings({ size });
      return;
    }
    const preset = digitizingService.sizePresets[size];
    updateSettings({ size, widthMm: preset.width, heightMm: preset.height });
  };

  const widthDisplay = mmToUnit(settings.widthMm, settings.sizeUnit);
  const heightDisplay = mmToUnit(settings.heightMm, settings.sizeUnit);

  const handleWidthChange = (text: string) => {
    const n = Number(text.replace(/[^0-9.]/g, '')) || 0;
    updateSettings({ widthMm: unitToMm(n, settings.sizeUnit), size: 'Custom' });
  };
  const handleHeightChange = (text: string) => {
    const n = Number(text.replace(/[^0-9.]/g, '')) || 0;
    updateSettings({ heightMm: unitToMm(n, settings.sizeUnit), size: 'Custom' });
  };
  const handleUnitChange = (unit: SizeUnit) => {
    updateSettings({ sizeUnit: unit });
  };

  const handleGenerate = async () => {
    setGenerating(true);
    const plan = await digitizingService.generateStitchPlan(settings, analysis ?? undefined);
    setStitchPlan(plan);
    setGenerating(false);
    router.push('/create/auto-digitize/preview');
  };

  const openAddColor = () => setColorModal({ mode: 'add' });
  const openReplaceColor = (index: number) => setColorModal({ mode: 'replace', index });

  const handleModalConfirm = (hex: string) => {
    if (colorModal?.mode === 'add') {
      addThreadColor(hex);
    } else if (colorModal?.mode === 'replace' && colorModal.index !== undefined) {
      replaceThreadColor(colorModal.index, hex);
    }
  };

  return (
    <ScreenContainer>
      <WizardStepHeader
        title="Design Settings"
        subtitle="Tell StitchPro where this design is going and how it should be stitched. You can fine-tune everything later."
        currentIndex={1}
      />

      <View style={styles.stack}>
        <Card>
          <SectionLabel icon={Shirt} label="Placement" />
          <View style={styles.chipRow}>
            {placements.map((p) => (
              <Chip key={p} label={p} active={settings.placement === p} onPress={() => updateSettings({ placement: p })} />
            ))}
          </View>
          {settings.placement === 'Custom' && (
            <Input
              placeholder="Describe the placement (e.g. Inside Collar)"
              value={settings.customPlacement}
              onChangeText={(t) => updateSettings({ customPlacement: t })}
              style={{ marginTop: spacing.sm }}
            />
          )}
        </Card>

        <Card>
          <SectionLabel icon={Ruler} label="Design Size" />
          <View style={styles.chipRow}>
            {(['Small', 'Medium', 'Large', 'Custom'] as DesignSize[]).map((s) => (
              <Chip key={s} label={s} active={settings.size === s} onPress={() => handleSizePreset(s)} />
            ))}
          </View>

          <View style={styles.sizeInputRow}>
            <View style={styles.sizeInput}>
              <Input
                label={`Width (${settings.sizeUnit})`}
                keyboardType="numeric"
                value={String(widthDisplay)}
                onChangeText={handleWidthChange}
              />
            </View>
            <Text style={styles.sizeTimes}>×</Text>
            <View style={styles.sizeInput}>
              <Input
                label={`Height (${settings.sizeUnit})`}
                keyboardType="numeric"
                value={String(heightDisplay)}
                onChangeText={handleHeightChange}
              />
            </View>
            <View style={styles.unitDropdownWrap}>
              <Text style={[typography.bodySmall, styles.label]}>Unit</Text>
              <Dropdown value={settings.sizeUnit} options={unitOptions} onChange={handleUnitChange} width={76} />
            </View>
          </View>
        </Card>

        <Card>
          <SectionLabel icon={Layers} label="Fabric Type" />
          <View style={styles.chipRow}>
            {fabrics.map((f) => (
              <Chip key={f} label={f} active={settings.fabric === f} onPress={() => updateSettings({ fabric: f })} />
            ))}
          </View>
          {settings.fabric === 'Custom' && (
            <Input
              placeholder="Describe the fabric (e.g. Ripstop Nylon)"
              value={settings.customFabric}
              onChangeText={(t) => updateSettings({ customFabric: t })}
              style={{ marginTop: spacing.sm }}
            />
          )}

          <View style={styles.densityHeaderRow}>
            <Text style={[typography.bodySmall, styles.subLabel]}>Stitch Density</Text>
            <Badge label={`${settings.density} · ${Math.round(settings.densityPercent)}%`} tone="indigo" />
          </View>
          <Slider
            value={settings.densityPercent}
            min={0}
            max={100}
            step={1}
            onValueChange={(v) => updateSettings({ densityPercent: v })}
            accessibilityLabel="Stitch density"
          />
          <View style={styles.densityScaleRow}>
            <Text style={[typography.caption, { color: colors.textTertiary }]}>Light</Text>
            <Text style={[typography.caption, { color: colors.textTertiary }]}>Standard</Text>
            <Text style={[typography.caption, { color: colors.textTertiary }]}>Dense</Text>
          </View>
        </Card>

        <Card>
          <SectionLabel icon={Palette} label="Thread Colors" />
          <Text style={[typography.bodySmall, styles.threadHint]}>
            Detected from your artwork and matched to the closest thread in your library. Add, remove, or
            replace any color below.
          </Text>
          <View style={{ gap: spacing.sm }}>
            {threadColors.map((hex, i) => {
              const match = closestThread(hex, threads);
              return (
                <View key={`${hex}-${i}`} style={styles.threadRow}>
                  <View style={{ flex: 1 }}>
                    <ColorSwatch
                      hex={hex}
                      label={match ? `${match.brand} ${match.code} — ${match.name}` : hex}
                      sublabel={`Color ${i + 1}`}
                    />
                  </View>
                  <Pressable
                    onPress={() => openReplaceColor(i)}
                    style={styles.threadAction}
                    accessibilityLabel="Replace color"
                    hitSlop={6}
                  >
                    <Repeat size={15} color={colors.textSecondary} />
                  </Pressable>
                  <Pressable
                    onPress={() => removeThreadColor(i)}
                    style={styles.threadAction}
                    accessibilityLabel="Remove color"
                    hitSlop={6}
                  >
                    <Trash2 size={15} color={colors.danger} />
                  </Pressable>
                </View>
              );
            })}
          </View>
          <Pressable onPress={openAddColor} style={styles.addColorBtn}>
            <Plus size={15} color={colors.indigo} />
            <Text style={[typography.bodySmall, { color: colors.indigo, fontFamily: typography.bodyMedium.fontFamily }]}>
              Add Color
            </Text>
          </Pressable>
        </Card>

        {analysis?.recommendedStitchTypes?.length ? (
          <Card>
            <SectionLabel icon={Layers} label="Recommended Stitch Types" />
            <View style={styles.chipRow}>
              {analysis.recommendedStitchTypes.map((t) => (
                <Badge key={t} label={t} tone="indigo" />
              ))}
            </View>
          </Card>
        ) : null}
      </View>

      <WizardFooter
        onBack={() => router.back()}
        continueLabel="Generate Preview"
        continueLoading={generating}
        onContinue={handleGenerate}
      />

      <ThreadColorModal
        visible={!!colorModal}
        mode={colorModal?.mode ?? 'add'}
        initialHex={colorModal?.mode === 'replace' && colorModal.index !== undefined ? threadColors[colorModal.index] : undefined}
        onClose={() => setColorModal(null)}
        onConfirm={handleModalConfirm}
      />
    </ScreenContainer>
  );
}

function SectionLabel({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <View style={styles.sectionLabelRow}>
      <Icon size={16} color={colors.indigo} />
      <Text style={[typography.cardTitle, { color: colors.textPrimary }]}>{label}</Text>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text
        style={[
          typography.bodySmall,
          { color: active ? colors.white : colors.textSecondary },
          active && { fontFamily: typography.bodyMedium.fontFamily },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.gray100,
  },
  chipActive: {
    backgroundColor: colors.indigo,
  },
  sizeInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  sizeInput: {
    flex: 1,
  },
  sizeTimes: {
    color: colors.textTertiary,
    paddingBottom: 10,
  },
  unitDropdownWrap: {
    gap: spacing.xs,
  },
  label: {
    color: colors.textPrimary,
    fontFamily: typography.bodyMedium.fontFamily,
  },
  subLabel: {
    color: colors.textSecondary,
  },
  densityHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  densityScaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xxs,
  },
  threadHint: {
    color: colors.textTertiary,
    marginBottom: spacing.sm,
  },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  threadAction: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addColorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.button,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.indigo,
  },
});
