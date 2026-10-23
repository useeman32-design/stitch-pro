import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CheckCircle2, Download, FolderOpen, Plus } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmbossedStitchCanvas } from '@/components/ui/EmbossedStitchCanvas';
import { StitchStats } from '@/components/ui/StitchStats';
import { useToast } from '@/components/ui/Toast';
import { useDigitizeWizard } from '@/contexts/DigitizeWizardContext';
import { designsService, type Design } from '@/services/designs';
import type { StitchFormat } from '@/services/types';
import { useResponsive } from '@/hooks/useResponsive';
import { buildDstFile } from '@/utils/dstWriter';
import { exportViaBackend, type BackendFormat } from '@/services/digitizing/backendClient';
import { createPersistableThumbnail } from '@/utils/thumbnail';
import { pointsToMmSegments } from '@/utils/stitchPreview';

const FORMATS: StitchFormat[] = ['DST', 'PES', 'JEF', 'EXP', 'VP3', 'HUS'];

// Formats the real backend (pyembroidery) can encode. HUS has no
// pyembroidery writer yet, so it stays unavailable either way.
const BACKEND_FORMATS: Partial<Record<StitchFormat, BackendFormat>> = {
  DST: 'dst',
  PES: 'pes',
  JEF: 'jef',
  EXP: 'exp',
  VP3: 'vp3',
};

export default function DigitizeSuccessScreen() {
  const router = useRouter();
  const { artwork, settings, stitchPlan, dstPoints, threadColors, reset } = useDigitizeWizard();
  const { show } = useToast();
  const { isMobile } = useResponsive();
  const savedRef = useRef(false);
  const [saved, setSaved] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState<StitchFormat | null>(null);

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

  const triggerBlobDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownload = async (format: StitchFormat) => {
    if (!dstPoints || dstPoints.length === 0) {
      show("Couldn't generate a real stitch file for this design — try again from Settings.", 'error');
      return;
    }
    const baseName = artwork.name.replace(/\.[^/.]+$/, '') || 'design';
    const backendFormat = BACKEND_FORMATS[format];

    // Formats beyond DST need the real backend (pyembroidery) to encode —
    // pure client-side JS only implements the DST binary format. Try the
    // backend first for every supported format (it's also a more
    // authoritative encoder for DST itself); fall back to the client-side
    // writer for DST only if the backend is unreachable/unconfigured.
    if (backendFormat) {
      setDownloadingFormat(format);
      try {
        const blob = await exportViaBackend(dstPoints, threadColors, backendFormat, baseName);
        if (blob) {
          triggerBlobDownload(blob, `${baseName}.${backendFormat}`);
          show(`${baseName}.${backendFormat} downloaded — a real, machine-readable file from the StitchPro engine.`, 'success');
          return;
        }
      } finally {
        setDownloadingFormat(null);
      }
    }

    if (format !== 'DST') {
      show(
        `Couldn't reach the StitchPro backend to generate a real ${format} file right now — DST (works on virtually every machine) is still available below.`,
        'info'
      );
      return;
    }

    // DST-only client-side fallback, so exports keep working with zero
    // backend configured/reachable.
    try {
      const bytes = buildDstFile(dstPoints, { name: artwork.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 16) || 'STITCHPRO' });
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/octet-stream' });
      triggerBlobDownload(blob, `${baseName}.dst`);
      show(`${baseName}.dst downloaded — a real, machine-readable Tajima DST file.`, 'success');
    } catch {
      show('Something went wrong generating the DST file.', 'error');
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
              {settings.placement === 'Custom' ? settings.customPlacement || 'Custom' : settings.placement} ·{' '}
              {settings.fabric === 'Custom' ? settings.customFabric || 'Custom' : settings.fabric}
            </Text>
          </View>
        </View>
        <View style={styles.divider} />
        <StitchStats {...stitchPlan} />
      </Card>

      <Text style={[typography.h3, styles.downloadHeading]}>Download Format</Text>
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
