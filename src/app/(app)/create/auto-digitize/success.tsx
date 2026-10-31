import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CheckCircle2, Download, FolderOpen, Plus } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmbossedStitchCanvas } from '@/components/ui/EmbossedStitchCanvas';
import { StitchStats } from '@/components/ui/StitchStats';
import { useToast } from '@/components/ui/Toast';
import { useDigitizeWizard } from '@/contexts/DigitizeWizardContext';
import { designsService, type Design } from '@/services/designs';
import type { StitchFormat } from '@/services/types';
import { useResponsive } from '@/hooks/useResponsive';
import { downloadStitchFile } from '@/utils/downloadStitchFile';
import { createPersistableThumbnail } from '@/utils/thumbnail';
import { pointsToMmSegments } from '@/utils/stitchPreview';

const FORMATS: StitchFormat[] = ['DST', 'PES', 'JEF', 'EXP', 'VP3', 'HUS'];


export default function DigitizeSuccessScreen() {
  const router = useRouter();
  const { artwork, settings, stitchPlan, dstPoints, threadColors, reset } = useDigitizeWizard();
  const { show } = useToast();
  const { isMobile } = useResponsive();
  const savedRef = useRef(false);
  const [saved, setSaved] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<StitchFormat | null>(null);
  /** Which engine actually produced the most recently downloaded file --
   * only ever set from a real `downloadStitchFile` result, never assumed
   * ahead of time, so this never claims the Python backend ran unless a
   * real request to it just succeeded (see `downloadStitchFile`'s
   * `engine` field). `null` until the user downloads at least one file. */
  const [lastDownloadEngine, setLastDownloadEngine] = useState<'backend' | 'client' | null>(null);

  useEffect(() => {
    if (!artwork || !stitchPlan) {
      router.replace('/create/auto-digitize');
      return;
    }
    if (savedRef.current) return;
    savedRef.current = true;

    // The picker's own uri (a web `blob:` URL or a native cache-dir path)
    // doesn't survive a page refresh / app relaunch, so the design would
    // "lose" its thumbnail the moment persistence kicked in. Re-encode it
    // as a small, durable `data:` URI first -- see utils/thumbnail.ts.
    createPersistableThumbnail(artwork.uri).then((uri) => {
      const thumbnail: Design['thumbnail'] = { uri };

      designsService
        .create({
          name: artwork.name,
          thumbnail,
          stitches: stitchPlan.stitches,
          colors: stitchPlan.colors,
          sizeMm: stitchPlan.sizeMm,
          // Persist the real stitch data too, not just the summary numbers
          // -- without this, My Designs' Download/QC Check have nothing
          // real to work with for a design opened later in a new session.
          stitchData: dstPoints && dstPoints.length > 0 ? { points: dstPoints, threadColors } : undefined,
        })
        .then(() => setSaved(true));
    });
  }, [artwork, stitchPlan]);

  // The real generated stitch path for this exact finished design -- the
  // same segment-by-segment 3D-threaded render used on the Preview and
  // Simulator screens -- built straight from the actual dstPoints this
  // design will export, not a re-fetch, not a flat photo of the artwork.
  const thumbSegments = useMemo(() => {
    if (!dstPoints || dstPoints.length === 0 || !stitchPlan) return [];
    return pointsToMmSegments(dstPoints, stitchPlan.sizeMm.width, stitchPlan.sizeMm.height);
  }, [dstPoints, stitchPlan]);

  if (!artwork || !stitchPlan) return null;

  const handleDownload = async (format: StitchFormat) => {
    if (!dstPoints || dstPoints.length === 0) {
      show("Couldn't generate a real stitch file for this design — try again from Settings.", 'error');
      return;
    }
    const baseName = artwork.name.replace(/\.[^/.]+$/, '') || 'design';
    setDownloadingFormat(format);
    try {
      const result = await downloadStitchFile(dstPoints, threadColors, format, baseName);
      if (result.ok) {
        setLastDownloadEngine(result.engine);
        const via = result.engine === 'backend' ? 'the Python backend' : 'the local fallback encoder';
        show(`${result.filename} downloaded — a real, machine-readable file from ${via}.`, 'success');
      } else if (result.reason === 'backend-unreachable') {
        show(
          `Couldn't reach the StitchPro backend to generate a real ${format} file right now — DST (works on virtually every machine) is still available below.`,
          'info'
        );
      } else {
        show('Something went wrong generating the stitch file.', 'error');
      }
    } finally {
      setDownloadingFormat(null);
    }
  };

  const handleCreateAnother = () => {
    reset();
    router.push('/create');
  };

  return (
    <ScreenContainer>
      <View style={styles.hero}>
        <View style={styles.checkCircle}>
          <CheckCircle2 size={40} color={colors.success} strokeWidth={2} />
        </View>
        <Text style={[typography.pageTitle, styles.title]}>Your Design is Ready!</Text>
        <Text style={[typography.body, styles.subtitle]}>
          {saved
            ? `"${artwork.name}" has been saved to My Designs and is ready to stitch.`
            : `"${artwork.name}" is ready to stitch.`}
        </Text>
      </View>

      <Card style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.thumb}>
            {thumbSegments.length > 0 ? (
              <EmbossedStitchCanvas
                segments={thumbSegments}
                palette={threadColors}
                widthMm={stitchPlan.sizeMm.width}
                heightMm={stitchPlan.sizeMm.height}
                progress={1}
              />
            ) : (
              <CheckCircle2 size={22} color={colors.textTertiary} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[typography.cardTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {artwork.name}
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
              {settings.fabric === 'Custom' ? settings.customFabric || 'Custom' : settings.fabric}
            </Text>
          </View>
        </View>
        <View style={styles.divider} />
        <StitchStats {...stitchPlan} />
      </Card>

      <View style={styles.downloadHeadingRow}>
        <Text style={typography.h3}>Download Format</Text>
        {lastDownloadEngine && (
          <Badge
            label={lastDownloadEngine === 'backend' ? 'Via Python Backend' : 'Via Local Fallback'}
            tone={lastDownloadEngine === 'backend' ? 'success' : 'warning'}
            dot
          />
        )}
      </View>
      <View style={styles.formatGrid}>
        {FORMATS.map((format, i) => (
          <Pressable
            key={format}
            onPress={() => handleDownload(format)}
            disabled={downloadingFormat !== null}
            style={[
              styles.formatChip,
              i === 0 && styles.formatChipPrimary,
              downloadingFormat !== null && downloadingFormat !== format && styles.formatChipDisabled,
            ]}
          >
            <Download size={15} color={i === 0 ? colors.white : colors.indigo} />
            <Text
              style={[
                typography.bodySmall,
                { color: i === 0 ? colors.white : colors.indigo, fontFamily: typography.bodyMedium.fontFamily },
              ]}
            >
              {downloadingFormat === format ? 'Working…' : format}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={[styles.actionsRow, isMobile && styles.actionsRowMobile]}>
        <View style={styles.actionsCol}>
          <Button
            label="Go to My Designs"
            variant="secondary"
            icon={<FolderOpen size={17} color={colors.textPrimary} />}
            onPress={() => router.push('/designs')}
            fullWidth
          />
        </View>
        <View style={styles.actionsCol}>
          <Button
            label="Create Another Design"
            icon={<Plus size={17} color={colors.white} />}
            onPress={handleCreateAnother}
            fullWidth
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  checkCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.successTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
    maxWidth: 420,
  },
  summaryCard: {},
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray100,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  downloadHeading: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  downloadHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  formatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  formatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.button,
    borderWidth: 1.5,
    borderColor: colors.indigo,
    paddingHorizontal: spacing.md,
    height: 42,
  },
  formatChipPrimary: {
    backgroundColor: colors.indigo,
  },
  formatChipDisabled: {
    opacity: 0.45,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xxl,
  },
  actionsRowMobile: {
    flexDirection: 'column',
  },
  actionsCol: {
    flex: 1,
  },
});
