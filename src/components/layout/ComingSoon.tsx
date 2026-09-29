import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Hammer } from 'lucide-react-native';
import { colors, spacing, typography } from '@/theme';
import { ScreenContainer } from './ScreenContainer';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

interface ComingSoonProps {
  title: string;
  description?: string;
}

/**
 * Lightweight placeholder used for sections queued for a later build
 * iteration. Keeps every sidebar/nav destination navigable (per the
 * product spec) without prematurely designing screens out of order.
 */
export function ComingSoon({ title, description }: ComingSoonProps) {
  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Text style={typography.pageTitle}>{title}</Text>
        <Badge label="Coming soon" tone="indigo" />
      </View>
      <EmptyState
        icon={<Hammer size={32} color={colors.indigo} />}
        title="This workspace is being crafted"
        description={
          description ??
          'This part of StitchPro is on the roadmap and will be designed in a follow-up pass.'
        }
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
});
