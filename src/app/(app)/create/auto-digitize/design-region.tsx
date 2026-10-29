import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Crop, RotateCcw, ScanSearch } from 'lucide-react-native';
import { colors, spacing, typography } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { WizardStepHeader } from '@/components/create/WizardStepHeader';
import { WizardFooter } from '@/components/create/WizardFooter';
import { DesignRegionCropper } from '@/components/create/DesignRegionCropper';
import { useDigitizeWizard } from '@/contexts/DigitizeWizardContext';
import { detectDesignRegionViaBackend } from '@/services/digitizing/backendClient';
import type { DesignRegionCrop } from '@/services/digitizing/backendClient';

const FULL_IMAGE_CROP: DesignRegionCrop = { x0: 0, y0: 0, x1: 1, y1: 1 };

/**
 * The "when creating with realworld photo, example clothes on someone its
 * suppose to detect it and extract only the design" step: runs the real
 * backend's design-region detector (stitchpro-backend's digitizer/
 * segmentation/design_region.py, via POST /api/design/detect-region)
 * right after the background-removal choice, shows the suggested crop as
 * an adjustable overlay, and requires the user to confirm or resize it
 * before continuing -- exactly the same "never apply automatically"
 * pattern as background-removal.tsx's own preview step, just one level
 * more specific (isolating the design within the garment, not just
 * stripping the backdrop around it).
 *
 * Per the locked-in gating plan, this step gets out of the way entirely
 * for already-flat artwork: the backend classifies first and returns
 * `skip: true` for a confidently-flat upload (this detector's one
 * acknowledged limitation is mistaking a flat logo's own internal color
 * boundary for "design detail" otherwise -- see design_region.py's module
 * docstring), so this screen auto-advances straight to vectorize.tsx
 * without ever showing a crop UI for that case.
 *
 * Fails soft exactly like every other optional backend-powered step in
 * this wizard: if the backend is unreachable or finds nothing worth
 * cropping, this screen shows a clear notice and lets the user continue
 * with the full image untouched (designRegionCrop stays `null`).
 */
export default function DesignRegionScreen() {
  const router = useRouter();
  const { artwork, sourceMode, setDesignRegionCrop } = useDigitizeWizard();
  const forcePhoto = sourceMode === 'embroidered_photo';

  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [suggestion, setSuggestion] = useState<DesignRegionCrop | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [box, setBox] = useState<DesignRegionCrop>(FULL_IMAGE_CROP);
  const [skip, setSkip] = useState(false);

  useEffect(() => {
    if (!artwork) {
      router.replace('/create/auto-digitize');
      return;
    }
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicking off the async detect fetch below
    setLoading(true);
    setUnavailable(false);
    detectDesignRegionViaBackend(artwork.uri, { forcePhoto })
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setUnavailable(true);
          return;
        }
        if (result.skip) {
          // Confidently flat artwork -- this detector doesn't apply here
          // (see module docstring's acknowledged limitation), so skip
          // straight through with no crop UI at all.
          setSkip(true);
          setDesignRegionCrop(null);
          router.replace('/create/auto-digitize/vectorize');
          return;
        }
        const next = { x0: result.x0, y0: result.y0, x1: result.x1, y1: result.y1 };
        setSuggestion(next);
        setBox(next);
        setConfidence(result.confidence);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately runs once per artwork, not on every render
  }, [artwork]);

  const resetToSuggestion = useCallback(() => {
    if (suggestion) setBox(suggestion);
  }, [suggestion]);

  const useFullImage = useCallback(() => {
    setBox(FULL_IMAGE_CROP);
  }, []);

  if (!artwork || skip) return null;

  const isFullImage =
    Math.abs(box.x0) < 0.001 && Math.abs(box.y0) < 0.001 && Math.abs(box.x1 - 1) < 0.001 && Math.abs(box.y1 - 1) < 0.001;

  const handleContinue = () => {
    setDesignRegionCrop(isFullImage ? null : box);
    router.push('/create/auto-digitize/vectorize');
  };

  return (
    <ScreenContainer>
      <WizardStepHeader
        title="Find the Design"
        subtitle="If this is a photo of the garment being worn, drag the box so it covers just the printed or stitched design — not the whole shirt, skin, or background."
        currentIndex={0}
      />

      {loading ? (
        <Card style={styles.loadingCard}>
          <ActivityIndicator color={colors.indigo} />
          <Text style={[typography.bodySmall, styles.loadingText]}>Looking for the design within your photo…</Text>
        </Card>
      ) : unavailable ? (
        <Card style={styles.loadingCard}>
          <ScanSearch size={22} color={colors.textTertiary} />
          <Text style={[typography.bodySmall, styles.loadingText]}>
            Couldn't reach StitchPro's design-detection engine right now — continuing with the full image. You can
            still crop it in the next step's region editor.
          </Text>
        </Card>
      ) : (
        <Card style={styles.card}>
          <View style={styles.headerRow}>
            <View style={styles.headerLabel}>
              <Crop size={15} color={colors.indigo} />
              <Text style={[typography.bodySmall, styles.headerLabelText]}>Drag corners to adjust</Text>
            </View>
            {suggestion && !isFullImage && (
              <Badge
                label={confidence >= 0.5 ? 'Auto-detected' : 'Low-confidence guess'}
                tone={confidence >= 0.5 ? 'indigo' : 'warning'}
              />
            )}
          </View>

          <DesignRegionCropper imageUri={artwork.uri} value={box} onChange={setBox} />

          <View style={styles.actionsRow}>
            <Button
              label="Reset to suggestion"
              variant="secondary"
              size="sm"
              icon={<RotateCcw size={14} color={colors.textSecondary} />}
              onPress={resetToSuggestion}
              disabled={!suggestion}
            />
            <Button label="Use full image" variant="secondary" size="sm" onPress={useFullImage} disabled={isFullImage} />
          </View>
        </Card>
      )}

      <WizardFooter onBack={() => router.back()} continueLabel="Continue to Vectorize" continueDisabled={loading} onContinue={handleContinue} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loadingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  loadingText: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
  card: {
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerLabelText: {
    color: colors.textSecondary,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
});
