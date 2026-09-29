import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CheckCheck, PackageCheck, ShieldAlert, Sparkles, Wrench } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { BottomSheet } from './BottomSheet';

interface NotificationItem {
  id: string;
  icon: any;
  tint: string;
  title: string;
  detail: string;
  timestamp: string;
}

const notifications: NotificationItem[] = [
  {
    id: '1',
    icon: PackageCheck,
    tint: colors.success,
    title: 'Job #4821 finished stitching',
    detail: '"Lion Logo" completed on Brother PR1050X.',
    timestamp: '12 minutes ago',
  },
  {
    id: '2',
    icon: ShieldAlert,
    tint: colors.warning,
    title: 'Low thread stock',
    detail: 'Madeira Rayon 1147 (Navy) is below reorder threshold.',
    timestamp: '2 hours ago',
  },
  {
    id: '3',
    icon: Sparkles,
    tint: colors.indigo,
    title: 'Auto Digitize finished',
    detail: 'Your design "Company Logo" is ready to preview.',
    timestamp: 'Yesterday',
  },
  {
    id: '4',
    icon: Wrench,
    tint: colors.info,
    title: 'Maintenance reminder',
    detail: 'Tajima TMEZ G2 is due for a bobbin case clean.',
    timestamp: '2 days ago',
  },
];

interface NotificationsPanelProps {
  visible: boolean;
  onClose: () => void;
}

export function NotificationsPanel({ visible, onClose }: NotificationsPanelProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Notifications">
      <View style={{ gap: spacing.sm, marginBottom: spacing.sm }}>
        {notifications.map((item) => {
          const Icon = item.icon;
          return (
            <View key={item.id} style={styles.row}>
              <View style={[styles.iconWrap, { backgroundColor: `${item.tint}17` }]}>
                <Icon size={16} color={item.tint} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={typography.bodyMedium}>{item.title}</Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 2 }]}>
                  {item.detail}
                </Text>
                <Text style={[typography.caption, { color: colors.textTertiary, marginTop: 4 }]}>
                  {item.timestamp}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
      <Pressable style={styles.markRead} onPress={onClose}>
        <CheckCheck size={16} color={colors.indigo} />
        <Text style={[typography.bodyMedium, { color: colors.indigo }]}>Mark all as read</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markRead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
