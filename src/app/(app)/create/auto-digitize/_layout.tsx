import { Stack } from 'expo-router';
import { colors } from '@/theme';
import { DigitizeWizardProvider } from '@/contexts/DigitizeWizardContext';

export default function AutoDigitizeLayout() {
  return (
    <DigitizeWizardProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </DigitizeWizardProvider>
  );
}
