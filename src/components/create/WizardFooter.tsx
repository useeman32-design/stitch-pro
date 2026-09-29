import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import { colors, spacing } from '@/theme';
import { Button } from '@/components/ui/Button';
import { useResponsive } from '@/hooks/useResponsive';

interface WizardFooterProps {
  onBack?: () => void;
  backLabel?: string;
  onContinue: () => void;
  continueLabel: string;
  continueDisabled?: boolean;
  continueLoading?: boolean;
}

export function WizardFooter({
  onBack,
  backLabel = 'Back',
  onContinue,
  continueLabel,
  continueDisabled,
  continueLoading,
}: WizardFooterProps) {
  const { isMobile } = useResponsive();
  return (
    <View style={[styles.row, isMobile && styles.rowMobile]}>
      {onBack ? (
        <Button
          label={backLabel}
          variant="secondary"
          onPress={onBack}
          fullWidth={isMobile}
          style={isMobile ? undefined : { minWidth: 120 }}
        />
      ) : (
        <View />
      )}
      <Button
        label={continueLabel}
        onPress={onContinue}
        disabled={continueDisabled}
        loading={continueLoading}
        icon={<ArrowRight size={17} color={colors.white} />}
        iconPosition="right"
        fullWidth={isMobile}
        style={isMobile ? undefined : { minWidth: 200 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xxl,
    gap: spacing.md,
  },
  rowMobile: {
    flexDirection: 'column-reverse',
  },
});
