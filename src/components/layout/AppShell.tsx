import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsive } from '@/hooks/useResponsive';
import { colors, sizes } from '@/theme';
import { authService } from '@/services/auth';
import type { User } from '@/services/types';
import { Sidebar } from './Sidebar';
import { BottomNavigation } from './BottomNavigation';
import { CreateSheet } from './CreateSheet';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { isMobile } = useResponsive();
  const [collapsed, setCollapsed] = useState(false);
  const [createSheetVisible, setCreateSheetVisible] = useState(false);
  const [user, setUser] = useState<User | undefined>(undefined);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    authService.getCurrentUser().then(setUser);
  }, []);

  if (isMobile) {
    return (
      <View style={styles.mobileRoot}>
        <View style={{ flex: 1 }}>{children}</View>
        <BottomNavigation onCreatePress={() => setCreateSheetVisible(true)} />
        <CreateSheet visible={createSheetVisible} onClose={() => setCreateSheetVisible(false)} />
      </View>
    );
  }

  return (
    <View style={styles.desktopRoot}>
      <Sidebar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((c) => !c)} user={user} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  mobileRoot: {
    flex: 1,
    backgroundColor: colors.background,
  },
  desktopRoot: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
});
