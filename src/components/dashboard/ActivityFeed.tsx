import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Download, PlusCircle, Pencil, PackageCheck } from 'lucide-react-native';
import { colors, spacing, typography } from '@/theme';
import { Card } from '@/components/ui/Card';
import type { ActivityItem } from '@/services/types';

const iconByType: Record<ActivityItem['type'], any> = {
  download: Download,
  create: PlusCircle,
  edit: Pencil,
  export: PackageCheck,
};

const tintByType: Record<ActivityItem['type'], string> = {
  download: colors.info,
  create: colors.indigo,
  edit: colors.warning,
  export: colors.success,
};

interface ActivityFeedProps {
  items: ActivityItem[];
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  return (
    <Card>
      <Text style={[typography.cardTitle, { marginBottom: spacing.md }]}>Recent Activity</Text>
      <View style={{ gap: spacing.md }}>
        {items.map((item, index) => {
          const Icon = iconByType[item.type];
          const tint = tintByType[item.type];
          return (
            <View key={item.id} style={styles.row}>
              <View style={styles.rail}>
                <View style={[styles.iconWrap, { backgroundColor: `${tint}17` }]}>
                  <Icon size={14} color={tint} />
                </View>
                {index < items.length - 1 && <View style={styles.line} />}
              </View>
              <View style={{ flex: 1, paddingBottom: spacing.sm }}>
                <Text style={typography.bodySmall}>
                  {item.message} {item.target ? <Text style={{ fontFamily: typography.bodyMedium.fontFamily }}>{item.target}</Text> : null}
                </Text>
                <Text style={[typography.caption, { color: colors.textTertiary, marginTop: 2 }]}>
                  {item.timestamp}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rail: {
    alignItems: 'center',
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: {
    width: 1.5,
    flex: 1,
    backgroundColor: colors.gray200,
    marginTop: 4,
  },
});
