import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Sparkles, Type, PenTool, ShieldHalf, SquareDashedMousePointer, Camera } from 'lucide-react-native';
import { spacing } from '@/theme';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { CreateOptionCard } from '@/components/ui/CreateOptionCard';
import { createOptions } from '@/constants/navigation';

// Kept in sync by hand with `createOptions` (navigation.ts) -- the exact
// same duplicated map also lives in QuickCreateSection.tsx (the dashboard)
// and create/index.tsx's own screen. A `createOptions` entry with no
// matching key here renders `<undefined .../>`, which React throws on
// immediately -- treat all three maps as one unit: adding a
// `createOptions` entry means updating all three, not just the screen you
// happen to be testing.
const iconByKey: Record<string, any> = {
  'auto-digitize': Sparkles,
  'embroidered-photo': Camera,
  text: Type,
  monogram: PenTool,
  badge: ShieldHalf,
  blank: SquareDashedMousePointer,
};

interface CreateSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function CreateSheet({ visible, onClose }: CreateSheetProps) {
  const router = useRouter();

  return (
    <BottomSheet visible={visible} onClose={onClose} title="What do you want to create?">
      <View style={styles.list}>
        {createOptions.map((opt) => {
          const Icon = iconByKey[opt.key];
          return (
            <CreateOptionCard
              key={opt.key}
              title={opt.title}
              description={opt.description}
              tint={opt.tint}
              icon={<Icon size={22} color={opt.tint} />}
              onPress={() => {
                onClose();
                router.push(opt.href as any);
              }}
            />
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
});
