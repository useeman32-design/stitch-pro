import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { Card } from './Card';

interface StatCardProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
  trend?: { value: string; positive?: boolean };
  accent?: string;
}

export function StatCard({ label, value, icon, trend, accent = colors.indigo }: StatCardProps) {
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        {icon ? (
          <View style={[styles.iconWrap, { backgroundColor: `${accent}1A` }]}>{icon}</View>
        ) : null}
        {trend ? (
          <Text
            style={[
              typography.caption,
              { color: trend.positive === false ? colors.danger : colors.success },
            ]}
          >
            {trend.value}
          </Text>
        ) : null}
      </View>
      <Text style={[typography.h2, styles.value]}>{value}</Text>
      <Text style={[typography.bodySmall, styles.label]}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 150,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    color: colors.textPrimary,
  },
  label: {
    color: colors.textSecondary,
    marginTop: 2,
  },
});
