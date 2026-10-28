import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { UploadCloud, ImageIcon, X, RefreshCw, Camera } from 'lucide-react-native';
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
  const params = useLocalSearchParams<{ source?: string }>();
  const { artwork, setArtwork, clearArtwork, sourceMode, setSourceMode } = useDigitizeWizard();
  const { show } = useToast();
  const [picking, setPicking] = useState(false);

  // The "Photo of Embroidery" card (create/index.tsx) links here with
  // `?source=embroidered_photo` -- sync that into the wizard context once
  // on mount so every downstream backend call this wizard makes
  // (background-removal preview has no classification step, but vectorize/
  // analyze both do) passes `forcePhoto: true`. Plain "Auto Digitize"
  // leaves this at the context's default ('artwork'), unchanged behavior.
  useEffect(() => {
    if (params.source === 'embroidered_photo' && sourceMode !== 'embroidered_photo') {
      setSourceMode('embroidered_photo');
    } else if (params.source !== 'embroidered_photo' && !params.source && sourceMode === 'embroidered_photo') {
      // Landing back on the plain /create/auto-digitize URL (e.g. via the
      // bottom nav) after previously using the photo entry point resets
      // to the regular flow, rather than silently staying "stuck" in
      // photo mode for an upload the user no longer associates with it.
      setSourceMode('artwork');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.source]);

  const isPhotoMode = sourceMode === 'embroidered_photo';

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
        title={isPhotoMode ? 'Photo of Embroidery' : 'Auto Digitize'}
        subtitle={
          isPhotoMode
            ? "Upload a photo of an item that's already embroidered — a monogrammed shirt, a stitched patch, a cap logo — and StitchPro will extract the design as a real, editable vector you can clean up and re-stitch."
            : "Upload your artwork and StitchPro's AI will analyze it, then turn it into a ready-to-stitch embroidery design."
        }
        currentIndex={0}
      />

      {isPhotoMode && (
        <Card style={styles.photoHintCard}>
          <Camera size={18} color={colors.indigo} />
          <Text style={[typography.bodySmall, styles.photoHintText]}>
            Best results: even lighting with no harsh glare, shoot mostly straight-on, and fill the frame with the
            stitched design. We&apos;ll remove the garment/background next, then trace the stitching into shapes you
            can select, delete, redraw, or add to on the next screen before anything is turned into stitches.
          </Text>
        </Card>
      )}

      {!artwork ? (
        <Pressable
          onPress={pickImage}
          disabled={picking}
          style={({ pressed }) => [styles.dropzone, pressed && { opacity: 0.85 }]}
        >
          <View style={styles.dropzoneIcon}>
            {isPhotoMode ? (
              <Camera size={30} color={colors.indigo} strokeWidth={2} />
            ) : (
              <UploadCloud size={30} color={colors.indigo} strokeWidth={2} />
            )}
          </View>
          <Text style={[typography.h3, { color: colors.textPrimary }]}>
            {picking ? 'Opening file picker…' : isPhotoMode ? 'Click to upload a photo' : 'Click to upload your artwork'}
          </Text>
          <Text style={[typography.bodySmall, styles.dropzoneHint]}>
            {isPhotoMode
              ? 'PNG or JPG — up to 10MB. A clear, well-lit photo of the stitched design works best.'
              : 'PNG, JPG or SVG — up to 10MB. For best results, use a high-resolution image with clear edges.'}
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
        <Text style={[typography.bodySmall, styles.sampleLabel]}>
          {isPhotoMode ? 'Or try a sample embroidery photo' : 'Or try a sample design'}
        </Text>
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
        onContinue={() => router.push('/create/auto-digitize/background-removal')}
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
  photoHintCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.md,
    backgroundColor: colors.indigoTint,
  },
  photoHintText: {
    flex: 1,
    color: colors.textSecondary,
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
