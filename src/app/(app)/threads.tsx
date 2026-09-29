import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Search, Plus, Palette } from 'lucide-react-native';
import { colors, radius, shadows, spacing, typography } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useToast } from '@/components/ui/Toast';
import { threadsService, threadBrands } from '@/services/threads';
import type { ThreadColor } from '@/services/types';

export default function ThreadLibraryScreen() {
  const { show } = useToast();
  const [threads, setThreads] = useState<ThreadColor[] | null>(null);
  const [query, setQuery] = useState('');
  const [brand, setBrand] = useState<string>('all');
  const [palette, setPalette] = useState<Set<string>>(new Set());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [newBrand, setNewBrand] = useState<string>(threadBrands[0]);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newHex, setNewHex] = useState('#5B4FE8');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    threadsService.list().then(setThreads);
  }, []);

  const filtered = useMemo(() => {
    if (!threads) return [];
    return threads.filter((t) => {
      if (brand !== 'all' && t.brand !== brand) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!t.name.toLowerCase().includes(q) && !t.code.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [threads, brand, query]);

  const togglePalette = (id: string) => {
    setPalette((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const validHex = /^#([0-9A-Fa-f]{6})$/.test(newHex);

  const handleAdd = async () => {
    if (!newCode.trim() || !newName.trim() || !validHex) {
      show('Please fill in code, name and a valid hex color (e.g. #5B4FE8).', 'error');
      return;
    }
    setSaving(true);
    try {
      const thread = await threadsService.create({
        brand: newBrand,
        code: newCode.trim(),
        name: newName.trim(),
        hex: newHex,
      });
      setThreads((prev) => (prev ? [thread, ...prev] : [thread]));
      show('Thread color added to your library.', 'success');
      setSheetOpen(false);
      setNewCode('');
      setNewName('');
      setNewHex('#5B4FE8');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={typography.pageTitle}>Thread Library</Text>
          <Text style={[typography.body, styles.subtitle]}>
            Browse thread colors across brands, and build a palette for your next design.
          </Text>
        </View>
        <Button
          label="Add Thread"
          icon={<Plus size={16} color={colors.white} />}
          onPress={() => setSheetOpen(true)}
        />
      </View>

      <View style={styles.toolsRow}>
        <View style={{ flex: 1, minWidth: 220 }}>
          <Input
            placeholder="Search by name or code…"
            value={query}
            onChangeText={setQuery}
            leftIcon={<Search size={16} color={colors.textTertiary} />}
          />
        </View>
        {palette.size > 0 && (
          <View style={styles.paletteBadge}>
            <Palette size={14} color={colors.indigo} />
            <Text style={[typography.bodySmall, { color: colors.indigo }]}>
              {palette.size} in palette
            </Text>
          </View>
        )}
      </View>

      <View style={styles.chipRow}>
        <Pressable
          onPress={() => setBrand('all')}
          style={[styles.chip, brand === 'all' && styles.chipActive]}
        >
          <Text style={[typography.bodySmall, { color: brand === 'all' ? colors.white : colors.textSecondary }]}>
            All Brands
          </Text>
        </Pressable>
        {threadBrands.map((b) => (
          <Pressable key={b} onPress={() => setBrand(b)} style={[styles.chip, brand === b && styles.chipActive]}>
            <Text style={[typography.bodySmall, { color: brand === b ? colors.white : colors.textSecondary }]}>
              {b}
            </Text>
          </Pressable>
        ))}
      </View>

      {!threads ? (
        <View style={styles.grid}>
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} height={120} borderRadius={radius.card} style={{ flexBasis: 140, flexGrow: 1 }} />
          ))}
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState title="No threads found" description="Try a different search or brand filter." />
      ) : (
        <View style={styles.grid}>
          {filtered.map((t) => {
            const inPalette = palette.has(t.id);
            return (
              <Pressable key={t.id} onPress={() => togglePalette(t.id)} style={{ flexBasis: 140, flexGrow: 1 }}>
                <Card style={[styles.threadCard, inPalette && styles.threadCardActive] as any}>
                  <View style={[styles.swatch, { backgroundColor: t.hex }, shadows.card as object]} />
                  <Text style={typography.bodyMedium} numberOfLines={1}>
                    {t.name}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textTertiary }]}>
                    {t.brand} · {t.code}
                  </Text>
                  {inPalette && (
                    <View style={styles.paletteCheck}>
                      <Badge label="In palette" tone="info" />
                    </View>
                  )}
                </Card>
              </Pressable>
            );
          })}
        </View>
      )}

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="Add a Thread Color">
        <View style={{ gap: spacing.md, paddingBottom: spacing.md }}>
          <View>
            <Text style={[typography.bodySmall, styles.propLabel]}>Brand</Text>
            <View style={styles.chipRow}>
              {threadBrands.map((b) => (
                <Pressable
                  key={b}
                  onPress={() => setNewBrand(b)}
                  style={[styles.chip, newBrand === b && styles.chipActive]}
                >
                  <Text style={[typography.bodySmall, { color: newBrand === b ? colors.white : colors.textSecondary }]}>
                    {b}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Input label="Code" placeholder="e.g. 1147" value={newCode} onChangeText={setNewCode} />
          <Input label="Name" placeholder="e.g. Indigo Blue" value={newName} onChangeText={setNewName} />
          <Input label="Hex color" placeholder="#5B4FE8" value={newHex} onChangeText={setNewHex} />
          <View style={styles.previewRow}>
            <View
              style={[
                styles.previewSwatch,
                { backgroundColor: validHex ? newHex : colors.gray200 },
              ]}
            />
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
              {validHex ? 'Preview' : 'Enter a valid 6-digit hex code'}
            </Text>
          </View>
          <Button label="Add Thread" onPress={handleAdd} loading={saving} fullWidth />
        </View>
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
  paletteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    height: 52,
    borderRadius: radius.input,
    backgroundColor: colors.indigoTint,
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
  threadCard: {
    alignItems: 'flex-start',
    gap: 4,
  },
  threadCardActive: {
    borderWidth: 1.5,
    borderColor: colors.indigo,
  },
  swatch: {
    width: '100%',
    height: 56,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  paletteCheck: {
    marginTop: spacing.xs,
  },
  propLabel: {
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  previewSwatch: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
