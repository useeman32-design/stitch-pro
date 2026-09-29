import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, FolderOpen, ClipboardList, Menu } from 'lucide-react-native';
import { colors, sizes, typography } from '@/theme';
import { CreateButton } from './CreateButton';

interface BottomNavigationProps {
  onCreatePress: () => void;
}

const leftItems = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Designs', href: '/designs', icon: FolderOpen },
] as const;

const rightItems = [
  { label: 'Jobs', href: '/jobs', icon: ClipboardList },
  { label: 'More', href: '/more', icon: Menu },
] as const;

export function BottomNavigation({ onCreatePress }: BottomNavigationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  const renderItem = (item: (typeof leftItems)[number] | (typeof rightItems)[number]) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <Pressable
        key={item.href}
        onPress={() => router.push(item.href as any)}
        style={styles.item}
        accessibilityRole="button"
        accessibilityLabel={item.label}
      >
        <Icon size={22} color={active ? colors.indigo : colors.gray400} strokeWidth={2} />
        <Text
          style={[typography.tiny, { color: active ? colors.indigo : colors.gray400, textTransform: 'none' }]}
        >
          {item.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={[styles.container, { height: sizes.bottomNavHeight + insets.bottom, paddingBottom: insets.bottom }]}
    >
      <View style={styles.row}>
        <View style={styles.group}>{leftItems.map(renderItem)}</View>
        {/* Reserves horizontal space for the floating CREATE button so the
            two side groups stay evenly split around the true bar center. */}
        <View style={styles.middleSpacer} pointerEvents="none" />
        <View style={styles.group}>{rightItems.map(renderItem)}</View>
      </View>

      {/* Rendered as a direct sibling of `row` (not nested inside one of its
          flex children) and centered against the full-width `container`, so
          its horizontal centering never depends on the side groups' content
          being symmetric. */}
      <CreateButton onPress={onCreatePress} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    flexDirection: 'row',
    paddingTop: 10,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  group: {
    flex: 1,
    flexDirection: 'row',
  },
  middleSpacer: {
    width: sizes.createButtonSize,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
});
