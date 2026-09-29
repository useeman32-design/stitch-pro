import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Sparkles, Type, PenTool, ShieldHalf, SquareDashedMousePointer } from 'lucide-react-native';
import { spacing, typography } from '@/theme';
import { CreateOptionCard } from '@/components/ui/CreateOptionCard';
import { createOptions } from '@/constants/navigation';

const iconByKey: Record<string, any> = {
  'auto-digitize': Sparkles,
  text: Type,
  monogram: PenTool,
  badge: ShieldHalf,
  blank: SquareDashedMousePointer,
};

export function QuickCreateSection() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={typography.h3}>Quick Create</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  card: {
    flexBasis: 200,
  },
});
