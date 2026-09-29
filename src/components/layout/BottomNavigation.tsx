import React, { useEffect, useState } from 'react';
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
  const [hasMeasured, setHasMeasured] = useState(false);
  const indicatorX = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);
  const indicatorOpacity = useSharedValue(0);

  useEffect(() => {
    if (activeHref && layouts[activeHref]) {
      const { x, width } = layouts[activeHref];
      const config = { damping: 20, stiffness: 260, mass: 0.6 };
      indicatorX.value = withSpring(x, config);
      indicatorWidth.value = withSpring(width, config);
      indicatorOpacity.value = withSpring(1, config);
      if (!hasMeasured) setHasMeasured(true);
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
      {/* `barShell` has NO overflow clipping — it exists purely so the CREATE
          button can float above the glass pill without being cut off by the
          pill's own `overflow: hidden` (which is required for the blur +
          rounded corners to clip correctly). */}
      <View style={styles.barShell}>
        <View style={[styles.container, { height: sizes.bottomNavHeight }]}>
          <BlurView intensity={65} tint="light" style={StyleSheet.absoluteFill} pointerEvents="none" />
          <View style={styles.glassOverlay} pointerEvents="none" />
          <View style={styles.glassTint} pointerEvents="none" />

          <View style={styles.row}>
            <View style={styles.group}>
              {hasMeasured && (
                <Animated.View style={[styles.indicator, indicatorStyle]} pointerEvents="none" />
              )}
              {leftItems.map(renderItem)}
            </View>
            {/* Reserves horizontal space for the floating CREATE button so the
                two side groups stay evenly split around the true bar center. */}
            <View style={styles.middleSpacer} pointerEvents="none" />
            <View style={styles.group}>{rightItems.map(renderItem)}</View>
          </View>
        </View>

        {/* Sibling of the glass pill (not nested inside it), so it isn't
            clipped when it pokes above the pill's top edge. Still centers
            correctly since `barShell` shares the pill's exact width/maxWidth. */}
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
  barShell: {
    position: 'relative',
    width: '100%',
    maxWidth: 480,
  },
  container: {
    position: 'relative',
    width: '100%',
    flexDirection: 'row',
    paddingTop: 10,
    borderRadius: 32,
    overflow: 'hidden',
    backgroundColor: Platform.select({ web: 'rgba(255, 255, 255, 0.55)', default: 'rgba(255, 255, 255, 0.45)' }),
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.65)',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(24px) saturate(180%)',
        boxShadow:
          '0 16px 40px rgba(91, 79, 232, 0.22), 0 4px 14px rgba(15, 18, 40, 0.10), inset 0 1px 0 rgba(255,255,255,0.6)',
      },
      default: {
        shadowColor: colors.indigo,
        shadowOpacity: 0.28,
        shadowRadius: 24,
        shadowOffset: { width: 0, height: 10 },
        elevation: 14,
      },
    }),
  },
  glassOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.75)',
  },
  glassTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(91, 79, 232, 0.05)',
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
