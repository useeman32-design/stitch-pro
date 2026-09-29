import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Bell } from 'lucide-react-native';
import { colors, spacing, typography } from '@/theme';
import { Avatar } from '@/components/ui/Avatar';
import { IconButton } from '@/components/ui/IconButton';
import { NotificationsPanel } from '@/components/ui/NotificationsPanel';
import type { User } from '@/services/types';

interface MobileHeaderProps {
  user?: User;
  greetingName: string;
}

export function MobileHeader({ user, greetingName }: MobileHeaderProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [unread, setUnread] = useState(true);

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.brandRow}>
          <View style={styles.brandDot} />
          <Text style={styles.brandText}>StitchPro</Text>
        </View>
        <View style={styles.actions}>
          <IconButton
            accessibilityLabel="Notifications"
            variant="filled"
            onPress={() => {
              setNotifOpen(true);
              setUnread(false);
            }}
          >
            <View>
              <Bell size={18} color={colors.textSecondary} />
              {unread && <View style={styles.notifDot} />}
            </View>
          </IconButton>
          <Avatar name={user?.name ?? 'You'} size={36} />
        </View>
      </View>
      <Text style={[typography.h2, { marginTop: spacing.lg }]}>Good morning, {greetingName} 👋</Text>
      <Text style={[typography.body, { color: colors.textSecondary, marginTop: 2 }]}>
        Create amazing embroidery designs with ease.
      </Text>
      <NotificationsPanel visible={notifOpen} onClose={() => setNotifOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  brandDot: {
    width: 10,
    height: 10,
    borderRadius: 3,
    backgroundColor: colors.indigo,
  },
  brandText: {
    fontFamily: typography.h3.fontFamily,
    fontSize: 16,
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
