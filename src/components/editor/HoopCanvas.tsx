import React from 'react';
import { ImageBackground, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, radius, shadows } from '@/theme';
import { CANVAS_SIZE } from './types';

interface HoopCanvasProps {
  children: React.ReactNode;
  onBackgroundPress?: () => void;
}

/** Fixed-size fabric + hoop stage that hosts the manual editor's elements. */
export function HoopCanvas({ children, onBackgroundPress }: HoopCanvasProps) {
  return (
    <View style={[styles.outer, shadows.card as object]}>
      <ImageBackground
        source={require('@/assets/embroidery/fabric-texture.jpg')}
        style={styles.canvas}
        imageStyle={styles.bgImage}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onBackgroundPress} />
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width="100%" height="100%">
            <Circle
              cx="50%"
              cy="50%"
              r={CANVAS_SIZE * 0.47}
              stroke="#C9CDD8"
              strokeWidth={6}
              fill="none"
              opacity={0.55}
            />
            <Circle
              cx="50%"
              cy="50%"
              r={CANVAS_SIZE * 0.47}
              stroke="#8A8F9C"
              strokeWidth={1.5}
              fill="none"
              opacity={0.4}
            />
          </Svg>
        </View>
        {children}
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    borderRadius: radius.card,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  canvas: {
    width: '100%',
    height: '100%',
  },
  bgImage: {
    opacity: 0.9,
  },
});
