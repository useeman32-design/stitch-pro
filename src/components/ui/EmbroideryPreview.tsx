import React from 'react';
import { Image, ImageBackground, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, radius, shadows } from '@/theme';

interface EmbroideryPreviewProps {
  source: ImageSourcePropType;
  height?: number;
  showHoop?: boolean;
}

/**
 * Renders artwork/design imagery inside a realistic fabric-hoop mockup so
 * even a plain uploaded image reads as "an embroidery preview" rather than
 * a raw picture — used across Analysis, Settings and Preview steps.
 */
export function EmbroideryPreview({ source, height = 240, showHoop = true }: EmbroideryPreviewProps) {
  return (
    <ImageBackground
      source={require('@/assets/embroidery/fabric-texture.png')}
      style={[styles.container, { height }, shadows.card as object]}
      imageStyle={styles.bgImage}
    >
      <View style={[StyleSheet.absoluteFill, styles.vignette]} />
      {showHoop && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Svg width="100%" height="100%">
            <Circle
              cx="50%"
              cy="50%"
              r={Math.min(height, 320) * 0.42}
              stroke="#C9CDD8"
              strokeWidth={6}
              fill="none"
              opacity={0.55}
            />
            <Circle
              cx="50%"
              cy="50%"
              r={Math.min(height, 320) * 0.42}
              stroke="#8A8F9C"
              strokeWidth={1.5}
              fill="none"
              opacity={0.4}
            />
          </Svg>
        </View>
      )}
      <View style={[styles.artWrap, { width: height * 0.62, height: height * 0.62 }]}>
        <Image source={source} style={styles.art} resizeMode="contain" />
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: radius.card,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgImage: {
    opacity: 0.9,
  },
  vignette: {
    backgroundColor: 'rgba(11,14,26,0.12)',
  },
  artWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 10,
    shadowColor: colors.navy,
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  art: {
    width: '100%',
    height: '100%',
    borderRadius: radius.md,
  },
});
