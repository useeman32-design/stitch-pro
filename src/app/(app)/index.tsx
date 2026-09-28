import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useResponsive } from '@/hooks/useResponsive';
import { spacing } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { TopHeader } from '@/components/layout/TopHeader';
import { CreateSheet } from '@/components/layout/CreateSheet';
import { HeroBanner } from '@/components/dashboard/HeroBanner';
import { QuickCreateSection } from '@/components/dashboard/QuickCreateSection';
import { RecentProjects } from '@/components/dashboard/RecentProjects';
import { UsageCard } from '@/components/dashboard/UsageCard';
import { ActivityFeed } from '@/components/dashboard/ActivityFeed';
import { MobileHeader } from '@/components/dashboard/MobileHeader';
import { MobileQuickActions } from '@/components/dashboard/MobileQuickActions';
import { authService } from '@/services/auth';
import { designsService, type Design } from '@/services/designs';
import type { ActivityItem, User } from '@/services/types';

export default function DashboardScreen() {
  const { isDesktop } = useResponsive();
  const [user, setUser] = useState<User | undefined>();
  const [designs, setDesigns] = useState<Design[] | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [mobileCreateVisible, setMobileCreateVisible] = useState(false);

  useEffect(() => {
    authService.getCurrentUser().then(setUser);
    designsService.recent(5).then(setDesigns);
    designsService.recentActivity().then(setActivity);
  }, []);

  const firstName = user?.name?.split(' ')[0] ?? '';

  const toggleFavorite = (id: string) => {
    designsService.toggleFavorite(id).then(() => {
      setDesigns((prev) =>
        prev ? prev.map((d) => (d.id === id ? { ...d, favorite: !d.favorite } : d)) : prev
      );
    });
  };

  return (
    <ScreenContainer noPadding={isDesktop}>
      {isDesktop ? (
        <View style={styles.desktopLayout}>
          <View style={styles.mainCol}>
            <TopHeader title={`Good morning, ${firstName || 'there'} 👋`} user={user} />
            <View style={styles.mainColInner}>
              <QuickCreateSection />
              <HeroBanner />
              <RecentProjects designs={designs} onToggleFavorite={toggleFavorite} />
            </View>
          </View>
          <View style={styles.sideCol}>
            <UsageCard used={user?.creditsUsed ?? 0} total={user?.creditsTotal ?? 100} />
            <ActivityFeed items={activity} />
          </View>
        </View>
      ) : (
        <View style={{ gap: spacing.xl }}>
          <MobileHeader user={user} greetingName={firstName || 'there'} />
          <HeroBanner />
          <MobileQuickActions onMorePress={() => setMobileCreateVisible(true)} />
          <UsageCard used={user?.creditsUsed ?? 0} total={user?.creditsTotal ?? 100} />
          <RecentProjects designs={designs} onToggleFavorite={toggleFavorite} />
          <ActivityFeed items={activity} />
          <CreateSheet visible={mobileCreateVisible} onClose={() => setMobileCreateVisible(false)} />
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  desktopLayout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xl,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  mainCol: {
    flex: 2.2,
  },
  mainColInner: {
    gap: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  sideCol: {
    flex: 1,
    gap: spacing.xl,
    paddingTop: spacing.xl,
    minWidth: 300,
    maxWidth: 360,
  },
});
