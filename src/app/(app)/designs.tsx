import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Search, Plus, Play, Download, Trash2, ShieldCheck } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { DesignCard } from '@/components/ui/DesignCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useToast } from '@/components/ui/Toast';
import { designsService, type Design } from '@/services/designs';
import { formatNumber } from '@/utils/format';

type CategoryFilter = 'all' | Design['category'];

const categories: { label: string; value: CategoryFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Logo', value: 'logo' },
  { label: 'Text', value: 'text' },
  { label: 'Monogram', value: 'monogram' },
  { label: 'Badge', value: 'badge' },
  { label: 'Other', value: 'other' },
];

export default function DesignsScreen() {
  const router = useRouter();
  const { show } = useToast();
  const [designs, setDesigns] = useState<Design[] | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [active, setActive] = useState<Design | null>(null);

  useEffect(() => {
    designsService.list().then(setDesigns);
  }, []);

  const filtered = useMemo(() => {
    if (!designs) return [];
    return designs.filter((d) => {
      if (category !== 'all' && d.category !== category) return false;
      if (favoritesOnly && !d.favorite) return false;
      if (query && !d.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [designs, category, favoritesOnly, query]);

  const toggleFavorite = async (id: string) => {
    setDesigns((prev) => prev?.map((d) => (d.id === id ? { ...d, favorite: !d.favorite } : d)) ?? prev);
    await designsService.toggleFavorite(id);
  };

  return (
    <ScreenContainer>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={typography.pageTitle}>My Designs</Text>
          <Text style={[typography.body, styles.subtitle]}>
            Your embroidery design library — search, filter and manage every project you've
            created.
          </Text>
        </View>
        <Button
          label="New Design"
          icon={<Plus size={16} color={colors.white} />}
          onPress={() => router.push('/create')}
        />
      </View>

      <View style={styles.toolsRow}>
        <View style={{ flex: 1, minWidth: 220 }}>
          <Input
            placeholder="Search designs…"
            value={query}
            onChangeText={setQuery}
            leftIcon={<Search size={16} color={colors.textTertiary} />}
          />
        </View>
        <Pressable
          onPress={() => setFavoritesOnly((v) => !v)}
          style={[styles.favToggle, favoritesOnly && styles.favToggleActive]}
        >
          <Text
            style={[
              typography.bodySmall,
              { color: favoritesOnly ? colors.white : colors.textSecondary },
            ]}
          >
            ♥ Favorites
          </Text>
        </Pressable>
      </View>

      <View style={styles.chipRow}>
        {categories.map((c) => {
          const activeChip = c.value === category;
          return (
            <Pressable
              key={c.value}
              onPress={() => setCategory(c.value)}
              style={[styles.chip, activeChip && styles.chipActive]}
            >
              <Text
                style={[
                  typography.bodySmall,
                  { color: activeChip ? colors.white : colors.textSecondary },
                ]}
              >
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {!designs ? (
        <View style={styles.grid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} height={210} borderRadius={radius.card} style={{ flexBasis: 180, flexGrow: 1 }} />
          ))}
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No designs found"
          description="Try a different search or filter, or start a brand-new design."
          actionLabel="Create a Design"
          onAction={() => router.push('/create')}
        />
      ) : (
        <View style={styles.grid}>
          {filtered.map((d) => (
            <DesignCard
              key={d.id}
              design={d}
              onPress={() => setActive(d)}
              onToggleFavorite={() => toggleFavorite(d.id)}
            />
          ))}
        </View>
      )}

      <BottomSheet visible={!!active} onClose={() => setActive(null)} title={active?.name}>
        {active && (
          <View style={{ gap: spacing.md }}>
            <View style={styles.detailRow}>
              <Image source={active.thumbnail as any} style={styles.detailThumb} resizeMode="cover" />
              <View style={{ flex: 1, gap: 6 }}>
                <Badge label={active.format} tone="navy" />
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                  {formatNumber(active.stitches)} stitches · {active.colors} colors
                </Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                  {active.sizeMm.width}×{active.sizeMm.height}mm · {active.date}
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                  <Badge
                    label={active.status}
                    tone={active.status === 'completed' ? 'success' : active.status === 'draft' ? 'warning' : 'info'}
                  />
                </View>
              </View>
            </View>

            <View style={styles.sheetActions}>
              <Pressable
                style={styles.sheetAction}
                onPress={() => {
                  setActive(null);
                  router.push('/simulator');
                }}
              >
                <Play size={16} color={colors.indigo} />
                <Text style={styles.sheetActionLabel}>Simulate</Text>
              </Pressable>
              <Pressable
                style={styles.sheetAction}
                onPress={() => show(`Downloading "${active.name}" as ${active.format}…`, 'info')}
              >
                <Download size={16} color={colors.indigo} />
                <Text style={styles.sheetActionLabel}>Download</Text>
              </Pressable>
              <Pressable
                style={styles.sheetAction}
                onPress={() => show('Quality check passed — 96% stitch confidence.', 'success')}
              >
                <ShieldCheck size={16} color={colors.indigo} />
                <Text style={styles.sheetActionLabel}>QC Check</Text>
              </Pressable>
              <Pressable
                style={styles.sheetAction}
                onPress={() => {
                  setDesigns((prev) => prev?.filter((d) => d.id !== active.id) ?? prev);
                  setActive(null);
                  show('Design removed.', 'success');
                }}
              >
                <Trash2 size={16} color={colors.danger} />
                <Text style={[styles.sheetActionLabel, { color: colors.danger }]}>Delete</Text>
              </Pressable>
            </View>
          </View>
        )}
      </BottomSheet>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  subtitle: {
    color: colors.textSecondary,
    marginTop: spacing.xs,
    maxWidth: 520,
  },
  toolsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  favToggle: {
    height: 52,
    paddingHorizontal: spacing.md,
    borderRadius: radius.input,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  favToggleActive: {
    backgroundColor: colors.indigo,
    borderColor: colors.indigo,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.gray100,
  },
  chipActive: {
    backgroundColor: colors.indigo,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  detailThumb: {
    width: 96,
    height: 96,
    borderRadius: radius.sm,
    backgroundColor: colors.gray100,
  },
  sheetActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    marginBottom: spacing.md,
  },
  sheetAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sheetActionLabel: {
    fontSize: 13,
    color: colors.indigo,
    fontFamily: typography.bodyMedium.fontFamily,
  },
});
