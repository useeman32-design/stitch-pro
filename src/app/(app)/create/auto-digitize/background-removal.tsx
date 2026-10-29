import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';
import { Check, ImageOff, Sparkles } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { WizardStepHeader } from '@/components/create/WizardStepHeader';
import { WizardFooter } from '@/components/create/WizardFooter';
import { useResponsive } from '@/hooks/useResponsive';
import { useDigitizeWizard } from '@/contexts/DigitizeWizardContext';
import { removeBackgroundPreviewViaBackend } from '@/services/digitizing/backendClient';

type Choice = 'removed' | 'original';

/**
 * The "optional background-removal step" the auto-digitize flow was
 * explicitly missing: background/surrounding-material removal already
 * runs inside the real digitizing backend on every design (see
 * stitchpro-backend's digitizer/segmentation/background_removal.py), but
 * it used to happen silently, with no way for the user to see or override
 * it. This screen calls the real backend's standalone preview endpoint
 * right after artwork is picked, shows the user exactly what would be
 * removed, and requires an explicit choice before continuing -- never
 * applies it without them seeing the result first.
 */
export default function BackgroundRemovalScreen() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const { artwork, setRemoveBackground } = useDigitizeWizard();

  const [processedUri, setProcessedUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [choice, setChoice] = useState<Choice>('removed');

  useEffect(() => {
    if (!artwork) {
      router.replace('/create/auto-digitize');
      return;
    }
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicking off the async preview fetch below
    setLoading(true);
    setUnavailable(false);
    removeBackgroundPreviewViaBackend(artwork.uri)
      .then((uri) => {
        if (cancelled) return;
        if (uri) {
          setProcessedUri(uri);
          setChoice('removed');
        } else {
          // Backend unreachable/disabled, or nothing detectable -- the
          // wizard must still be usable with zero backend configured, so
          // fall back to the original image with no removal option
          // rather than blocking the user here.
          setUnavailable(true);
          setChoice('original');
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [artwork]);

  if (!artwork) return null;

  const handleContinue = () => {
    setRemoveBackground(choice === 'removed');
    // The next step looks for just the printed/stitched design within
    // whichever image the user just picked -- the "photo of someone
    // wearing the garment" case, where the shirt/skin fills the frame and
    // background removal alone (above) can't isolate the design itself.
    // See create/auto-digitize/design-region.tsx; it fails soft and
    // auto-skips itself for already-flat artwork, so it's always safe to
    // route there next.
    router.push('/create/auto-digitize/design-region');
  };

  return (
    <ScreenContainer>
      <WizardStepHeader
        title="Background"
        subtitle="If your artwork has a photographed background or surrounding material, StitchPro can remove it before digitizing. Take a look and choose which version to stitch."
        currentIndex={0}
      />

      {loading ? (
        <Card style={styles.loadingCard}>
          <ActivityIndicator color={colors.indigo} />
          <Text style={[typography.bodySmall, styles.loadingText]}>Checking for a background to remove…</Text>
        </Card>
      ) : (
        <View style={[styles.optionsRow, isDesktop && styles.optionsRowDesktop]}>
          <OptionCard
            label="Keep Original"
            icon={<ImageOff size={16} color={colors.textSecondary} />}
            active={choice === 'original'}
            onPress={() => setChoice('original')}
          >
            <Image source={{ uri: artwork.uri }} style={styles.optionImage} resizeMode="contain" />
          </OptionCard>

          <OptionCard
            label="Background Removed"
            icon={<Sparkles size={16} color={choice === 'removed' ? colors.white : colors.indigo} />}
            active={choice === 'removed'}
            onPress={() => processedUri && setChoice('removed')}
            disabled={!processedUri}
            recommended
          >
            {processedUri ? (
              <View style={styles.checkerWrap}>
                <Checkerboard />
                <Image source={{ uri: processedUri }} style={styles.optionImage} resizeMode="contain" />
              </View>
            ) : (
              <View style={styles.unavailableBox}>
                <Text style={[typography.bodySmall, styles.unavailableText]}>
                  {unavailable
                    ? "Couldn't reach StitchPro's background-removal engine right now — continuing with the original image."
                    : 'No background detected to remove.'}
                </Text>
              </View>
            )}
          </OptionCard>
        </View>
      )}

      <WizardFooter
        onBack={() => router.back()}
        continueLabel="Continue to Vectorize"
        continueDisabled={loading}
        onContinue={handleContinue}
      />
    </ScreenContainer>
  );
}

interface OptionCardProps {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onPress: () => void;
  disabled?: boolean;
  recommended?: boolean;
  children: React.ReactNode;
}

function OptionCard({ label, icon, active, onPress, disabled, recommended, children }: OptionCardProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.optionCard, active && styles.optionCardActive, disabled && styles.optionCardDisabled]}
    >
      <View style={styles.optionStage}>{children}</View>
      <View style={styles.optionFooter}>
        <View style={styles.optionLabelRow}>
          <View style={[styles.optionIconWrap, active && styles.optionIconWrapActive]}>{icon}</View>
          <Text style={[typography.bodySmall, { fontFamily: typography.bodyMedium.fontFamily, color: colors.textPrimary }]}>
            {label}
          </Text>
        </View>
        {recommended && <Badge label="Recommended" tone="indigo" />}
        {active && (
          <View style={styles.checkBadge}>
            <Check size={12} color={colors.white} strokeWidth={3} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

/** Classic "this is transparent" checkerboard, tiled via an SVG pattern so
 * it renders identically on web and native with no image asset needed. */
function Checkerboard() {
  const tile = 10;
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <Pattern id="checker" width={tile * 2} height={tile * 2} patternUnits="userSpaceOnUse">
          <Rect x={0} y={0} width={tile * 2} height={tile * 2} fill="#F4F3EF" />
          <Rect x={0} y={0} width={tile} height={tile} fill="#E2E0D8" />
          <Rect x={tile} y={tile} width={tile} height={tile} fill="#E2E0D8" />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill="url(#checker)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  loadingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.textSecondary,
  },
  optionsRow: {
    gap: spacing.md,
  },
  optionsRowDesktop: {
    flexDirection: 'row',
  },
  optionCard: {
    flex: 1,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  optionCardActive: {
    borderColor: colors.indigo,
  },
  optionCardDisabled: {
    opacity: 0.6,
  },
  optionStage: {
    height: 220,
    backgroundColor: colors.gray100,
  },
  checkerWrap: {
    flex: 1,
  },
  optionImage: {
    width: '100%',
    height: '100%',
  },
  unavailableBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  unavailableText: {
    color: colors.textTertiary,
    textAlign: 'center',
  },
  optionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    gap: spacing.sm,
  },
  optionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  optionIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconWrapActive: {
    backgroundColor: colors.indigo,
  },
  checkBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.indigo,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
