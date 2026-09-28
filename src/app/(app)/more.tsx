import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, LogOut } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { moreScreenItems } from '@/constants/navigation';
import { authService } from '@/services/auth';
import type { User } from '@/services/types';

export default function MoreScreen() {
  const router = useRouter();
  const [user, setUser] = useState<User | undefined>();

  useEffect(() => {
    authService.getCurrentUser().then(setUser);
  }, []);

  return (
    <ScreenContainer>
      <Text style={typography.pageTitle}>More</Text>
      <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.xl }]}>
        Tools, resources and account settings.
      </Text>

      {user && (
        <Card style={styles.profileCard}>
          <Avatar name={user.name} size={48} />
          <View style={{ flex: 1 }}>
            <Text style={typography.cardTitle}>{user.name}</Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{user.email}</Text>
          </View>
          <Badge label={user.plan} tone="indigo" />
        </Card>
      )}

      <View style={styles.list}>
        {moreScreenItems.map((item, index) => (
          <Pressable
            key={item.href}
            onPress={() => router.push(item.href as any)}
            style={[
              styles.row,
              index === 0 && styles.rowFirst,
              index === moreScreenItems.length - 1 && styles.rowLast,
            ]}
          >
            <View style={styles.rowIcon}>
              <item.icon size={18} color={colors.indigo} />
            </View>
            <Text style={[typography.body, { flex: 1 }]}>{item.label}</Text>
            <ChevronRight size={18} color={colors.gray400} />
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.signOut}>
        <LogOut size={16} color={colors.danger} />
        <Text style={[typography.bodyMedium, { color: colors.danger }]}>Sign Out</Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  list: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowFirst: {
    borderTopWidth: 0,
  },
  rowLast: {},
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.indigoTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
  },
});
