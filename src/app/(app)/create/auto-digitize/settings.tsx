import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Shirt, Ruler, Layers, Palette, Plus, Repeat, Trash2, Grid3x3 } from 'lucide-react-native';
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
  DENSITY_CROSS_CELL_MM,
  DENSITY_FILL_SPACING_MM,
  DENSITY_STITCH_LENGTH_MM,
  digitizingService,
  mmToUnit,
  resolveBorderWidthMm,
  unitToMm,
  type BorderMode,
  type DesignSize,
  type FabricType,
  type Placement,
  type SizeUnit,
  type StitchStyle,
} from '@/services/digitizing';
import { threadsService } from '@/services/threads';
import type { ThreadColor } from '@/services/types';
import { analyzeImageViaBackend } from '@/services/digitizing/backendClient';
import { generateRealStitchPlan, summarizePoints } from '@/utils/stitchPlanner';

const stitchStyles: { label: string; value: StitchStyle }[] = [
  { label: 'Fill', value: 'fill' },
  { label: 'Cross-Stitch', value: 'cross' },
];

const borderModes: { label: string; value: BorderMode }[] = [
  { label: 'Auto', value: 'auto' },
  { label: 'Off', value: 'off' },
  { label: 'Custom', value: 'custom' },
];

const MIN_BORDER_WIDTH_MM = 0.4;
const MAX_BORDER_WIDTH_MM = 3;

const placements: Placement[] = ['Left Chest', 'Center Front', 'Full Back', 'Sleeve', 'Cap Front', 'Custom'];
const fabrics: FabricType[] = ['Cotton Twill', 'Denim', 'Fleece', 'Leather', 'Knit / Jersey', 'Custom'];
const unitOptions: { label: string; value: SizeUnit }[] = [
  { label: 'mm', value: 'mm' },
  { label: 'cm', value: 'cm' },
  { label: 'in', value: 'in' },
];

function borderBadgeLabel(mode: BorderMode, customWidthMm: number): string {
  if (mode === 'off') return 'Off';
  if (mode === 'custom') return `${customWidthMm.toFixed(1)}mm`;
  return 'Auto';
}

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
    setThreadColors,
    addThreadColor,
    removeThreadColor,
    replaceThreadColor,
    setStitchPlan,
    setDstPoints,
    removeBackground,
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
    try {
      // Real digitizing, preferred path: the actual stitchpro-backend
      // engine (digitizer/pipeline.py) -- real background/material
      // removal (works on a photographed design on a real garment, not
      // just flat artwork), adaptive curve smoothing, a genuinely solid
      // fill (or a real cross-stitch grid, if selected), not an estimate.
      // Every screen downstream (preview stats, the actual downloadable
      // file in success.tsx) reads from the same `dstPoints`/`stitchPlan`
      // this sets, so picking the backend here is what makes the *real
      // exported file* benefit from all of that, not just a preview.
      const densityMm = settings.stitchStyle === 'cross'
        ? DENSITY_CROSS_CELL_MM[settings.density]
        : DENSITY_FILL_SPACING_MM[settings.density];
      const backendResult = artwork?.uri
        ? await analyzeImageViaBackend(artwork.uri, settings.widthMm, settings.heightMm, {
            maxColors: 6,
            stitchStyle: settings.stitchStyle,
            angleDeg: settings.angleDeg,
            densityMm,
            stitchLengthMm: DENSITY_STITCH_LENGTH_MM[settings.density],
            borderWidthMm: resolveBorderWidthMm(settings),
            removeBackground,
          })
        : null;

      if (backendResult) {
        const summary = summarizePoints(backendResult.points, backendResult.widthMm, backendResult.heightMm);
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
        if (backendResult.threads.length) setThreadColors(backendResult.threads);
        setGenerating(false);
        router.push('/create/auto-digitize/preview');
        return;
      }

      // Fallback: the backend is unreachable/disabled/timed out, or found
      // no detectable foreground. Keeps the wizard usable with zero
      // backend configured -- the legacy client-only pipeline (real, just
      // a simpler pixel-row fill scan, no background removal/smoothing/
      // cross-stitch) still produces a genuinely stitchable, downloadable
      // design either way.
      const palette = threadColors.length ? threadColors : (analysis?.dominantColors ?? ['#5B4FE8']);
      const real = await generateRealStitchPlan(
        artwork?.uri,
        palette,
        settings.widthMm,
        settings.heightMm,
        settings.density
      );
      setStitchPlan({
        stitches: real.stitches,
        colors: real.colors,
        estimatedThreadMeters: real.estimatedThreadMeters,
        estimatedTimeMinutes: real.estimatedTimeMinutes,
        threadChanges: real.threadChanges,
        jumps: real.jumps,
        trims: real.trims,
        sizeMm: real.sizeMm,
      });
      setDstPoints(real.points);
    } catch {
      // Last-resort fallback only if real generation can't run at all
      // (e.g. image failed to decode) — keeps the wizard usable, but this
      // path produces no real downloadable file, so success.tsx must
      // handle a missing dstPoints.
      const plan = await digitizingService.generateStitchPlan(settings, analysis ?? undefined);
      setStitchPlan(plan);
    }
    setGenerating(false);
    router.push('/create/auto-digitize/preview');
  };

  // Which of the two actually-selectable Stitch Type chips the analysis
  // recommends, plus anything else it recommends that isn't a selectable
  // chip at all (Satin is auto-applied per-region by the pipeline itself,
  // not a top-level style toggle; Running/Appliqué aren't implemented
  // stitch types yet -- see the stitch-type research). Previously this was
  // its own separate "Recommended Stitch Types" card at the bottom of the
  // whole screen, disconnected from the actual Stitch Type picker above --
  // moved inline here so the recommendation shows up exactly where the
  // decision is actually made, instead of needing to scroll down and
  // mentally map a badge list back up to the real choice.
  const recommendedStitchStyleSet = useMemo(() => {
    const recommended = (analysis?.recommendedStitchTypes ?? []).map((t) => t.toLowerCase());
    const set = new Set<StitchStyle>();
    for (const s of stitchStyles) {
      const matchesLabel = s.label.toLowerCase().replace(/[^a-z]/g, '');
      if (recommended.some((r) => r.replace(/[^a-z]/g, '') === matchesLabel || r === s.value)) {
        set.add(s.value);
      }
    }
    return set;
  }, [analysis]);

  const otherRecommendedTechniques = useMemo(() => {
    const selectableLabels = new Set(stitchStyles.map((s) => s.label.toLowerCase()));
    return (analysis?.recommendedStitchTypes ?? []).filter((t) => !selectableLabels.has(t.toLowerCase()));
  }, [analysis]);

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
          <SectionLabel icon={Grid3x3} label="Stitch Type" />
          <Text style={[typography.bodySmall, styles.threadHint]}>
            Fill (tatami rows) suits most logos and graphics. Cross-Stitch lays down a grid of X's instead —
            better for a deliberately pixelated or sampler-style design.
          </Text>
          <View style={styles.chipRow}>
            {stitchStyles.map((s) => (
              <Chip
                key={s.value}
                label={s.label}
                active={settings.stitchStyle === s.value}
                onPress={() => updateSettings({ stitchStyle: s.value })}
                recommended={recommendedStitchStyleSet.has(s.value)}
              />
            ))}
          </View>
          {otherRecommendedTechniques.length > 0 && (
            <Text style={[typography.caption, styles.recommendedNote]}>
              Based on this artwork, StitchPro also automatically applies{' '}
              {otherRecommendedTechniques.join(' and ')} where it helps (e.g. clean satin edges on thin
              detail) — no separate selection needed.
            </Text>
          )}

          <View style={styles.densityHeaderRow}>
            <Text style={[typography.bodySmall, styles.subLabel]}>Stitch Angle</Text>
            <Badge label={`${Math.round(settings.angleDeg)}°`} tone="indigo" />
          </View>
          <Slider
            value={settings.angleDeg}
            min={0}
            max={179}
            step={1}
            onValueChange={(v) => updateSettings({ angleDeg: v })}
            accessibilityLabel="Stitch angle"
          />

          <View style={styles.densityHeaderRow}>
            <Text style={[typography.bodySmall, styles.subLabel]}>Edge Border</Text>
            <Badge label={borderBadgeLabel(settings.borderMode, settings.borderWidthMm)} tone="indigo" />
          </View>
          <Text style={[typography.bodySmall, styles.threadHint]}>
            Traces a clean satin outline around every region&apos;s edge (and any holes) on top of the fill — hides the
            staircase edge a scanline fill leaves no matter how dense it is. Auto adds it for Fill, skips it for
            Cross-Stitch (which already has its own clean grid edge).
          </Text>
          <View style={styles.chipRow}>
            {borderModes.map((m) => (
              <Chip
                key={m.value}
                label={m.label}
                active={settings.borderMode === m.value}
                onPress={() => updateSettings({ borderMode: m.value })}
              />
            ))}
          </View>
          {settings.borderMode === 'custom' && (
            <View style={{ marginTop: spacing.sm }}>
              <Slider
                value={settings.borderWidthMm}
                min={MIN_BORDER_WIDTH_MM}
                max={MAX_BORDER_WIDTH_MM}
                step={0.1}
                onValueChange={(v) => updateSettings({ borderWidthMm: v })}
                accessibilityLabel="Border width"
              />
            </View>
          )}
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

function Chip({
  label,
  active,
  onPress,
  recommended,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  recommended?: boolean;
}) {
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
      {recommended && (
        <View style={[styles.recommendedBadge, active && styles.recommendedBadgeActive]}>
          <Text style={[typography.tiny, styles.recommendedBadgeText, active && styles.recommendedBadgeTextActive]}>
            Recommended
          </Text>
        </View>
      )}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: colors.gray100,
  },
  chipActive: {
    backgroundColor: colors.indigo,
  },
  recommendedBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    borderRadius: radius.pill,
    backgroundColor: colors.indigo + '22',
  },
  recommendedBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  recommendedBadgeText: {
    color: colors.indigo,
    fontFamily: typography.bodyMedium.fontFamily,
  },
  recommendedBadgeTextActive: {
    color: colors.white,
  },
  recommendedNote: {
    color: colors.textTertiary,
    marginTop: spacing.sm,
    fontStyle: 'italic',
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
