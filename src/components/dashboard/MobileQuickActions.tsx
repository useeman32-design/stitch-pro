import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Sparkles, Type, PenTool, Grid2x2 } from 'lucide-react-native';
import { colors, spacing, typography } from '@/theme';

interface MobileQuickActionsProps {
  onMorePress: () => void;
}

const actions = [
  { label: 'Auto Digitize', icon: Sparkles, tint: colors.indigo, href: '/create/auto-digitize' },
  { label: 'Text', icon: Type, tint: colors.blue, href: '/create/text' },
  { label: 'Monogram', icon: PenTool, tint: '#D9A441', href: '/create/monogram' },
] as const;

export function MobileQuickActions({ onMorePress }: MobileQuickActionsProps) {
  const router = useRouter();

  return (
    <View style={styles.row}>
      {actions.map((action) => (
        <Pressable key={action.label} style={styles.item} onPress={() => router.push(action.href)}>
          <View style={[styles.iconWrap, { backgroundColor: `${action.tint}17` }]}>
            <action.icon size={20} color={action.tint} />
          </View>
          <Text style={typography.caption} numberOfLines={1}>
            {action.label}
          </Text>
        </Pressable>
      ))}
      <Pressable style={styles.item} onPress={onMorePress}>
        <View style={[styles.iconWrap, { backgroundColor: colors.gray100 }]}>
          <Grid2x2 size={20} color={colors.textSecondary} />
        </View>
        <Text style={typography.caption}>More</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  item: {
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
