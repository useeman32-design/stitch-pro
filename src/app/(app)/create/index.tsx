import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Sparkles, Type, PenTool, ShieldHalf, SquareDashedMousePointer } from 'lucide-react-native';
import { colors, spacing, typography } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { StepIndicator } from '@/components/ui/StepIndicator';
import { CreateOptionCard } from '@/components/ui/CreateOptionCard';
import { createOptions } from '@/constants/navigation';
import { useResponsive } from '@/hooks/useResponsive';

const iconByKey: Record<string, any> = {
  'auto-digitize': Sparkles,
  text: Type,
  monogram: PenTool,
  badge: ShieldHalf,
  blank: SquareDashedMousePointer,
};

export default function CreateNewProjectScreen() {
  const router = useRouter();
  const { isMobile } = useResponsive();

  return (
    <ScreenContainer>
      <Text style={typography.pageTitle}>Create New Project</Text>
      <Text style={[typography.body, styles.subtitle]}>
        Choose how you&apos;d like to start. You can switch approaches at any time.
      </Text>

      <View style={styles.stepWrap}>
        <StepIndicator
          currentIndex={0}
          compact={isMobile}
          steps={[{ label: 'Upload' }, { label: 'Settings' }, { label: 'Preview' }, { label: 'Download' }]}
        />
      </View>

      <View style={styles.grid}>
        {createOptions.map((opt) => {
          const Icon = iconByKey[opt.key];
          return (
            <CreateOptionCard
              key={opt.key}
              size="lg"
              title={opt.title}
              description={opt.description}
              tint={opt.tint}
              icon={<Icon size={24} color={opt.tint} />}
              onPress={() => router.push(opt.href as any)}
              style={styles.card}
            />
          );
        })}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
    maxWidth: 520,
  },
  stepWrap: {
    marginBottom: spacing.xxl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  card: {
    flexBasis: 220,
  },
});
