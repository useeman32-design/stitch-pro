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

const items = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Designs', href: '/designs', icon: FolderOpen },
  { label: 'CREATE', href: '', icon: null },
  { label: 'Jobs', href: '/jobs', icon: ClipboardList },
  { label: 'More', href: '/more', icon: Menu },
] as const;

export function BottomNavigation({ onCreatePress }: BottomNavigationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <View style={[styles.container, { height: sizes.bottomNavHeight + insets.bottom, paddingBottom: insets.bottom }]}>
      <CreateButton onPress={onCreatePress} />
      {items.map((item) => {
        if (item.icon === null) {
          return <View key="create-spacer" style={styles.item} />;
        }
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
              style={[
                typography.tiny,
                { color: active ? colors.indigo : colors.gray400, textTransform: 'none' },
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: 10,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
});
