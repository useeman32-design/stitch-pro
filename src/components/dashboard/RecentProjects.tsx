import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, typography } from '@/theme';
import { DesignCard } from '@/components/ui/DesignCard';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Design } from '@/services/designs';

interface RecentProjectsProps {
  designs: Design[] | null;
  onToggleFavorite: (id: string) => void;
}

export function RecentProjects({ designs, onToggleFavorite }: RecentProjectsProps) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={typography.h3}>Recent Projects</Text>
        <Pressable onPress={() => router.push('/designs')} hitSlop={8}>
          <Text style={[typography.bodySmall, { color: colors.indigo }]}>View all</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        {designs
          ? designs.map((design) => (
              <DesignCard
                key={design.id}
                design={design}
                onPress={() => router.push('/designs')}
                onToggleFavorite={() => onToggleFavorite(design.id)}
              />
            ))
          : Array.from({ length: 5 }).map((_, i) => (
              <View key={i} style={styles.skeletonCard}>
                <Skeleton height={150} borderRadius={18} />
                <Skeleton height={12} width="70%" style={{ marginTop: spacing.sm }} />
                <Skeleton height={10} width="40%" style={{ marginTop: spacing.xxs }} />
              </View>
            ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  skeletonCard: {
    flex: 1,
    minWidth: 160,
  },
});
