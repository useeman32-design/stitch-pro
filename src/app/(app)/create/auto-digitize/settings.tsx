import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Shirt, Ruler, Layers, Palette } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Input } from '@/components/ui/Input';
import { ColorSwatch } from '@/components/ui/ColorSwatch';
import { WizardStepHeader } from '@/components/create/WizardStepHeader';
import { WizardFooter } from '@/components/create/WizardFooter';
import { useDigitizeWizard } from '@/contexts/DigitizeWizardContext';
import {
  digitizingService,
  type DesignSize,
  type FabricType,
  type Placement,
  type StitchDensity,
} from '@/services/digitizing';
import { threadsService } from '@/services/threads';
import type { ThreadColor } from '@/services/types';

const placements: Placement[] = ['Left Chest', 'Center Front', 'Full Back', 'Sleeve', 'Cap Front'];
const fabrics: FabricType[] = ['Cotton Twill', 'Denim', 'Fleece', 'Leather', 'Knit / Jersey'];

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
  const { artwork, analysis, settings, updateSettings, setStitchPlan } = useDigitizeWizard();
  const [threads, setThreads] = useState<ThreadColor[]>([]);
  const [generating, setGenerating] = useState(false);

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

  const handleGenerate = async () => {
    setGenerating(true);
    const plan = await digitizingService.generateStitchPlan(settings, analysis ?? undefined);
    setStitchPlan(plan);
    setGenerating(false);
    router.push('/create/auto-digitize/preview');
  };

  const dominantColors = analysis?.dominantColors ?? [];

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
        </Card>

        <Card>
          <SectionLabel icon={Ruler} label="Design Size" />
          <SegmentedControl
            options={[
              { label: 'Small', value: 'Small' },
              { label: 'Medium', value: 'Medium' },
              { label: 'Large', value: 'Large' },
              { label: 'Custom', value: 'Custom' },
            ]}
            value={settings.size}
            onChange={(v) => handleSizePreset(v as DesignSize)}
          />
          {settings.size === 'Custom' ? (
            <View style={styles.customSizeRow}>
              <View style={styles.customSizeInput}>
                <Input
                  label="Width (mm)"
                  keyboardType="numeric"
                  value={String(settings.widthMm)}
                  onChangeText={(t) => updateSettings({ widthMm: Number(t.replace(/[^0-9]/g, '')) || 0 })}
                />
              </View>
              <View style={styles.customSizeInput}>
                <Input
                  label="Height (mm)"
                  keyboardType="numeric"
                  value={String(settings.heightMm)}
                  onChangeText={(t) => updateSettings({ heightMm: Number(t.replace(/[^0-9]/g, '')) || 0 })}
                />
              </View>
            </View>
          ) : (
            <Text style={[typography.caption, styles.sizeHint]}>
              {settings.widthMm} × {settings.heightMm} mm
            </Text>
          )}
        </Card>

        <Card>
          <SectionLabel icon={Layers} label="Fabric Type" />
          <View style={styles.chipRow}>
            {fabrics.map((f) => (
              <Chip key={f} label={f} active={settings.fabric === f} onPress={() => updateSettings({ fabric: f })} />
            ))}
          </View>

          <Text style={[typography.bodySmall, styles.subLabel]}>Stitch Density</Text>
          <SegmentedControl
            options={[
              { label: 'Light', value: 'Light' },
              { label: 'Standard', value: 'Standard' },
              { label: 'Dense', value: 'Dense' },
            ]}
            value={settings.density}
            onChange={(v) => updateSettings({ density: v as StitchDensity })}
          />
        </Card>

        {dominantColors.length > 0 && (
          <Card>
            <SectionLabel icon={Palette} label="Thread Colors" />
            <Text style={[typography.bodySmall, styles.threadHint]}>
              Detected colors have been matched to the closest thread in your library.
            </Text>
            <View style={{ gap: spacing.sm }}>
              {dominantColors.map((hex, i) => {
                const match = closestThread(hex, threads);
                return (
                  <ColorSwatch
                    key={`${hex}-${i}`}
                    hex={hex}
                    label={match ? `${match.brand} ${match.code} — ${match.name}` : hex}
                    sublabel={`Color ${i + 1}`}
                  />
                );
              })}
            </View>
          </Card>
        )}

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
  customSizeRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  customSizeInput: {
    flex: 1,
  },
  sizeHint: {
    color: colors.textTertiary,
    marginTop: spacing.sm,
  },
  subLabel: {
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  threadHint: {
    color: colors.textTertiary,
    marginBottom: spacing.sm,
  },
});
