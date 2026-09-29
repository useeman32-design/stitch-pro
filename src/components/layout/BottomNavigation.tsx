import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Home, FolderOpen, ClipboardList, Menu } from 'lucide-react-native';
import { colors, radius, sizes, typography } from '@/theme';
import { CreateButton } from './CreateButton';

interface BottomNavigationProps {
  onCreatePress: () => void;
}

const leftItems = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Designs', href: '/designs', icon: FolderOpen },
] as const;

const rightItems = [
  { label: 'Jobs', href: '/jobs', icon: ClipboardList },
  { label: 'More', href: '/more', icon: Menu },
] as const;

const allItems = [...leftItems, ...rightItems];

export function BottomNavigation({ onCreatePress }: BottomNavigationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  const activeHref = allItems.find((item) => isActive(item.href))?.href ?? null;

  // Tracks each tab's measured layout so the animated highlight pill can
  // glide to the correct x position/width whenever the active tab changes.
  const [layouts, setLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);
  const indicatorOpacity = useSharedValue(0);
  const hasMeasured = useRef(false);

  useEffect(() => {
    if (activeHref && layouts[activeHref]) {
      const { x, width } = layouts[activeHref];
      const config = { damping: 18, stiffness: 220, mass: 0.6 };
      indicatorX.value = withSpring(x, config);
      indicatorWidth.value = withSpring(width, config);
      indicatorOpacity.value = withSpring(1, config);
      hasMeasured.current = true;
    }
  }, [activeHref, layouts]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    width: indicatorWidth.value,
    opacity: indicatorOpacity.value,
  }));

  const handleItemLayout = (href: string) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setLayouts((prev) => {
      const existing = prev[href];
      if (existing && existing.x === x && existing.width === width) return prev;
      return { ...prev, [href]: { x, width } };
    });
  };

  const renderItem = (item: (typeof leftItems)[number] | (typeof rightItems)[number]) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <Pressable
        key={item.href}
        onPress={() => router.push(item.href as any)}
        onLayout={handleItemLayout(item.href)}
        style={styles.item}
        accessibilityRole="button"
        accessibilityLabel={item.label}
      >
        <Animated.View style={active ? styles.iconActiveBump : undefined}>
          <Icon size={21} color={active ? colors.indigo : colors.gray400} strokeWidth={2.2} />
        </Animated.View>
        <Text
          style={[
            typography.tiny,
            { color: active ? colors.indigo : colors.gray400, textTransform: 'none' },
          ]}
        >
          {item.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.floatWrap, { paddingBottom: Math.max(insets.bottom, 14) }]} pointerEvents="box-none">
      <View style={[styles.container, { height: sizes.bottomNavHeight }]}>
        <BlurView intensity={48} tint="light" style={StyleSheet.absoluteFill} />
        <View style={styles.glassOverlay} pointerEvents="none" />

        <View style={styles.row}>
          <View style={styles.group}>
            {hasMeasured.current && (
              <Animated.View style={[styles.indicator, indicatorStyle]} pointerEvents="none" />
            )}
            {leftItems.map(renderItem)}
          </View>
          {/* Reserves horizontal space for the floating CREATE button so the
              two side groups stay evenly split around the true bar center. */}
          <View style={styles.middleSpacer} pointerEvents="none" />
          <View style={styles.group}>{rightItems.map(renderItem)}</View>
        </View>

        {/* Rendered as a direct sibling of `row` (not nested inside one of its
            flex children) and centered against the full-width `container`, so
            its horizontal centering never depends on the side groups' content
            being symmetric. */}
        <CreateButton onPress={onCreatePress} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  container: {
    position: 'relative',
    width: '100%',
    maxWidth: 480,
    flexDirection: 'row',
    paddingTop: 10,
    borderRadius: radius.xl + 4,
    overflow: 'hidden',
    backgroundColor: Platform.select({ web: 'rgba(255, 255, 255, 0.62)', default: 'rgba(255, 255, 255, 0.5)' }),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.55)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(20px) saturate(160%)',
        boxShadow: '0 12px 32px rgba(15, 18, 40, 0.16), 0 2px 8px rgba(15, 18, 40, 0.08)',
      },
      default: {
        shadowColor: '#0B0E1A',
        shadowOpacity: 0.18,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 8 },
        elevation: 12,
      },
    }),
  },
  glassOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.7)',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  group: {
    flex: 1,
    flexDirection: 'row',
    position: 'relative',
  },
  middleSpacer: {
    width: sizes.createButtonSize,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    zIndex: 1,
  },
  iconActiveBump: {
    transform: [{ translateY: -1 }],
  },
  indicator: {
    position: 'absolute',
    top: 2,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.indigoTint,
  },
});
