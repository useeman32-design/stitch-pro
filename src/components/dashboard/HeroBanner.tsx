import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { gradients, colors, radius, spacing, typography } from '@/theme';
import { useResponsive } from '@/hooks/useResponsive';
import { heroSlides } from '@/constants/heroSlides';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const ROTATE_INTERVAL_MS = 5500;
const FADE_OUT_MS = 260;
const FADE_IN_MS = 420;

export function HeroBanner() {
  const router = useRouter();
  const { isMobile } = useResponsive();
  const [index, setIndex] = useState(0);
  const opacity = useSharedValue(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      opacity.value = withTiming(0, { duration: FADE_OUT_MS, easing: Easing.in(Easing.quad) }, (done) => {
        if (done) {
          runOnJS(setIndex)((prev) => (prev + 1) % heroSlides.length);
        }
      });
    }, ROTATE_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: FADE_IN_MS, easing: Easing.out(Easing.quad) });
  }, [index]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const slide = heroSlides[index];
  const cardHeight = isMobile ? 168 : 196;

  return (
    <LinearGradient
      colors={gradients.heroPromo}
      start={{ x: 0, y: 0.15 }}
      end={{ x: 1, y: 0.95 }}
      style={[styles.container, { height: cardHeight }]}
    >
      {/* Ambient glow */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <RadialGradient id="glow" cx="82%" cy="30%" r="70%">
            <Stop offset="0%" stopColor="#6F8CFF" stopOpacity={0.35} />
            <Stop offset="55%" stopColor="#5B4FE8" stopOpacity={0.12} />
            <Stop offset="100%" stopColor="#5B4FE8" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#glow)" />
      </Svg>

      {/* Product visual — right side, bleeding to the edge */}
      <Animated.View style={[styles.imageWrap, fadeStyle]} pointerEvents="none">
        <Image source={slide.image} style={styles.image} resizeMode="cover" />
        <LinearGradient
          colors={['#090B16', 'rgba(9,11,22,0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.imageFade}
        />
      </Animated.View>

      {/* Text content — left side */}
      <View style={[styles.textCol, isMobile && styles.textColMobile]}>
        <Animated.View style={fadeStyle}>
          <Text
            style={[typography.h1, styles.title, isMobile && styles.titleMobile]}
            numberOfLines={2}
          >
            {slide.lines[0]}
            {'\n'}
            {slide.lines[1]}
          </Text>
        </Animated.View>

        <AnimatedPressable
          onPress={() => router.push('/create')}
          style={[styles.cta, isMobile && styles.ctaMobile, fadeStyle]}
        >
          <Text style={[typography.button, { color: colors.indigo }]}>Create New</Text>
          <ArrowRight size={16} color={colors.indigo} strokeWidth={2.5} />
        </AnimatedPressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  textCol: {
    width: '62%',
    paddingLeft: spacing.xl,
    paddingRight: spacing.sm,
    gap: spacing.md,
  },
  textColMobile: {
    width: '58%',
    paddingLeft: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    color: colors.white,
    fontSize: 27,
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  titleMobile: {
    fontSize: 21,
    lineHeight: 24,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.white,
    borderRadius: radius.button,
    paddingHorizontal: spacing.md,
    height: 42,
  },
  ctaMobile: {
    height: 38,
    paddingHorizontal: spacing.sm + 2,
  },
  imageWrap: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '46%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFade: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '55%',
  },
});
