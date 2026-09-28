import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/theme';

interface CreateOptionCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  tint?: string;
  onPress?: () => void;
  size?: 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
}

export function CreateOptionCard({
  title,
  description,
  icon,
  tint = colors.indigo,
  onPress,
  size = 'md',
  style,
}: CreateOptionCardProps) {
  const large = size === 'lg';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        large && styles.cardLarge,
        pressed && styles.pressed,
        style,
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${tint}17` }, large && styles.iconWrapLarge]}>
        {icon}
      </View>
      <View style={styles.textWrap}>
        <Text style={[typography.cardTitle, large && typography.h3]}>{title}</Text>
        <Text style={[typography.bodySmall, styles.description]} numberOfLines={2}>
          {description}
        </Text>
      </View>
      {!large && <ChevronRight size={18} color={colors.gray400} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flex: 1,
    minWidth: 220,
  },
  cardLarge: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    minWidth: 200,
    maxWidth: 280,
    minHeight: 168,
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapLarge: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  description: {
    color: colors.textSecondary,
  },
});
