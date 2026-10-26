import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors, typography } from '@/theme';

interface ProgressCircleProps {
  progress: number; // 0 - 1
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  sublabel?: string;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function ProgressCircle({
  progress,
  size = 84,
  strokeWidth = 9,
  color = colors.indigo,
  trackColor = colors.gray100,
  label,
  sublabel,
}: ProgressCircleProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress));

  // Animate the ring's sweep itself rather than snapping `strokeDashoffset`
  // straight to the new value every time `progress` changes. This is a
  // direct fix for the "choppy/non-smooth progress animation" feedback on
  // the Analyzing screen: that screen only advances `progress` in five
  // discrete jumps (once per named step, ~620ms apart), and with a static
  // SVG offset the ring visibly *snapped* from one step to the next
  // instead of sweeping, which reads as broken/janky no matter how the
  // step timing itself is tuned. Animating the underlying shared value
  // with `withTiming` turns every one of those step jumps into a smooth
  // ~550ms sweep, so the ring continuously flows forward for the whole
  // duration instead of jumping in five visible increments -- fixing the
  // perceived choppiness without needing a fake/continuous fallback timer
  // on the caller's side.
  const animatedProgress = useSharedValue(clamped);
  useEffect(() => {
    animatedProgress.value = withTiming(clamped, { duration: 550, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clamped]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animatedProgress.value),
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {(label || sublabel) && (
        <View style={styles.centerLabel}>
          {label ? <Text style={[typography.h3, { color: colors.textPrimary }]}>{label}</Text> : null}
          {sublabel ? (
            <Text style={[typography.tiny, { color: colors.textTertiary }]}>{sublabel}</Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centerLabel: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
