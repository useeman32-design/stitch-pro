import { Stack } from 'expo-router';
import { AppShell } from '@/components/layout/AppShell';
import { colors } from '@/theme';

export default function AppGroupLayout() {
  return (
    <AppShell>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </AppShell>
  );
}
