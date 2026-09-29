import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PenTool } from 'lucide-react-native';
import { colors, spacing, typography } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Chip } from '@/components/ui/Chip';
import { ColorSwatch } from '@/components/ui/ColorSwatch';
import { EmbroideryPreview } from '@/components/ui/EmbroideryPreview';
import { ThreadColorModal } from '@/components/create/ThreadColorModal';
import { WizardStepHeader } from '@/components/create/WizardStepHeader';
import { WizardFooter } from '@/components/create/WizardFooter';
import { useResponsive } from '@/hooks/useResponsive';
import { useDigitizeWizard } from '@/contexts/DigitizeWizardContext';
import { renderMonogramArtwork, type MonogramStyle } from '@/utils/designRenderers';

const STYLES: MonogramStyle[] = ['Classic Interlocking', 'Circle Frame', 'Diamond Frame', 'Stacked Block'];

export default function MonogramCreateScreen() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const { setArtwork } = useDigitizeWizard();

  const [letters, setLetters] = useState('ABC');
  const [style, setStyle] = useState<MonogramStyle>('Classic Interlocking');
  const [primaryColor, setPrimaryColor] = useState('#181B26');
  const [accentColor, setAccentColor] = useState('#D9A441');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [rendering, setRendering] = useState(true);
  const [colorPicker, setColorPicker] = useState<'primary' | 'accent' | null>(null);
  const [continuing, setContinuing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicking off the async render below
    setRendering(true);
    renderMonogramArtwork({ letters, style, primaryColor, accentColor })
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
  }, [letters, style, primaryColor, accentColor]);

  const handleContinue = async () => {
    setContinuing(true);
    try {
      const uri = await renderMonogramArtwork({ letters, style, primaryColor, accentColor, size: 900 });
      const clean = letters.toUpperCase().replace(/[^A-Z]/g, '') || 'AZ';
      setArtwork({ uri, name: `${clean} Monogram`, source: 'generated' });
      router.push('/create/auto-digitize/analyzing');
    } finally {
      setContinuing(false);
    }
  };

  return (
    <ScreenContainer>
      <WizardStepHeader
        title="Monogram"
        subtitle="Build a professional monogram from 1-3 letters. Pick a classic layout and colors, then let StitchPro turn it into a real stitch plan."
        currentIndex={0}
      />

      <View style={[styles.layout, isDesktop && styles.layoutDesktop]}>
        <View style={[styles.previewCol, isDesktop && styles.previewColDesktop]}>
          {rendering && !previewUri ? (
            <View style={[styles.loadingBox, { height: isDesktop ? 300 : 240 }]}>
              <ActivityIndicator color={colors.indigo} />
            </View>
          ) : previewUri ? (
            <EmbroideryPreview source={{ uri: previewUri }} height={isDesktop ? 300 : 240} showHoop={false} />
          ) : null}
        </View>

        <View style={[styles.formCol, isDesktop && styles.formColDesktop]}>
          <Card style={styles.card}>
            <Input
              label="Letters"
              value={letters}
              onChangeText={(t) => setLetters(t.toUpperCase().replace(/[^A-Za-z]/g, '').slice(0, 3))}
              placeholder="e.g. ABC"
              autoCapitalize="characters"
              leftIcon={<PenTool size={16} color={colors.textTertiary} />}
              helperText="1–3 letters. For Classic Interlocking, 3 letters gives the traditional small-BIG-small look."
            />

            <SectionLabel label="Style" />
            <View style={styles.chipRow}>
              {STYLES.map((s) => (
                <Chip key={s} label={s} active={style === s} onPress={() => setStyle(s)} />
              ))}
            </View>

            <SectionLabel label="Letter Color" />
            <View style={styles.colorRow}>
              <ColorSwatch hex={primaryColor} onPress={() => setColorPicker('primary')} size={40} />
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{primaryColor}</Text>
            </View>

            <SectionLabel label={style.includes('Frame') ? 'Frame Color' : 'Accent Color'} />
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
        continueDisabled={!letters.trim()}
        continueLoading={continuing}
        onContinue={handleContinue}
      />

      <ThreadColorModal
        visible={!!colorPicker}
        mode="replace"
        initialHex={colorPicker === 'accent' ? accentColor : primaryColor}
        onClose={() => setColorPicker(null)}
        onConfirm={(hex) => {
          if (colorPicker === 'accent') setAccentColor(hex);
          else setPrimaryColor(hex);
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
  loadingBox: {
    width: '100%',
    borderRadius: 18,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
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
