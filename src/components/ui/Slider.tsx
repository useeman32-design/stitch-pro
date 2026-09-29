import React, { useCallback, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { colors, radius } from '@/theme';

interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onValueChange: (value: number) => void;
  onSlidingComplete?: (value: number) => void;
  accessibilityLabel?: string;
  trackColor?: string;
  fillColor?: string;
}

/**
 * A real drag-to-seek slider (mouse + touch), built without extra
 * dependencies so it works in the web export target. Used for stitch
 * density and the custom color RGB pickers.
 */
export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onValueChange,
  onSlidingComplete,
  accessibilityLabel,
  trackColor = colors.gray200,
  fillColor = colors.indigo,
}: SliderProps) {
  const trackRef = useRef<View>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [rect, setRect] = useState<{ left: number; width: number } | null>(null);

  const pct = Math.max(0, Math.min(1, (value - min) / (max - min || 1)));

  const commit = useCallback(
    (ratio: number) => {
      const clamped = Math.max(0, Math.min(1, ratio));
      let raw = min + clamped * (max - min);
      if (step) raw = Math.round(raw / step) * step;
      raw = Math.max(min, Math.min(max, raw));
      onValueChange(raw);
    },
    [min, max, step, onValueChange]
  );

  const measureAndCommit = useCallback(
    (clientX: number, measured?: { left: number; width: number }) => {
      const r = measured || rect;
      if (!r || r.width <= 0) return;
      commit((clientX - r.left) / r.width);
    },
    [rect, commit]
  );

  const handleStart = useCallback(
    (e: any) => {
      const node = trackRef.current as any;
      if (!node || typeof node.measure !== 'function') return;
      node.measure((_x: number, _y: number, width: number, _height: number, pageX: number) => {
        const measured = { left: pageX, width };
        setRect(measured);
        setDragging(true);
        const clientX = e.nativeEvent?.pageX ?? e.nativeEvent?.clientX ?? 0;
        measureAndCommit(clientX, measured);
      });
    },
    [measureAndCommit]
  );

  const handleMove = useCallback(
    (e: any) => {
      const clientX = e.nativeEvent?.pageX ?? e.nativeEvent?.clientX ?? 0;
      measureAndCommit(clientX);
    },
    [measureAndCommit]
  );

  const handleEnd = useCallback(() => {
    setDragging(false);
    onSlidingComplete?.(value);
  }, [onSlidingComplete, value]);

  // Web also gets native pointer events for pixel-accurate dragging outside
  // the track bounds (mouse can leave the element while dragging).
  const webHandlers =
    Platform.OS === 'web'
      ? {
          onMouseDown: handleStart,
          onMouseMove: dragging ? handleMove : undefined,
          onMouseUp: handleEnd,
          onMouseLeave: dragging ? handleMove : undefined,
        }
      : {};

  return (
    <View
      ref={trackRef}
      accessibilityLabel={accessibilityLabel}
      style={styles.hitArea}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={handleStart}
      onResponderMove={handleMove}
      onResponderRelease={handleEnd}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      {...webHandlers}
    >
      <View style={[styles.track, { backgroundColor: trackColor }]}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: fillColor }]} />
      </View>
      <View
        style={[
          styles.thumb,
          {
            left: `${pct * 100}%`,
            borderColor: fillColor,
            transform: [{ translateX: -11 }, { scale: dragging ? 1.15 : 1 }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hitArea: {
    height: 32,
    justifyContent: 'center',
    // @ts-ignore web-only cursor affordance
    cursor: Platform.OS === 'web' ? 'pointer' : undefined,
  },
  track: {
    height: 6,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  thumb: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.white,
    borderWidth: 3,
    top: 5,
    shadowColor: colors.navy,
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});
