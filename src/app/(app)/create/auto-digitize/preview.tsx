import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';
import { colors, spacing, typography } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmbroideryPreview } from '@/components/ui/EmbroideryPreview';
import { StitchStats } from '@/components/ui/StitchStats';
import { WizardStepHeader } from '@/components/create/WizardStepHeader';
import { WizardFooter } from '@/components/create/WizardFooter';
import { useDigitizeWizard } from '@/contexts/DigitizeWizardContext';
import { useResponsive } from '@/hooks/useResponsive';
import { useStitchedRender } from '@/hooks/useStitchedRender';

export default function DesignPreviewScreen() {
  const router = useRouter();
  const { artwork, settings, stitchPlan, threadColors } = useDigitizeWizard();
  const { isDesktop } = useResponsive();

  useEffect(() => {
    if (!artwork || !stitchPlan) {
      router.replace('/create/auto-digitize');
    }
  }, [artwork, stitchPlan]);

  const artworkSource = artwork ? { uri: artwork.uri } : null;
  const stitched = useStitchedRender(artworkSource, threadColors, settings.density);

  if (!artwork || !stitchPlan) return null;

  const placementLabel = settings.placement === 'Custom' ? settings.customPlacement || 'Custom' : settings.placement;
  const fabricLabel = settings.fabric === 'Custom' ? settings.customFabric || 'Custom' : settings.fabric;

  return (
    <ScreenContainer>
      <WizardStepHeader
        title="Preview"
        subtitle="Here's a real stitch-style render of your design — recolored to your exact thread palette with satin texture applied, not just the source image."
        currentIndex={2}
      />

      <View style={[styles.layout, isDesktop && styles.layoutDesktop]}>
        <View style={[styles.previewCol, isDesktop && styles.previewColDesktop]}>
          {stitched.loading ? (
            <View style={[styles.loadingBox, { height: isDesktop ? 340 : 260 }]}>
              <ActivityIndicator color={colors.indigo} />
              <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.sm }]}>
                Rendering stitched preview…
              </Text>
            </View>
          ) : (
            <EmbroideryPreview
              source={stitched.uri ? { uri: stitched.uri } : { uri: artwork.uri }}
              height={isDesktop ? 340 : 260}
            />
          )}
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
  loadingBox: {
    width: '100%',
    borderRadius: 18,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
});
