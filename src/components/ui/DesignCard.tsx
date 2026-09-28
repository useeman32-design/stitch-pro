import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Heart, MoreHorizontal } from 'lucide-react-native';
import { colors, radius, shadows, spacing, typography } from '@/theme';
import { Badge } from './Badge';
import type { Design } from '@/services/designs';

interface DesignCardProps {
  design: Design;
  onPress?: () => void;
  onToggleFavorite?: () => void;
}

export function DesignCard({ design, onPress, onToggleFavorite }: DesignCardProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.93 }]}>
      <View style={styles.thumbWrap}>
        <Image source={design.thumbnail} style={styles.thumb} resizeMode="cover" />
        <Pressable
          onPress={onToggleFavorite}
          hitSlop={8}
          style={styles.favoriteBtn}
        >
          <Heart
            size={15}
            color={design.favorite ? colors.danger : colors.white}
            fill={design.favorite ? colors.danger : 'transparent'}
          />
        </Pressable>
        <Badge label={design.format} tone="navy" style={styles.formatBadge} />
      </View>
      <View style={styles.info}>
        <View style={{ flex: 1 }}>
          <Text style={typography.cardTitle} numberOfLines={1}>
            {design.name}
          </Text>
          <Text style={[typography.caption, styles.date]}>{design.date}</Text>
        </View>
        <Pressable hitSlop={8}>
          <MoreHorizontal size={18} color={colors.textTertiary} />
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 160,
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...(shadows.xs as object),
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
  favoriteBtn: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(11,14,26,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formatBadge: {
    position: 'absolute',
    bottom: spacing.xs,
    left: spacing.xs,
  },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    gap: spacing.xs,
  },
  date: {
    color: colors.textTertiary,
    marginTop: 2,
  },
});
