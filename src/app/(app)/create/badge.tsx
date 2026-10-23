import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ShieldHalf } from 'lucide-react-native';
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
import { renderBadgeArtwork, type BadgeEmblem, type BadgeShape } from '@/utils/designRenderers';

const SHAPES: BadgeShape[] = ['Circle', 'Shield', 'Oval', 'Rectangle'];
const EMBLEMS: BadgeEmblem[] = ['Star', 'Shield', 'Wreath', 'Crown', 'Diamond', 'None'];

// Live preview canvas size while the user is still editing shape/text/
// emblem/color, before the real Settings step sets a final design size.
const LIVE_PREVIEW_SIZE_MM = 70;
// Debounce real backend digitizing calls while the user is actively typing
// or dragging a color picker -- without this, every keystroke would fire
// its own analyze-image request.
const STITCH_PREVIEW_DEBOUNCE_MS = 450;

export default function BadgeCreateScreen() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const { setArtwork } = useDigitizeWizard();

  const [shape, setShape] = useState<BadgeShape>('Circle');
  const [topText, setTopText] = useState('STITCHPRO');
  const [bottomText, setBottomText] = useState('EST. 2024');
  const [emblem, setEmblem] = useState<BadgeEmblem>('Star');
  const [backgroundColor, setBackgroundColor] = useState('#181B26');
  const [accentColor, setAccentColor] = useState('#D9A441');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [rendering, setRendering] = useState(true);
  const [debouncedUri, setDebouncedUri] = useState<string | null>(null);
  const [colorPicker, setColorPicker] = useState<'background' | 'accent' | null>(null);
  const [continuing, setContinuing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicking off the async render below
    setRendering(true);
    renderBadgeArtwork({ shape, topText, bottomText, emblem, backgroundColor, accentColor })
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
  }, [shape, topText, bottomText, emblem, backgroundColor, accentColor]);

  // Debounce the real stitch-simulation backend call so fast typing /
  // color dragging doesn't fire one analyze-image request per keystroke.
  useEffect(() => {
    if (!previewUri) return undefined;
    const t = setTimeout(() => setDebouncedUri(previewUri), STITCH_PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [previewUri]);

  const sim = useStitchPreview(
    debouncedUri ? { uri: debouncedUri } : null,
    LIVE_PREVIEW_SIZE_MM,
    LIVE_PREVIEW_SIZE_MM,
    3,
    'fill',
    0
  );

  const handleContinue = async () => {
    setContinuing(true);
    try {
      const uri = await renderBadgeArtwork({
        shape,
        topText,
        bottomText,
        emblem,
        backgroundColor,
        accentColor,
        size: 900,
      });
      setArtwork({ uri, name: `${topText.trim() || 'Badge'} Badge`, source: 'generated' });
      router.push('/create/auto-digitize/analyzing');
    } finally {
      setContinuing(false);
    }
  };

  return (
    <ScreenContainer>
      <WizardStepHeader
        title="Badge / Logo"
        subtitle="Compose a patch-style badge — shape, curved text, emblem and colors — then turn it into a production-ready embroidery design."
        currentIndex={0}
      />

      <View style={[styles.layout, isDesktop && styles.layoutDesktop]}>
        <View style={[styles.previewCol, isDesktop && styles.previewColDesktop]}>
          <View style={[styles.stage, { height: isDesktop ? 300 : 240 }]}>
            {rendering && !previewUri ? (
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
                widthMm={sim.widthMm || LIVE_PREVIEW_SIZE_MM}
                heightMm={sim.heightMm || LIVE_PREVIEW_SIZE_MM}
                progress={1}
              />
            ) : previewUri ? (
              <Image source={{ uri: previewUri }} style={styles.fallbackImage} resizeMode="contain" />
            ) : null}
          </View>
        </View>

        <View style={[styles.formCol, isDesktop && styles.formColDesktop]}>
          <Card style={styles.card}>
            <SectionLabel label="Shape" />
            <View style={styles.chipRow}>
              {SHAPES.map((s) => (
                <Chip key={s} label={s} active={shape === s} onPress={() => setShape(s)} />
              ))}
            </View>

            <Input
              label="Top Text"
              value={topText}
              onChangeText={(t) => setTopText(t.slice(0, 20))}
              placeholder="e.g. STITCHPRO"
              autoCapitalize="characters"
              leftIcon={<ShieldHalf size={16} color={colors.textTertiary} />}
            />
            <Input
              label="Bottom Text (optional)"
              value={bottomText}
              onChangeText={(t) => setBottomText(t.slice(0, 20))}
              placeholder="e.g. EST. 2024"
              autoCapitalize="characters"
            />

            <SectionLabel label="Emblem" />
            <View style={styles.chipRow}>
              {EMBLEMS.map((e) => (
                <Chip key={e} label={e} active={emblem === e} onPress={() => setEmblem(e)} />
              ))}
            </View>

            <SectionLabel label="Badge Color" />
            <View style={styles.colorRow}>
              <ColorSwatch hex={backgroundColor} onPress={() => setColorPicker('background')} size={40} />
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{backgroundColor}</Text>
            </View>

            <SectionLabel label="Accent Color (border, text, emblem)" />
            <View style={styles.colorRow}>
              <ColorSwatch hex={accentColor} onPress={() => setColorPicker('accent')} size={40} />
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{accentColor}</Text>
            </View>
          </Card>
        </View>
      </View>

      <WizardFooter
        onBack={() => router.push('/create')}
        continueLabel="Continue to Analysis"
        continueDisabled={!topText.trim()}
        continueLoading={continuing}
        onContinue={handleContinue}
      />

      <ThreadColorModal
        visible={!!colorPicker}
        mode="replace"
        initialHex={colorPicker === 'accent' ? accentColor : backgroundColor}
        onClose={() => setColorPicker(null)}
        onConfirm={(hex) => {
          if (colorPicker === 'accent') setAccentColor(hex);
          else setBackgroundColor(hex);
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
});
