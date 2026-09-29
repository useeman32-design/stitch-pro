import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { StepIndicator } from '@/components/ui/StepIndicator';
import { useResponsive } from '@/hooks/useResponsive';

const WIZARD_STEPS = [{ label: 'Upload' }, { label: 'Settings' }, { label: 'Preview' }, { label: 'Download' }];

interface WizardStepHeaderProps {
  title: string;
  subtitle?: string;
  currentIndex: number;
}

export function WizardStepHeader({ title, subtitle, currentIndex }: WizardStepHeaderProps) {
  const { isMobile } = useResponsive();
  return (
    <View style={styles.wrap}>
      <Text style={typography.pageTitle}>{title}</Text>
      {subtitle ? <Text style={[typography.body, styles.subtitle]}>{subtitle}</Text> : null}
      <View style={styles.stepWrap}>
        <StepIndicator steps={WIZARD_STEPS} currentIndex={currentIndex} compact={isMobile} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: spacing.xl,
  },
  subtitle: {
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    maxWidth: 560,
  },
  stepWrap: {
    marginTop: spacing.sm,
  },
});
