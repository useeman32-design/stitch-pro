import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Wand2 } from 'lucide-react-native';
import { colors, spacing, typography } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { WizardStepHeader } from '@/components/create/WizardStepHeader';
import { WizardFooter } from '@/components/create/WizardFooter';
import { BackgroundMaskBrush } from '@/components/create/BackgroundMaskBrush';
import { VectorRegionEditor } from '@/components/create/VectorRegionEditor';
import { useDigitizeWizard } from '@/contexts/DigitizeWizardContext';
import { removeBackgroundPreviewViaBackend, vectorizeImageViaBackend } from '@/services/digitizing/backendClient';
import type { BgStroke, VectorRegion } from '@/services/digitizing/backendClient';

type Tab = 'background' | 'regions';

/**
 * The "whichever background-removal choice the user makes must be
 * converted into a real, editable vector, not just handed to the digitizer
 * as a raster" step: runs the real backend trace
 * (stitchpro-backend's digitizer/pipeline.py image_to_vector_regions) on
 * whatever image the user picked on background-removal.tsx, lets them fix
 * the background mask by hand with an adjustable brush, and lets them
 * select/delete any traced shape that looks wrong before any stitches are
 * ever generated. The final region list (if the backend was reachable) is
 * stored on the wizard context and used by every downstream digitize/
 * preview call instead of re-tracing the original image -- see
 * `useStitchPreview`'s `regions` param.
 *
 * Fails soft: if the backend is unreachable, this screen shows a clear
 * notice and lets the user continue straight to the existing raster
 * auto-digitize path (vectorRegions stays `null`), exactly like every
 * other optional backend-powered step in this wizard.
 */
export default function VectorizeScreen() {
  const router = useRouter();
  const {
    artwork,
    settings,
    removeBackground,
    vectorRegions,
    setVectorRegions,
    bgStrokes,
    setBgStrokes,
    sourceMode,
    designRegionCrop,
  } = useDigitizeWizard();
  const forcePhoto = sourceMode === 'embroidered_photo';
  // Trace at whatever design size is currently in effect (defaults to
  // 90x90mm until the user visits Settings) -- if they later pick a
  // different size there, the stored regions are rescaled to match (see
  // `rescaleVectorRegions`), so this doesn't need to be the *final* size,
  // just *a* consistent one to trace/edit against.
  const previewWidthMm = settings.widthMm;
  const previewHeightMm = settings.heightMm;

  const [tab, setTab] = useState<Tab>('regions');
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [maskPreviewUri, setMaskPreviewUri] = useState<string | null>(null);
  const [regions, setRegions] = useState<VectorRegion[]>(vectorRegions ?? []);

  const runVectorize = useCallback(
    async (strokes: BgStroke[]) => {
      if (!artwork) return;
      setLoading(true);
      const result = await vectorizeImageViaBackend(artwork.uri, previewWidthMm, previewHeightMm, {
        removeBackground,
        bgStrokes: strokes,
        forcePhoto,
        crop: designRegionCrop,
      });
      if (result) {
        setRegions(result.regions);
        setUnavailable(false);
      } else {
        setUnavailable(true);
      }
      setLoading(false);
    },
    [artwork, removeBackground, forcePhoto, designRegionCrop]
  );

  useEffect(() => {
    if (!artwork) {
      router.replace('/create/auto-digitize');
      return;
    }
    // Only fetch the mask-correction preview image when background removal
    // is actually in play -- "keep original" has no mask to brush-correct
    // against in the usual sense, though erase strokes can still knock out
    // a stray bit by hand (see BackgroundMaskBrush/apply_mask_strokes).
    // Previewed against the same user-confirmed design-region crop (see
    // create/auto-digitize/design-region.tsx) the real vectorize call
    // below uses, so the mask the user brushes against actually matches
    // what gets processed.
    removeBackgroundPreviewViaBackend(artwork.uri, undefined, designRegionCrop ?? undefined).then(setMaskPreviewUri);
    runVectorize(bgStrokes);
    // Deliberately runs once per artwork -- re-vectorizing on every brush
    // stroke happens explicitly via the "Apply Brush Edits" button below,
    // not automatically on every drag, to avoid hammering the backend.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artwork]);

  if (!artwork) return null;

  const handleAddStroke = (stroke: BgStroke) => {
    setBgStrokes([...bgStrokes, stroke]);
  };

  const handleClearStrokes = () => {
    setBgStrokes([]);
    runVectorize([]);
  };

  const handleApplyBrush = () => {
    runVectorize(bgStrokes);
  };

  const handleDeleteRegion = (id: string) => {
    setRegions((prev) => prev.filter((r) => r.id !== id));
  };

  const handleRedrawRegion = (id: string, rings: VectorRegion['rings'], areaMm2: number) => {
    setRegions((prev) => prev.map((r) => (r.id === id ? { ...r, rings, areaMm2 } : r)));
  };

  const handleAddRegion = (region: { colorHex: string; rings: VectorRegion['rings']; areaMm2: number }) => {
    setRegions((prev) => [
      ...prev,
      { id: `region-added-${Date.now()}-${prev.length}`, colorHex: region.colorHex, rings: region.rings, areaMm2: region.areaMm2 },
    ]);
  };

  const handleContinue = () => {
    if (unavailable || !regions.length) {
      setVectorRegions(null);
    } else {
      setVectorRegions(regions, { width: previewWidthMm, height: previewHeightMm });
    }
    router.push('/create/auto-digitize/analyzing');
  };

  return (
    <ScreenContainer>
      <WizardStepHeader
        title="Vectorize & Edit"
        subtitle="StitchPro traced your artwork into real, editable shapes. Fix the background mask by hand if needed, then review or remove any shape before it's turned into stitches."
        currentIndex={0}
      />

      <View style={styles.tabRow}>
        <Chip label="Fix Background" active={tab === 'background'} onPress={() => setTab('background')} />
        <Chip label="Edit Shapes" active={tab === 'regions'} onPress={() => setTab('regions')} />
      </View>

      {loading ? (
        <Card style={styles.loadingCard}>
          <ActivityIndicator color={colors.indigo} />
          <Text style={[typography.bodySmall, styles.loadingText]}>Tracing your artwork into editable shapes…</Text>
        </Card>
      ) : unavailable ? (
        <Card style={styles.loadingCard}>
          <Wand2 size={22} color={colors.textTertiary} />
          <Text style={[typography.bodySmall, styles.loadingText]}>
            Couldn't reach StitchPro's vectorizing engine right now — continuing with the standard auto-digitize path
            instead. Your background-removal choice is still respected.
          </Text>
        </Card>
      ) : tab === 'background' ? (
        <Card>
          {maskPreviewUri ? (
            <BackgroundMaskBrush
              imageUri={maskPreviewUri}
              strokes={bgStrokes}
              onAddStroke={handleAddStroke}
              onClearStrokes={handleClearStrokes}
            />
          ) : (
            <Text style={[typography.bodySmall, styles.loadingText]}>No background preview available to brush.</Text>
          )}
          <Button
            label="Apply Brush Edits"
            variant="secondary"
            onPress={handleApplyBrush}
            disabled={!bgStrokes.length}
            style={styles.applyBtn}
          />
        </Card>
      ) : (
        <Card>
          <VectorRegionEditor
            widthMm={previewWidthMm}
            heightMm={previewHeightMm}
            regions={regions}
            onDeleteRegion={handleDeleteRegion}
            onRedrawRegion={handleRedrawRegion}
            onAddRegion={handleAddRegion}
          />
        </Card>
      )}

      <WizardFooter
        onBack={() => router.back()}
        continueLabel="Continue to Analysis"
        continueDisabled={loading}
        onContinue={handleContinue}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  loadingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
  applyBtn: {
    marginTop: spacing.md,
  },
});
