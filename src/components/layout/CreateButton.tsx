import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus } from 'lucide-react-native';
import { colors, gradients, shadows, sizes } from '@/theme';

interface CreateButtonProps {
  onPress: () => void;
}

export function CreateButton({ onPress }: CreateButtonProps) {
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Create new design"
        style={({ pressed }) => [
          styles.pressable,
          { borderRadius: sizes.createButtonSize / 2 },
          pressed && { transform: [{ scale: 0.96 }] },
        ]}
      >
        <LinearGradient
          colors={gradients.indigo}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.button,
            {
              width: sizes.createButtonSize,
              height: sizes.createButtonSize,
              borderRadius: sizes.createButtonSize / 2,
            },
            shadows.raised as object,
          ]}
        >
          <Plus size={28} color={colors.white} strokeWidth={2.5} />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -28,
    alignItems: 'center',
    zIndex: 20,
  },
  pressable: {},
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.background,
  },
});
