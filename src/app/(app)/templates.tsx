import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Search, Wand2 } from 'lucide-react-native';
import { colors, radius, shadows, spacing, typography } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useToast } from '@/components/ui/Toast';
import { templatesService, type Template } from '@/services/templates';
import { designsService } from '@/services/designs';
import { formatNumber } from '@/utils/format';
import type { Design } from '@/services/types';

type CategoryFilter = 'all' | Design['category'];

const categories: { label: string; value: CategoryFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Logo', value: 'logo' },
  { label: 'Text', value: 'text' },
  { label: 'Monogram', value: 'monogram' },
  { label: 'Badge', value: 'badge' },
  { label: 'Other', value: 'other' },
];

export default function TemplatesScreen() {
  const router = useRouter();
  const { show } = useToast();
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [active, setActive] = useState<Template | null>(null);
  const [using, setUsing] = useState(false);

  useEffect(() => {
    templatesService.list().then(setTemplates);
  }, []);

  const filtered = useMemo(() => {
    if (!templates) return [];
    return templates.filter((t) => {
      if (category !== 'all' && t.category !== category) return false;
      if (query && !t.name.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [templates, category, query]);

  const useTemplate = async (template: Template) => {
    setUsing(true);
    try {
      await designsService.create({
        name: `${template.name} (copy)`,
        thumbnail: template.thumbnail,
        stitches: template.stitches,
        colors: template.colors,
        sizeMm: template.sizeMm,
        category: template.category,
        format: template.format,
      });
      show(`"${template.name}" added to My Designs.`, 'success');
      setActive(null);
      router.push('/designs');
    } finally {
      setUsing(false);
    }
  };

  return (
    <ScreenContainer>
      <Text style={typography.pageTitle}>Templates</Text>
      <Text style={[typography.body, styles.subtitle]}>
        Start from a ready-made design — logos, monograms, badges and more — and make it your own.
      </Text>

      <View style={styles.toolsRow}>
        <Input
          placeholder="Search templates…"
          value={query}
          onChangeText={setQuery}
          leftIcon={<Search size={16} color={colors.textTertiary} />}
        />
      </View>

      <View style={styles.chipRow}>
        {categories.map((c) => {
          const isActive = c.value === category;
          return (
            <Pressable
              key={c.value}
              onPress={() => setCategory(c.value)}
              style={[styles.chip, isActive && styles.chipActive]}
            >
              <Text style={[typography.bodySmall, { color: isActive ? colors.white : colors.textSecondary }]}>
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {!templates ? (
        <View style={styles.grid}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} height={230} borderRadius={radius.card} style={{ flexBasis: 200, flexGrow: 1 }} />
          ))}
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState title="No templates found" description="Try a different search or category." />
      ) : (
        <View style={styles.grid}>
          {filtered.map((t) => (
            <Pressable key={t.id} onPress={() => setActive(t)} style={{ flexBasis: 200, flexGrow: 1 }}>
              <Card padded={false} style={styles.card as any}>
                <View style={styles.thumbWrap}>
                  <Image source={t.thumbnail} style={styles.thumb} resizeMode="cover" />
                  {t.popular ? <Badge label="Popular" tone="indigo" style={styles.popularBadge} /> : null}
                  <Badge label={t.format} tone="navy" style={styles.formatBadge} />
                </View>
                <View style={styles.cardInfo}>
                  <Text style={typography.cardTitle} numberOfLines={1}>
                    {t.name}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textTertiary }]}>
                    {formatNumber(t.stitches)} stitches · {t.colors} colors
                  </Text>
                </View>
              </Card>
            </Pressable>
          ))}
        </View>
      )}

      <BottomSheet visible={!!active} onClose={() => setActive(null)} title={active?.name}>
        {active && (
          <View style={{ gap: spacing.md, paddingBottom: spacing.lg }}>
            <View style={[styles.detailThumbWrap, shadows.card as object]}>
              <Image source={active.thumbnail} style={styles.detailThumb} resizeMode="cover" />
            </View>
            <Text style={[typography.body, { color: colors.textSecondary }]}>{active.description}</Text>
            <View style={styles.metaGrid}>
              <Badge label={active.format} tone="navy" />
              <Badge label={`${formatNumber(active.stitches)} stitches`} tone="neutral" />
              <Badge label={`${active.colors} colors`} tone="neutral" />
              <Badge label={`${active.sizeMm.width}×${active.sizeMm.height}mm`} tone="neutral" />
            </View>
            <Button
              label="Use This Template"
              icon={<Wand2 size={16} color={colors.white} />}
              onPress={() => useTemplate(active)}
              loading={using}
              fullWidth
            />
          </View>
        )}
      </BottomSheet>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    maxWidth: 560,
  },
  toolsRow: {
    marginBottom: spacing.md,
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
  card: {
    overflow: 'hidden',
  },
  thumbWrap: {
    aspectRatio: 1,
    backgroundColor: colors.gray100,
    position: 'relative',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  popularBadge: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
  },
  formatBadge: {
    position: 'absolute',
    bottom: spacing.xs,
    left: spacing.xs,
  },
  cardInfo: {
    padding: spacing.sm,
    gap: 2,
  },
  detailThumbWrap: {
    width: '100%',
    aspectRatio: 1.4,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.gray100,
  },
  detailThumb: {
    width: '100%',
    height: '100%',
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
});
