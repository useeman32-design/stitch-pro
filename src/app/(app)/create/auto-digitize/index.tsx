import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { UploadCloud, ImageIcon, X, RefreshCw } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { WizardStepHeader } from '@/components/create/WizardStepHeader';
import { WizardFooter } from '@/components/create/WizardFooter';
import { useDigitizeWizard, type UploadedArtwork } from '@/contexts/DigitizeWizardContext';
import { sampleArtworks } from '@/constants/sampleArtworks';
import { resolveImageUri } from '@/utils/stitchEngine';

export default function UploadArtworkScreen() {
  const router = useRouter();
  const { artwork, setArtwork, clearArtwork } = useDigitizeWizard();
  const { show } = useToast();
  const [picking, setPicking] = useState(false);

  const pickImage = async () => {
    setPicking(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets?.length) {
        const asset = result.assets[0];
        const uploaded: UploadedArtwork = {
          uri: asset.uri,
          name: asset.fileName || 'Uploaded Artwork',
          source: 'upload',
        };
        setArtwork(uploaded);
      }
    } catch (e) {
      show("Couldn't open the file picker. Please try again.", 'error');
    } finally {
      setPicking(false);
    }
  };

  const chooseSample = (name: string, source: number) => {
    setArtwork({ uri: resolveImageUri(source), name, source: 'sample' });
  };

  const artworkImageSource = artwork ? { uri: artwork.uri } : undefined;

  return (
    <ScreenContainer>
      <WizardStepHeader
        title="Auto Digitize"
        subtitle="Upload your artwork and StitchPro's AI will analyze it, then turn it into a ready-to-stitch embroidery design."
        currentIndex={0}
      />

      {!artwork ? (
        <Pressable
          onPress={pickImage}
          disabled={picking}
          style={({ pressed }) => [styles.dropzone, pressed && { opacity: 0.85 }]}
        >
          <View style={styles.dropzoneIcon}>
            <UploadCloud size={30} color={colors.indigo} strokeWidth={2} />
          </View>
          <Text style={[typography.h3, { color: colors.textPrimary }]}>
            {picking ? 'Opening file picker…' : 'Click to upload your artwork'}
          </Text>
          <Text style={[typography.bodySmall, styles.dropzoneHint]}>
            PNG, JPG or SVG — up to 10MB. For best results, use a high-resolution image with clear
            edges.
          </Text>
        </Pressable>
      ) : (
        <Card style={styles.previewCard}>
          <View style={styles.previewRow}>
            <View style={styles.thumbWrap}>
              {artworkImageSource ? (
                <Image source={artworkImageSource} style={styles.thumb} resizeMode="cover" />
              ) : (
                <ImageIcon size={24} color={colors.gray400} />
              )}
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[typography.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                {artwork.name}
              </Text>
              <Badge
                label={
                  artwork.source === 'sample'
                    ? 'Sample artwork'
                    : artwork.source === 'generated'
                      ? 'Generated design'
                      : 'Uploaded'
                }
                tone={artwork.source === 'sample' ? 'info' : artwork.source === 'generated' ? 'indigo' : 'success'}
              />
            </View>
            <View style={styles.previewActions}>
              <Pressable onPress={pickImage} style={styles.iconAction} hitSlop={6}>
                <RefreshCw size={17} color={colors.textSecondary} />
              </Pressable>
              <Pressable onPress={clearArtwork} style={styles.iconAction} hitSlop={6}>
                <X size={17} color={colors.danger} />
              </Pressable>
            </View>
          </View>
        </Card>
      )}

      <View style={styles.sampleSection}>
        <Text style={[typography.bodySmall, styles.sampleLabel]}>Or try a sample design</Text>
        <View style={styles.sampleRow}>
          {sampleArtworks.map((s) => {
            const active = artwork?.source === 'sample' && artwork.name === s.name;
            return (
              <Pressable
                key={s.name}
                onPress={() => chooseSample(s.name, s.source)}
                style={[styles.sampleThumb, active && styles.sampleThumbActive]}
              >
                <Image source={s.source} style={styles.sampleImage} resizeMode="cover" />
              </Pressable>
            );
          })}
        </View>
      </View>

      <WizardFooter
        continueLabel="Analyze Artwork"
        continueDisabled={!artwork}
        onContinue={() => router.push('/create/auto-digitize/analyzing')}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  dropzone: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.gray300,
    borderRadius: radius.card,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  dropzoneIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.indigoTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  dropzoneHint: {
    color: colors.textTertiary,
    textAlign: 'center',
    maxWidth: 340,
  },
  previewCard: {
    padding: spacing.md,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  thumbWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  previewActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  iconAction: {
    width: 34,
    height: 34,
    borderRadius: radius.xs,
    backgroundColor: colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sampleSection: {
    marginTop: spacing.xl,
  },
  sampleLabel: {
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  sampleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sampleThumb: {
    width: 64,
    height: 64,
    borderRadius: radius.sm,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  sampleThumbActive: {
    borderColor: colors.indigo,
  },
  sampleImage: {
    width: '100%',
    height: '100%',
  },
});
