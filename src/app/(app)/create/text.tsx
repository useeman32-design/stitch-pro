import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Type as TypeIcon } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Chip } from '@/components/ui/Chip';
import { ColorSwatch } from '@/components/ui/ColorSwatch';
import { EmbossedStitchCanvas } from '@/components/ui/EmbossedStitchCanvas';
import { ThreadColorModal } from '@/components/create/ThreadColorModal';
import { WizardStepHeader } from '@/components/create/WizardStepHeader';
import { WizardFooter } from '@/components/create/WizardFooter';
import { useResponsive } from '@/hooks/useResponsive';
import { useDigitizeWizard } from '@/contexts/DigitizeWizardContext';
import { useStitchPreview } from '@/hooks/useStitchPreview';
import { useLetteringPreview } from '@/hooks/useLetteringPreview';
import { renderTextArtwork, type TextFontStyle, type TextLayout } from '@/utils/designRenderers';

// Live preview canvas size while the user is still editing text/font/color,
// before the real Settings step sets a final design size -- just needs to
// be a reasonable wide-text aspect ratio, not the final production size.
const LIVE_PREVIEW_WIDTH_MM = 100;
const LIVE_PREVIEW_HEIGHT_MM = 54;
// Cap height used for the dedicated lettering engine's live preview (see
// useLetteringPreview) -- a fixed, reasonable preview size independent of
// whatever final size the user picks later on the Settings screen.
const LETTERING_PREVIEW_CAP_HEIGHT_MM = 16;
// Debounce real backend digitizing calls while the user is actively typing
// or dragging a color picker -- without this, every keystroke would fire
// its own analyze-image request.
const STITCH_PREVIEW_DEBOUNCE_MS = 450;
// "Bold Block" and "Varsity" are both bold, straight-stroke-heavy capital
// letterforms close enough to share stitchpro-backend's single dedicated
// "Bold Block" lettering alphabet (digitizer/lettering/alphabet_block.py)
// for now -- "Modern Sans"/"Classic Serif"/"Script" still use the older
// render-to-image + generic-auto-digitize path until they get their own
// dedicated glyph sets the same way.
const LETTERING_ENGINE_FONTS: ReadonlySet<TextFontStyle> = new Set(['Bold Block', 'Varsity']);

const FONTS: TextFontStyle[] = ['Modern Sans', 'Bold Block', 'Classic Serif', 'Script', 'Varsity'];
const LAYOUTS: TextLayout[] = ['Straight', 'Arc Up', 'Arc Down'];

export default function TextCreateScreen() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const { setArtwork, setLetterMeta } = useDigitizeWizard();

  const [text, setText] = useState('STITCHPRO');
  const [font, setFont] = useState<TextFontStyle>('Modern Sans');
  const [layout, setLayout] = useState<TextLayout>('Straight');
  const [color, setColor] = useState('#5B4FE8');
  const [outlineEnabled, setOutlineEnabled] = useState(false);
  const [outlineColor, setOutlineColor] = useState('#181B26');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [rendering, setRendering] = useState(true);
  const [debouncedUri, setDebouncedUri] = useState<string | null>(null);
  const [debouncedText, setDebouncedText] = useState(text);
  const [colorPicker, setColorPicker] = useState<'text' | 'outline' | null>(null);
  const [continuing, setContinuing] = useState(false);

  // Eligible for the real dedicated satin-column lettering engine (see
  // useLetteringPreview / stitchpro-backend's digitizer/lettering) --
  // currently only the bold/block-style fonts with a straight baseline;
  // Script/Serif/curvy arc layouts fall back to the older render-to-image
  // + generic-auto-digitize path below exactly as before.
  const isLetteringFont = LETTERING_ENGINE_FONTS.has(font);
  const isLetteringEligible = isLetteringFont && layout === 'Straight' && !!text.trim();

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicking off the async render below
    setRendering(true);
    renderTextArtwork({ text, font, layout, color, outlineColor: outlineEnabled ? outlineColor : null })
      .then((uri) => {
        if (!cancelled) {
          setPreviewUri(uri);
          setRendering(false);
        }
      })
      .catch(() => !cancelled && setRendering(false));
    return () => {
      cancelled = true;
    };
  }, [text, font, layout, color, outlineEnabled, outlineColor]);

  // Debounce the real stitch-simulation backend call so fast typing /
  // color dragging doesn't fire one analyze-image request per keystroke --
  // only the design the user actually pauses on gets digitized for preview.
  useEffect(() => {
    if (!previewUri) return undefined;
    const t = setTimeout(() => setDebouncedUri(previewUri), STITCH_PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [previewUri]);

  // Same debounce for the dedicated lettering engine's text input --
  // mirrors the image-preview debounce above so fast typing fires at most
  // one real backend call once the user pauses.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedText(text), STITCH_PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [text]);

  const lettering = useLetteringPreview(
    isLetteringEligible ? debouncedText : null,
    LETTERING_PREVIEW_CAP_HEIGHT_MM,
    color
  );

  // Only fall back to the generic image-based preview when the dedicated
  // lettering engine either isn't applicable (wrong font/layout) or has
  // already tried and failed for this text (unsupported character, or no
  // backend reachable) -- avoids paying for two real backend digitize
  // calls for the same text at once while the lettering engine is still
  // working, but never leaves Bold Block/Varsity with no preview at all
  // if lettering genuinely can't handle this particular string.
  const letteringFailed = isLetteringEligible && !lettering.loading && lettering.source === 'none';
  const useGenericPreview = !isLetteringEligible || letteringFailed;
  const sim = useStitchPreview(
    useGenericPreview && debouncedUri ? { uri: debouncedUri } : null,
    LIVE_PREVIEW_WIDTH_MM,
    LIVE_PREVIEW_HEIGHT_MM,
    outlineEnabled ? 2 : 1,
    'fill',
    0
  );

  // The lettering engine is only trusted for the wizard handoff once it has
  // actually succeeded for the exact text currently on screen (not the
  // debounced value, which could be stale by the time Continue is tapped,
  // and not merely "eligible", which says nothing about whether this
  // specific string's characters/backend reachability actually worked).
  const letteringReadyForHandoff = isLetteringEligible && lettering.source === 'backend' && debouncedText === text;

  const handleContinue = async () => {
    setContinuing(true);
    try {
      const uri = await renderTextArtwork({
        text,
        font,
        layout,
        color,
        outlineColor: outlineEnabled ? outlineColor : null,
        width: 900,
        height: 480,
      });
      setLetterMeta(letteringReadyForHandoff ? { text: text.trim(), color } : null);
      setArtwork({ uri, name: `"${text.trim() || 'Text Design'}"`, source: 'generated' });
      router.push('/create/auto-digitize/analyzing');
    } finally {
      setContinuing(false);
    }
  };

  return (
    <ScreenContainer>
      <WizardStepHeader
        title="Text"
        subtitle="Design embroidered text with a real font, curve and thread color — the preview below updates live and feeds straight into StitchPro's stitch engine."
        currentIndex={0}
      />

      <View style={[styles.layout, isDesktop && styles.layoutDesktop]}>
        <View style={[styles.previewCol, isDesktop && styles.previewColDesktop]}>
          <View style={[styles.stage, { height: isDesktop ? 300 : 220 }]}>
            {isLetteringEligible && lettering.source === 'backend' ? (
              // Real satin-column lettering straight from stitchpro-
              // backend's dedicated alphabet -- clean curves on every
              // letter, not the generic per-region classifier's FILL/SATIN
              // mix for a rasterized text image.
              <EmbossedStitchCanvas
                segments={lettering.segments}
                palette={lettering.palette}
                widthMm={lettering.widthMm || LIVE_PREVIEW_WIDTH_MM}
                heightMm={lettering.heightMm || LETTERING_PREVIEW_CAP_HEIGHT_MM}
                progress={1}
              />
            ) : isLetteringEligible && lettering.loading ? (
              <>
                <ActivityIndicator color={colors.indigo} />
                <Text style={[typography.bodySmall, styles.stageHint]}>Rendering stitched preview…</Text>
              </>
            ) : rendering && !previewUri ? (
              <ActivityIndicator color={colors.indigo} />
            ) : sim.loading ? (
              <>
                <ActivityIndicator color={colors.indigo} />
                <Text style={[typography.bodySmall, styles.stageHint]}>Rendering stitched preview…</Text>
              </>
            ) : sim.source !== 'none' && previewUri ? (
              <EmbossedStitchCanvas
                segments={sim.segments}
                palette={sim.palette}
                widthMm={sim.widthMm || LIVE_PREVIEW_WIDTH_MM}
                heightMm={sim.heightMm || LIVE_PREVIEW_HEIGHT_MM}
                progress={1}
              />
            ) : previewUri ? (
              // Couldn't reach the digitizing backend yet -- fall back to
              // the plain rendered artwork itself, still with no fabric/
              // hoop mockup behind it, rather than showing nothing.
              <Image source={{ uri: previewUri }} style={styles.fallbackImage} resizeMode="contain" />
            ) : null}
          </View>
        </View>

        <View style={[styles.formCol, isDesktop && styles.formColDesktop]}>
          <Card style={styles.card}>
            <Input
              label="Your Text"
              value={text}
              onChangeText={(t) => setText(t.slice(0, 24))}
              placeholder="e.g. STITCHPRO"
              autoCapitalize="characters"
              leftIcon={<TypeIcon size={16} color={colors.textTertiary} />}
              helperText={`${text.length}/24 characters`}
            />

            <SectionLabel label="Font Style" />
            <View style={styles.chipRow}>
              {FONTS.map((f) => (
                <Chip key={f} label={f} active={font === f} onPress={() => setFont(f)} />
              ))}
            </View>
            {isLetteringFont && (
              <Text style={[typography.caption, styles.letteringHint]}>
                {layout === 'Straight'
                  ? 'Uses StitchPro\u2019s dedicated lettering engine \u2014 real satin-column letters with clean curves, not a traced image.'
                  : 'Arc layouts for this font still use the standard image-based digitizer for now \u2014 switch to Straight for the dedicated satin-column engine.'}
              </Text>
            )}

            <SectionLabel label="Layout" />
            <View style={styles.chipRow}>
              {LAYOUTS.map((l) => (
                <Chip key={l} label={l} active={layout === l} onPress={() => setLayout(l)} />
              ))}
            </View>

            <SectionLabel label="Thread Color" />
            <View style={styles.colorRow}>
              <ColorSwatch hex={color} onPress={() => setColorPicker('text')} size={40} />
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{color}</Text>
            </View>

            <View style={styles.outlineRow}>
              <Chip label="Outline" active={outlineEnabled} onPress={() => setOutlineEnabled((v) => !v)} />
              {outlineEnabled && (
                <View style={styles.colorRow}>
                  <ColorSwatch hex={outlineColor} onPress={() => setColorPicker('outline')} size={32} />
                  <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{outlineColor}</Text>
                </View>
              )}
            </View>
          </Card>
        </View>
      </View>

      <WizardFooter
        onBack={() => router.push('/create')}
        continueLabel="Continue to Analysis"
        continueDisabled={!text.trim()}
        continueLoading={continuing}
        onContinue={handleContinue}
      />

      <ThreadColorModal
        visible={!!colorPicker}
        mode="replace"
        initialHex={colorPicker === 'outline' ? outlineColor : color}
        onClose={() => setColorPicker(null)}
        onConfirm={(hex) => {
          if (colorPicker === 'outline') setOutlineColor(hex);
          else setColor(hex);
        }}
      />
    </ScreenContainer>
  );
}

function SectionLabel({ label }: { label: string }) {
  return <Text style={[typography.bodySmall, styles.sectionLabel]}>{label}</Text>;
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
    flex: 1,
  },
  formCol: {},
  formColDesktop: {
    flex: 1,
    maxWidth: 420,
  },
  card: {
    gap: spacing.md,
  },
  stage: {
    width: '100%',
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageHint: {
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  fallbackImage: {
    width: '80%',
    height: '80%',
  },
  sectionLabel: {
    color: colors.textPrimary,
    fontFamily: typography.bodyMedium.fontFamily,
    marginTop: spacing.xs,
  },
  letteringHint: {
    color: colors.textSecondary,
    marginTop: -spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  outlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
});
