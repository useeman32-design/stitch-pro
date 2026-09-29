import { Stack } from 'expo-router';
import { colors } from '@/theme';

// DigitizeWizardProvider now lives one level up (src/app/(app)/create/_layout.tsx)
// so Text/Monogram/Badge can share the same wizard state when they hand off
// into this flow's analyzing/settings/preview/success screens.
export default function AutoDigitizeLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
