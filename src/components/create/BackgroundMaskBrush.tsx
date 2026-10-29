import React, { useCallback, useRef, useState } from 'react';
import { Image, LayoutChangeEvent, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Pattern, Polyline, Rect } from 'react-native-svg';
import { Eraser, Paintbrush2 } from 'lucide-react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { Slider } from '@/components/ui/Slider';
import { Chip } from '@/components/ui/Chip';
import type { BgStroke } from '@/services/digitizing/backendClient';

interface BackgroundMaskBrushProps {
  /** The image to paint over -- normally the background-removed preview,
   * shown on a checkerboard so the current mask (what's already treated
   * as background/transparent) is visible while brushing. */
  imageUri: string;
  /** Every confirmed stroke so far (brief: "an adjustable-size brush to
   * manually restore or erase parts of the background-removal mask"). */
  strokes: BgStroke[];
  onAddStroke: (stroke: BgStroke) => void;
  onClearStrokes: () => void;
}

/**
 * Freehand restore/erase brush over a background-removal preview image.
 * Every finished stroke is recorded in *normalized* (0..1) image-relative
 * coordinates + a normalized brush radius (see `BgStroke`), not raw screen
 * pixels -- so it reproduces the identical correction no matter what
 * resolution this preview happens to be displayed at vs. whatever
 * resolution the backend actually processes the image at (see
 * `apply_mask_strokes` on the backend). Uses the same
 * onStartShouldSetResponder/onResponderMove (native) + onMouseDown/Move/Up
 * (web) dual pattern as EmbossedStitchCanvas's own pan/zoom gestures, the
 * established way this app captures drag gestures identically on both
 * platforms.
 */
export function BackgroundMaskBrush({ imageUri, strokes, onAddStroke, onClearStrokes }: BackgroundMaskBrushProps) {
  const [mode, setMode] = useState<'restore' | 'erase'>('erase');
  const [radiusPct, setRadiusPct] = useState(8); // 0..100, mapped to a 0.02..0.22 normalized radius
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const [livePoints, setLivePoints] = useState<[number, number][] | null>(null);
  const containerRef = useRef<React.ElementRef<typeof View> | null>(null);
  const pageOffsetRef = useRef({ x: 0, y: 0 });
  const drawingRef = useRef(false);

  const radius01 = 0.02 + (radiusPct / 100) * 0.2;

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setLayout({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height });
    const node = containerRef.current as unknown as {
      measure?: (cb: (x: number, y: number, w: number, h: number, pageX: number, pageY: number) => void) => void;
    } | null;
    node?.measure?.((_x, _y, _w, _h, pageX, pageY) => {
      pageOffsetRef.current = { x: pageX, y: pageY };
    });
  }, []);

  const toNormalized = useCallback(
    (screenX: number, screenY: number): [number, number] | null => {
      if (layout.width <= 0 || layout.height <= 0) return null;
      const x = (screenX - pageOffsetRef.current.x) / layout.width;
      const y = (screenY - pageOffsetRef.current.y) / layout.height;
      if (x < 0 || x > 1 || y < 0 || y > 1) return null;
      return [x, y];
    },
    [layout]
  );

  const beginStroke = useCallback(
    (screenX: number, screenY: number) => {
      const pt = toNormalized(screenX, screenY);
      if (!pt) return;
      drawingRef.current = true;
      setLivePoints([pt]);
    },
    [toNormalized]
  );

  const extendStroke = useCallback(
    (screenX: number, screenY: number) => {
      if (!drawingRef.current) return;
      const pt = toNormalized(screenX, screenY);
      if (!pt) return;
      setLivePoints((prev) => (prev ? [...prev, pt] : [pt]));
    },
    [toNormalized]
  );

  const endStroke = useCallback(() => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    setLivePoints((prev) => {
      if (prev && prev.length > 0) {
        onAddStroke({ mode, radius: radius01, points: prev });
      }
      return null;
    });
  }, [mode, radius01, onAddStroke]);

  const isWeb = Platform.OS === 'web';
  // `style` is deliberately kept out of this spread object and merged into
  // the stage View's own `style` *array* instead (see `webOnlyStyle` at the
  // JSX below) -- spreading `{...webOnlyProps}` after `style={styles.stage}`
  // would otherwise let this object's own `style` key silently replace
  // (not merge with) `styles.stage` entirely, discarding its fixed
  // `height: 280` and collapsing the whole brush canvas to 0 height on web
  // (same class of bug DesignRegionCropper's own `webOnlyStyle` comment
  // documents -- see that component for the full story).
  const webOnlyStyle: Record<string, unknown> = isWeb ? { cursor: 'crosshair' } : {};
  const webOnlyProps: Record<string, unknown> = isWeb
    ? {
        onMouseDown: (e: any) => beginStroke(e.nativeEvent.pageX, e.nativeEvent.pageY),
        onMouseMove: (e: any) => extendStroke(e.nativeEvent.pageX, e.nativeEvent.pageY),
        onMouseUp: endStroke,
        onMouseLeave: endStroke,
      }
    : {};

  const radiusPx = radius01 * Math.min(layout.width || 1, layout.height || 1);

  return (
    <View style={styles.wrap}>
      <View style={styles.toolbar}>
        <View style={styles.modeRow}>
          <Chip
            label="Restore"
            active={mode === 'restore'}
            onPress={() => setMode('restore')}
            icon={<Paintbrush2 size={13} color={mode === 'restore' ? colors.white : colors.textSecondary} />}
          />
          <Chip
            label="Erase"
            active={mode === 'erase'}
            onPress={() => setMode('erase')}
            icon={<Eraser size={13} color={mode === 'erase' ? colors.white : colors.textSecondary} />}
          />
        </View>
        <Text
          onPress={strokes.length ? onClearStrokes : undefined}
          style={[typography.caption, styles.clearLink, !strokes.length && styles.clearLinkDisabled]}
        >
          Clear brush edits{strokes.length ? ` (${strokes.length})` : ''}
        </Text>
      </View>

      <View style={styles.sizeRow}>
        <Text style={[typography.caption, styles.sizeLabel]}>Brush size</Text>
        <View style={{ flex: 1 }}>
          <Slider value={radiusPct} min={2} max={40} step={1} onValueChange={setRadiusPct} accessibilityLabel="Brush size" />
        </View>
      </View>

      <View
        ref={containerRef}
        style={[styles.stage, webOnlyStyle]}
        onLayout={onLayout}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => beginStroke(e.nativeEvent.pageX, e.nativeEvent.pageY)}
        onResponderMove={(e) => extendStroke(e.nativeEvent.pageX, e.nativeEvent.pageY)}
        onResponderRelease={endStroke}
        onResponderTerminate={endStroke}
        {...webOnlyProps}
      >
        <Checkerboard />
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
        {layout.width > 0 && layout.height > 0 && (
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
            {strokes.map((s, i) => (
              <StrokePreview key={i} stroke={s} width={layout.width} height={layout.height} />
            ))}
            {livePoints && livePoints.length > 0 && (
              <StrokePreview
                stroke={{ mode, radius: radius01, points: livePoints }}
                width={layout.width}
                height={layout.height}
              />
            )}
          </Svg>
        )}
      </View>
      <Text style={[typography.caption, styles.hint]}>
        Drag to {mode === 'erase' ? 'mark more of the image as background' : 'bring part of the design back'} — brush
        radius ≈ {Math.round(radiusPx)}px at this preview size.
      </Text>
    </View>
  );
}

function StrokePreview({ stroke, width, height }: { stroke: BgStroke; width: number; height: number }) {
  const color = stroke.mode === 'erase' ? 'rgba(220, 38, 38, 0.35)' : 'rgba(34, 197, 94, 0.35)';
  const strokeColor = stroke.mode === 'erase' ? 'rgba(220, 38, 38, 0.7)' : 'rgba(34, 197, 94, 0.7)';
  const r = stroke.radius * Math.min(width, height);
  const screenPts = stroke.points.map(([nx, ny]) => `${nx * width},${ny * height}`).join(' ');
  return (
    <>
      <Polyline points={screenPts} fill="none" stroke={color} strokeWidth={r * 2} strokeLinecap="round" strokeLinejoin="round" />
      {stroke.points.map(([nx, ny], i) => (
        <Circle key={i} cx={nx * width} cy={ny * height} r={2} fill={strokeColor} />
      ))}
    </>
  );
}

function Checkerboard() {
  const tile = 10;
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <Pattern id="checker-brush" width={tile * 2} height={tile * 2} patternUnits="userSpaceOnUse">
          <Rect x={0} y={0} width={tile * 2} height={tile * 2} fill="#F4F3EF" />
          <Rect x={0} y={0} width={tile} height={tile} fill="#E2E0D8" />
          <Rect x={tile} y={tile} width={tile} height={tile} fill="#E2E0D8" />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill="url(#checker-brush)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  clearLink: {
    color: colors.indigo,
  },
  clearLinkDisabled: {
    color: colors.textTertiary,
  },
  sizeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sizeLabel: {
    color: colors.textSecondary,
    width: 72,
  },
  stage: {
    height: 280,
    borderRadius: radius.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.gray100,
  },
  image: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  hint: {
    color: colors.textTertiary,
  },
});
