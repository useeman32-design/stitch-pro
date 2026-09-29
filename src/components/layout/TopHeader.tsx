import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Bell, Menu, Search } from 'lucide-react-native';
import { colors, radius, sizes, spacing, typography } from '@/theme';
import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/IconButton';
import { NotificationsPanel } from '@/components/ui/NotificationsPanel';
import { useSidebar } from '@/contexts/SidebarContext';
import type { User } from '@/services/types';

interface TopHeaderProps {
  title?: string;
  showSearch?: boolean;
  user?: User;
}

export function TopHeader({ title, showSearch = true, user }: TopHeaderProps) {
  const { toggleCollapsed } = useSidebar();
  const [notifOpen, setNotifOpen] = useState(false);
  const [unread, setUnread] = useState(true);

  return (
    <View style={styles.container}>
      <IconButton
        accessibilityLabel="Toggle sidebar"
        variant="filled"
        size={40}
        onPress={toggleCollapsed}
      >
        <Menu size={19} color={colors.textSecondary} />
      </IconButton>

      <View style={{ flex: 1 }}>
        {title ? <Text style={typography.h2}>{title}</Text> : null}
        {showSearch && (
          <View style={[styles.search, title && { marginTop: spacing.sm }]}>
            <Search size={17} color={colors.textTertiary} />
            <TextInput
              placeholder="Search designs, templates, or anything…"
              placeholderTextColor={colors.textTertiary}
              style={[typography.body, styles.searchInput]}
            />
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <IconButton
          accessibilityLabel="Notifications"
          variant="filled"
          size={44}
          onPress={() => {
            setNotifOpen(true);
            setUnread(false);
          }}
        >
          <View>
            <Bell size={19} color={colors.textSecondary} />
            {unread && <View style={styles.notifDot} />}
          </View>
        </IconButton>
        {user && <Avatar name={user.name} size={40} />}
      </View>
      <NotificationsPanel visible={notifOpen} onClose={() => setNotifOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    minHeight: sizes.headerHeight,
    backgroundColor: colors.background,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 44,
    borderRadius: radius.input,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    maxWidth: 420,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    height: '100%',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  notifDot: {
    position: 'absolute',
    top: -1,
    right: -1,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: colors.gray100,
  },
});
