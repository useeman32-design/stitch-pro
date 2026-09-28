import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { ChevronsLeft, ChevronsRight } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, sizes, spacing, typography } from '@/theme';
import { mainNavItems, learnNavItems, systemNavItems } from '@/constants/navigation';
import { Avatar } from '@/components/ui/Avatar';
import type { User } from '@/services/types';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  user?: User;
}

function StitchMark({ size = 30 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Path
        d="M6 22C6 22 9 8 16 8C23 8 26 22 26 22"
        stroke={colors.indigoLight}
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeDasharray="1 5.2"
      />
      <Path
        d="M6 24C9 15 13 11 16 11C19 11 23 15 26 24"
        stroke="#FFFFFF"
        strokeWidth={2.6}
        strokeLinecap="round"
      />
    </Svg>
  );
}

function NavRow({
  label,
  Icon,
  active,
  collapsed,
  onPress,
}: {
  label: string;
  Icon: any;
  active: boolean;
  collapsed: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.navRow,
        collapsed && styles.navRowCollapsed,
        active && styles.navRowActive,
        pressed && !active && styles.navRowPressed,
      ]}
    >
      <Icon size={19} color={active ? colors.white : colors.textOnNavySecondary} strokeWidth={2} />
      {!collapsed && (
        <Text
          style={[
            typography.bodySmall,
            {
              color: active ? colors.white : colors.textOnNavySecondary,
              fontFamily: active ? typography.bodyMedium.fontFamily : typography.bodySmall.fontFamily,
            },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function SectionLabel({ children, collapsed }: { children: string; collapsed: boolean }) {
  if (collapsed) return <View style={{ height: spacing.md }} />;
  return (
    <Text style={[typography.tiny, styles.sectionLabel]} numberOfLines={1}>
      {children}
    </Text>
  );
}

export function Sidebar({ collapsed, onToggleCollapsed, user }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <View style={[styles.container, { width: collapsed ? sizes.sidebarCollapsedWidth : sizes.sidebarWidth }]}>
      <View style={[styles.brandRow, collapsed && styles.brandRowCollapsed]}>
        <View style={styles.brandMark}>
          <StitchMark size={20} />
        </View>
        {!collapsed && <Text style={styles.brandText}>STITCHPRO</Text>}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        <SectionLabel collapsed={collapsed}>MAIN</SectionLabel>
        {mainNavItems.map((item) => (
          <NavRow
            key={item.href}
            label={item.label}
            Icon={item.icon}
            active={isActive(item.href)}
            collapsed={collapsed}
            onPress={() => router.push(item.href as any)}
          />
        ))}

        <View style={styles.divider} />
        <SectionLabel collapsed={collapsed}>LEARN</SectionLabel>
        {learnNavItems.map((item) => (
          <NavRow
            key={item.href}
            label={item.label}
            Icon={item.icon}
            active={isActive(item.href)}
            collapsed={collapsed}
            onPress={() => router.push(item.href as any)}
          />
        ))}

        <View style={styles.divider} />
        <SectionLabel collapsed={collapsed}>SYSTEM</SectionLabel>
        {systemNavItems.map((item) => (
          <NavRow
            key={item.href}
            label={item.label}
            Icon={item.icon}
            active={isActive(item.href)}
            collapsed={collapsed}
            onPress={() => router.push(item.href as any)}
          />
        ))}
      </ScrollView>

      <Pressable onPress={onToggleCollapsed} style={styles.collapseToggle}>
        {collapsed ? (
          <ChevronsRight size={16} color={colors.textOnNavySecondary} />
        ) : (
          <>
            <ChevronsLeft size={16} color={colors.textOnNavySecondary} />
            <Text style={[typography.caption, { color: colors.textOnNavySecondary }]}>Collapse</Text>
          </>
        )}
      </Pressable>

      {user && (
        <View style={[styles.profileRow, collapsed && styles.profileRowCollapsed]}>
          <Avatar name={user.name} size={36} />
          {!collapsed && (
            <View style={{ flex: 1 }}>
              <Text style={[typography.bodySmall, { color: colors.white }]} numberOfLines={1}>
                {user.name}
              </Text>
              <Text style={[typography.caption, { color: colors.indigoLight }]}>{user.plan}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.navy,
    height: '100%',
    paddingBottom: spacing.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  brandRowCollapsed: {
    paddingHorizontal: 0,
    justifyContent: 'center',
  },
  brandMark: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.indigo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandText: {
    color: colors.white,
    fontFamily: typography.h3.fontFamily,
    fontSize: 16,
    letterSpacing: 0.5,
  },
  sectionLabel: {
    color: colors.textOnNavySecondary,
    letterSpacing: 1,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
    marginTop: spacing.xs,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 11,
    borderRadius: 10,
    marginBottom: 2,
  },
  navRowCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  navRowActive: {
    backgroundColor: colors.indigo,
  },
  navRowPressed: {
    backgroundColor: colors.navySoft,
  },
  divider: {
    height: 1,
    backgroundColor: colors.navySoft,
    marginVertical: spacing.sm,
  },
  collapseToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.md,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.xs,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.navySoft,
  },
  profileRowCollapsed: {
    justifyContent: 'center',
    marginHorizontal: 0,
  },
});
