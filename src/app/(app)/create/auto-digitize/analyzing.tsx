import React, { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressCircle } from '@/components/ui/ProgressCircle';
import { ColorSwatch } from '@/components/ui/ColorSwatch';
import { WizardStepHeader } from '@/components/create/WizardStepHeader';
import { WizardFooter } from '@/components/create/WizardFooter';
import { useDigitizeWizard } from '@/contexts/DigitizeWizardContext';
import { digitizingService } from '@/services/digitizing';

const ANALYSIS_STEPS = [
  'Reading image',
  'Detecting colors',
  'Identifying objects',
  'Mapping stitch types',
  'Finalizing analysis',
];

const STEP_DURATION_MS = 620;

export default function AnalyzingArtworkScreen() {
  const router = useRouter();
  const { artwork, analysis, setAnalysis } = useDigitizeWizard();
  const [stepIndex, setStepIndex] = useState(0);
  const [done, setDone] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!artwork) {
      router.replace('/create/auto-digitize');
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    const advance = (index: number) => {
      if (cancelled) return;
      setStepIndex(index);
      if (index < ANALYSIS_STEPS.length - 1) {
        setTimeout(() => advance(index + 1), STEP_DURATION_MS);
      } else {
        setTimeout(async () => {
          const result = await digitizingService.analyzeArtwork(artwork.uri);
          if (!cancelled) {
            setAnalysis(result);
            setDone(true);
          }
        }, STEP_DURATION_MS);
      }
    };
    advance(0);

    return () => {
      cancelled = true;
    };
  }, [artwork]);

  const progress = done ? 1 : (stepIndex + 0.5) / ANALYSIS_STEPS.length;
  const artworkSource =
    artwork?.source === 'upload'
      ? { uri: artwork.uri }
      : require('@/assets/embroidery/lion-patch.png');

  return (
    <ScreenContainer>
      <WizardStepHeader
        title="Auto Digitize"
        subtitle="Sit tight — StitchPro is analyzing your artwork to plan colors, objects and stitch types."
        currentIndex={0}
      />

      <Card style={styles.card}>
        <View style={styles.topRow}>
          <View style={styles.progressWrap}>
            <ProgressCircle
              progress={progress}
              size={104}
              strokeWidth={10}
              label={`${Math.round(progress * 100)}%`}
              sublabel={done ? 'Complete' : 'Analyzing'}
            />
          </View>
          <View style={styles.checklist}>
            {ANALYSIS_STEPS.map((label, i) => {
              const isDone = done || i < stepIndex;
              const isActive = !done && i === stepIndex;
              return (
                <View key={label} style={styles.checkRow}>
                  <View
                    style={[
                      styles.checkDot,
                      isDone && styles.checkDotDone,
                      isActive && styles.checkDotActive,
                    ]}
                  >
                    {isDone && <Check size={12} color={colors.white} strokeWidth={3} />}
                  </View>
                  <Text
                    style={[
                      typography.bodySmall,
                      {
                        color: isDone || isActive ? colors.textPrimary : colors.textTertiary,
                        fontFamily: isActive
                          ? typography.bodyMedium.fontFamily
                          : typography.bodySmall.fontFamily,
                      },
                    ]}
                  >
                    {label}
                    {isActive ? '…' : ''}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </Card>

      {done && analysis && (
        <Card style={styles.summaryCard}>
          <Text style={[typography.h3, { marginBottom: spacing.md }]}>Analysis Summary</Text>
          <View style={styles.summaryGrid}>
            <SummaryStat label="Colors Detected" value={String(analysis.colorsDetected)} />
            <SummaryStat label="Objects Identified" value={String(analysis.objectsIdentified)} />
            <SummaryStat label="Background" value={analysis.background} />
          </View>

          <Text style={[typography.bodySmall, styles.subheading]}>Recommended stitch types</Text>
          <View style={styles.badgeRow}>
            {analysis.recommendedStitchTypes.map((t) => (
              <Badge key={t} label={t} tone="indigo" />
            ))}
          </View>

          <Text style={[typography.bodySmall, styles.subheading]}>Dominant colors</Text>
          <View style={styles.swatchRow}>
            {analysis.dominantColors.map((hex) => (
              <ColorSwatch key={hex} hex={hex} size={30} />
            ))}
          </View>
        </Card>
      )}

      <View style={styles.artworkPreview}>
        <Image source={artworkSource} style={styles.artworkThumb} resizeMode="cover" />
        <Text style={[typography.caption, { color: colors.textTertiary }]} numberOfLines={1}>
          {artwork?.name}
        </Text>
      </View>

      <WizardFooter
        onBack={() => router.back()}
        continueLabel="Continue to Settings"
        continueDisabled={!done}
        onContinue={() => router.push('/create/auto-digitize/settings')}
      />
    </ScreenContainer>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryStat}>
      <Text style={[typography.h3, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[typography.tiny, { color: colors.textTertiary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.xl,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    flexWrap: 'wrap',
  },
  progressWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  checklist: {
    flex: 1,
    gap: spacing.sm,
    minWidth: 220,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDotDone: {
    backgroundColor: colors.success,
  },
  checkDotActive: {
    backgroundColor: colors.indigo,
  },
  summaryCard: {
    marginTop: spacing.lg,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginBottom: spacing.md,
  },
  summaryStat: {
    gap: 2,
  },
  subheading: {
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  swatchRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  artworkPreview: {
    marginTop: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  artworkThumb: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
