import { Stack } from 'expo-router';
import { AppShell } from '@/components/layout/AppShell';
import { colors } from '@/theme';
import { DigitizeWizardProvider } from '@/contexts/DigitizeWizardContext';

// DigitizeWizardProvider lives here (rather than a new create/_layout.tsx)
// so the Text/Monogram/Badge quick-create modules can generate their design
// onto a canvas, hand it off as `artwork`, and continue into the exact same
// real analysis -> settings -> stitched preview -> download pipeline that
// Auto Digitize uses, instead of duplicating it.
export default function AppGroupLayout() {
  return (
    <DigitizeWizardProvider>
      <AppShell>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            contentStyle: { backgroundColor: colors.background },
          }}
        />
      </AppShell>
    </DigitizeWizardProvider>
  );
}
