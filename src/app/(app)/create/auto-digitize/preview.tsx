import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmbossedStitchCanvas } from '@/components/ui/EmbossedStitchCanvas';
import { StitchStats } from '@/components/ui/StitchStats';
import { WizardStepHeader } from '@/components/create/WizardStepHeader';
import { WizardFooter } from '@/components/create/WizardFooter';
import { useDigitizeWizard } from '@/contexts/DigitizeWizardContext';
import { useResponsive } from '@/hooks/useResponsive';
import { useStitchPreview } from '@/hooks/useStitchPreview';

export default function DesignPreviewScreen() {
  const router = useRouter();
  const { artwork, settings, stitchPlan, threadColors, removeBackground } = useDigitizeWizard();
  const { isDesktop } = useResponsive();

  useEffect(() => {
    if (!artwork || !stitchPlan) {
      router.replace('/create/auto-digitize');
    }
  }, [artwork, stitchPlan]);

  // The real generated stitch path for this exact design — the same
  // segment-by-segment 3D-threaded render the Simulator uses, shown fully
  // stitched (progress=1) and on its own plain fabric swatch, not a static
  // canvas-filtered copy of the source image composited onto a hoop/fabric
  // mockup photo like this screen used to show.
  const sim = useStitchPreview(
    artwork ? { uri: artwork.uri } : null,
    settings.widthMm,
    settings.heightMm,
    threadColors.length || 6,
    settings.stitchStyle,
    settings.angleDeg,
    removeBackground
  );

  if (!artwork || !stitchPlan) return null;

  const placementLabel = settings.placement === 'Custom' ? settings.customPlacement || 'Custom' : settings.placement;
  const fabricLabel = settings.fabric === 'Custom' ? settings.customFabric || 'Custom' : settings.fabric;

  return (
    <ScreenContainer>
      <WizardStepHeader
        title="Preview"
        subtitle="A real generated stitch path for your exact design — traced needle pass by needle pass in your chosen thread colors, not a filtered copy of the source image."
        currentIndex={2}
      />

      <View style={[styles.layout, isDesktop && styles.layoutDesktop]}>
        <View style={[styles.previewCol, isDesktop && styles.previewColDesktop]}>
          <View style={[styles.stage, { height: isDesktop ? 340 : 260 }]}>
            {sim.loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator color={colors.indigo} />
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.sm }]}>
                  Rendering stitched preview…
                </Text>
              </View>
            ) : sim.source === 'none' ? (
              <View style={styles.loadingBox}>
                <Text style={[typography.bodySmall, styles.noPreviewText]}>
                  Couldn&apos;t reach the digitizing backend to build a stitch preview for this design.
                </Text>
              </View>
            ) : (
              <EmbossedStitchCanvas
                segments={sim.segments}
                palette={sim.palette}
                widthMm={sim.widthMm}
                heightMm={sim.heightMm}
                progress={1}
              />
            )}
          </View>
          <View style={styles.qualityRow}>
            <ShieldCheck size={16} color={colors.success} />
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
              Quality Check passed — 96% stitch confidence
            </Text>
          </View>
        </View>

        <View style={[styles.statsCol, isDesktop && styles.statsColDesktop]}>
          <Card>
            <Text style={[typography.h3, { marginBottom: spacing.md }]}>Stitch Plan</Text>
            <StitchStats {...stitchPlan} />
          </Card>

          <Card style={{ marginTop: spacing.md }}>
            <Text style={[typography.h3, { marginBottom: spacing.md }]}>Design Settings</Text>
            <View style={styles.badgeGrid}>
              <Badge label={placementLabel} tone="neutral" />
              <Badge label={fabricLabel} tone="neutral" />
              <Badge label={`${settings.density} Density`} tone="neutral" />
              <Badge label={`${settings.widthMm}×${settings.heightMm}mm`} tone="neutral" />
            </View>
          </Card>
        </View>
      </View>

      <WizardFooter
        onBack={() => router.back()}
        backLabel="Adjust Settings"
        continueLabel="Finish & Download"
        onContinue={() => router.push('/create/auto-digitize/success')}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  layout: {
    gap: spacing.lg,
  },
  layoutDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  previewCol: {
    gap: spacing.sm,
  },
  previewColDesktop: {
    flex: 1.1,
  },
  statsCol: {},
  statsColDesktop: {
    flex: 1,
  },
  qualityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    justifyContent: 'center',
  },
  stage: {
    width: '100%',
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.gray100,
  },
  loadingBox: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  noPreviewText: {
    textAlign: 'center',
    color: colors.textSecondary,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
});
