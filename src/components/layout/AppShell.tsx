import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsive } from '@/hooks/useResponsive';
import { colors, sizes } from '@/theme';
import { authService } from '@/services/auth';
import type { User } from '@/services/types';
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext';
import { Sidebar } from './Sidebar';
import { BottomNavigation } from './BottomNavigation';
import { CreateSheet } from './CreateSheet';

interface AppShellProps {
  children: React.ReactNode;
}

function DesktopShell({ children, user }: { children: React.ReactNode; user?: User }) {
  const { collapsed, toggleCollapsed } = useSidebar();
  return (
    <View style={styles.desktopRoot}>
      <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} user={user} />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

export function AppShell({ children }: AppShellProps) {
  const { isMobile } = useResponsive();
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
    <SidebarProvider>
      <DesktopShell user={user}>{children}</DesktopShell>
    </SidebarProvider>
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
