import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Zap } from 'lucide-react-native';
import { colors, spacing, typography } from '@/theme';
import { Card } from '@/components/ui/Card';
import { ProgressCircle } from '@/components/ui/ProgressCircle';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';

interface UsageCardProps {
  used: number;
  total: number;
}

export function UsageCard({ used, total }: UsageCardProps) {
  const { show } = useToast();
  const progress = total > 0 ? used / total : 0;

  return (
    <Card>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Zap size={16} color={colors.indigo} />
        </View>
        <Text style={typography.cardTitle}>Credits Used</Text>
      </View>

      <View style={styles.row}>
        <ProgressCircle progress={progress} label={`${used}`} sublabel={`/ ${total}`} size={92} />
        <View style={styles.stats}>
          <Text style={[typography.h2, { color: colors.textPrimary }]}>
            {used}
            <Text style={[typography.body, { color: colors.textTertiary }]}> / {total}</Text>
          </Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
            Credits used this month
          </Text>
        </View>
      </View>

      <Button
        label="Get More Credits"
        variant="secondary"
        fullWidth
        style={{ marginTop: spacing.md }}
        onPress={() => show('Studio Plan unlocks unlimited exports and 24/7 support.', 'info')}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.indigoTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  stats: {
    flex: 1,
    gap: 2,
  },
});
