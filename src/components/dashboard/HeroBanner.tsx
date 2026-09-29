import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { gradients, colors, radius, spacing, typography } from '@/theme';
import { useResponsive } from '@/hooks/useResponsive';
import { heroSlides, type HeroSlide } from '@/constants/heroSlides';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Slower, calmer rotation — long enough to read comfortably before it changes.
const ROTATE_INTERVAL_MS = 8000;
const CROSSFADE_MS = 750;

// A dark indigo-navy blend used to melt the product photo's edge into the
// card background (matches the mid-tone of the heroPromo gradient near the
// seam, rather than a flat color, so there's no visible hard rectangle).
const SEAM_COLOR = '#15123f';

/**
 * Picks a font size so a given headline line never wraps or overflows its
 * column, regardless of how long that particular slide's copy is. RN Web
 * doesn't support adjustsFontSizeToFit, so we approximate with a
 * character-count heuristic tuned against the longest known headline.
 */
function fitFontSize(text: string, baseSize: number, maxChars: number, minSize: number) {
  if (text.length <= maxChars) return baseSize;
  const scaled = Math.floor(baseSize * (maxChars / text.length));
  return Math.max(minSize, scaled);
}

function HeroForeground({
  slide,
  isMobile,
  onCreate,
}: {
  slide: HeroSlide;
  isMobile: boolean;
  onCreate: () => void;
}) {
  // Both lines share one consistent size, chosen so the longer of the two
  // never wraps or overflows its column — scaled down only when needed.
  const longestChars = Math.max(slide.lines[0].length, slide.lines[1].length);
  const size = isMobile
    ? fitFontSize('x'.repeat(longestChars), 21, 14, 16)
    : fitFontSize('x'.repeat(longestChars), 27, 18, 21);
  const lineHeight = size + 3;

  return (
    <>
      {/* Product visual — right side, bleeding to the edge */}
      <View style={styles.imageWrap} pointerEvents="none">
        <Image source={slide.image} style={styles.image} resizeMode="cover" />
        <LinearGradient
          colors={[SEAM_COLOR, 'rgba(21,18,63,0.75)', 'rgba(21,18,63,0.25)', 'rgba(21,18,63,0)']}
          locations={[0, 0.35, 0.68, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.imageFade}
        />
      </View>

      {/* Text content — left side */}
      <View style={[styles.textCol, isMobile && styles.textColMobile]}>
        <View>
          <Text
            style={[typography.h1, styles.title, { fontSize: size, lineHeight }]}
            numberOfLines={1}
            ellipsizeMode="clip"
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {slide.lines[0]}
          </Text>
          <Text
            style={[typography.h1, styles.title, { fontSize: size, lineHeight }]}
            numberOfLines={1}
            ellipsizeMode="clip"
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {slide.lines[1]}
          </Text>
        </View>

        <Pressable onPress={onCreate} style={[styles.cta, isMobile && styles.ctaMobile]}>
          <Text style={[typography.button, { color: colors.indigo }]}>Create New</Text>
          <ArrowRight size={16} color={colors.indigo} strokeWidth={2.5} />
        </Pressable>
      </View>
    </>
  );
}

export function HeroBanner() {
  const router = useRouter();
  const { isMobile } = useResponsive();
  const [current, setCurrent] = useState(0);
  const [previous, setPrevious] = useState<number | null>(null);
  const currentRef = useRef(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    const id = setInterval(() => {
      const prevIdx = currentRef.current;
      const nextIdx = (prevIdx + 1) % heroSlides.length;
      currentRef.current = nextIdx;
      setPrevious(prevIdx);
      setCurrent(nextIdx);
      opacity.value = 0;
      opacity.value = withTiming(1, { duration: CROSSFADE_MS, easing: Easing.out(Easing.cubic) }, (done) => {
        if (done) {
          // Clear the outgoing layer once fully covered — avoids keeping an
          // extra hidden image mounted between rotations.
          setTimeout(() => setPrevious(null), 0);
        }
      });
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  const cardHeight = isMobile ? 168 : 196;
  const goCreate = () => router.push('/create');

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

      {/* Seam blend: a soft shadow band straddling where the image meets the
          background, so the two surfaces read as one continuous scene. */}
      <View style={styles.seamBand} pointerEvents="none">
        <LinearGradient
          colors={['rgba(21,18,63,0)', 'rgba(21,18,63,0.5)', 'rgba(21,18,63,0)']}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </View>

      {previous !== null && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <HeroForeground slide={heroSlides[previous]} isMobile={isMobile} onCreate={goCreate} />
        </View>
      )}

      <Animated.View style={[StyleSheet.absoluteFill, fadeStyle]}>
        <HeroForeground slide={heroSlides[current]} isMobile={isMobile} onCreate={goCreate} />
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  seamBand: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '36%',
    width: '30%',
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
    letterSpacing: -0.3,
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
    width: '68%',
  },
});
