import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Sparkles, Type, PenTool, ShieldHalf, SquareDashedMousePointer, Camera } from 'lucide-react-native';
import { spacing, typography } from '@/theme';
import { CreateOptionCard } from '@/components/ui/CreateOptionCard';
import { createOptions } from '@/constants/navigation';

// Kept in sync by hand with `createOptions` (navigation.ts) -- the exact
// same duplicated map also lives in CreateSheet.tsx and
// create/index.tsx's own screen. A `createOptions` entry with no matching
// key here renders `<undefined .../>`, which React throws on immediately
// (not a silently-missing icon) -- this is the actual root cause of a
// real regression caught during an item-4/5 end-to-end verification pass
// (this file was the one of the three NOT updated when "Photo of
// Embroidery" was added), so treat all three maps as one unit: adding a
// createOptions entry means updating all three, not just the screen you
// happen to be testing.
const iconByKey: Record<string, any> = {
  'auto-digitize': Sparkles,
  'embroidered-photo': Camera,
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
