import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, LayoutChangeEvent, Platform, StyleSheet, View } from 'react-native';
import { colors, radius } from '@/theme';
import type { DesignRegionCrop } from '@/services/digitizing/backendClient';

interface DesignRegionCropperProps {
  imageUri: string;
  /** Normalized (0..1) crop box, e.g. the suggestion from
   * `detectDesignRegionViaBackend` or whatever the user has dragged it to
   * since. */
  value: DesignRegionCrop;
  onChange: (next: DesignRegionCrop) => void;
  /** Fixed stage height -- the box is always letterboxed ("contain") to
   * fit the real image's own aspect ratio inside this, same approach as
   * VectorRegionEditor's own stage-sizing (see that component's own
   * comment on why: avoids dead/blank margins that look draggable but
   * silently aren't). */
  stageHeight?: number;
}

type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se' | null;

const HANDLE_HIT_PX = 26;
const MIN_BOX_SIZE = 0.06;

/**
 * Draggable/resizable crop-rectangle overlay on top of a photo -- the
 * adjustable half of the "hybrid auto-detect + user-adjustable crop-
 * confirm step" design-region extraction approach (see
 * create/auto-digitize/design-region.tsx). Pre-populated from the
 * backend's own suggested box, but every corner can be dragged to resize
 * it and the box body can be dragged to move it, so a wrong or
 * low-confidence suggestion is never the final word -- the user always
 * gets to confirm or fix it before anything is actually cropped.
 *
 * Uses the same dual onStartShouldSetResponder/onResponderMove (native) +
 * onMouseDown/Move/Up (web) gesture pattern as BackgroundMaskBrush and
 * VectorRegionEditor, including VectorRegionEditor's own
 * getBoundingClientRect()-on-drag-start fix for web's unreliable
 * `View.measure()` page offsets (see that component's own comment for the
 * full story of the bug that fix addresses).
 */
export function DesignRegionCropper({ imageUri, value, onChange, stageHeight = 340 }: DesignRegionCropperProps) {
  const [naturalAspect, setNaturalAspect] = useState(1);
  const [wrapWidth, setWrapWidth] = useState(0);
  const containerRef = useRef<React.ElementRef<typeof View> | null>(null);
  const pageOffsetRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef<{ mode: DragMode; startX: number; startY: number; startBox: DesignRegionCrop } | null>(
    null
  );
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const isWeb = Platform.OS === 'web';

  useEffect(() => {
    let cancelled = false;
    Image.getSize(
      imageUri,
      (w, h) => {
        if (!cancelled && w > 0 && h > 0) setNaturalAspect(w / h);
      },
      () => {
        /* keep the previous/default aspect -- the stage still renders, just
         * possibly letterboxed slightly wrong until a real size is known */
      }
    );
    return () => {
      cancelled = true;
    };
  }, [imageUri]);

  // Stage box fit to the real image's aspect ratio within the available
  // row width, capped at `stageHeight` -- identical technique to
  // VectorRegionEditor's own stageBoxSize derivation.
  let stageWidth = wrapWidth || stageHeight * naturalAspect;
  let stageHeightFit = stageWidth / naturalAspect;
  if (stageHeightFit > stageHeight) {
    stageHeightFit = stageHeight;
    stageWidth = stageHeight * naturalAspect;
  }

  const refreshWebOffset = () => {
    if (!isWeb) return;
    const node = containerRef.current as unknown as { getBoundingClientRect?: () => { left: number; top: number } } | null;
    const rect = node?.getBoundingClientRect?.();
    if (rect) pageOffsetRef.current = { x: rect.left, y: rect.top };
  };

  const onLayout = (_e: LayoutChangeEvent) => {
    if (isWeb) {
      refreshWebOffset();
      return;
    }
    const node = containerRef.current as unknown as {
      measure?: (cb: (x: number, y: number, w: number, h: number, pageX: number, pageY: number) => void) => void;
    } | null;
    node?.measure?.((_x, _y, _w, _h, pageX, pageY) => {
      pageOffsetRef.current = { x: pageX, y: pageY };
    });
  };

  const toLocal = useCallback((screenX: number, screenY: number) => {
    return {
      x: (screenX - pageOffsetRef.current.x) / Math.max(1, stageWidth),
      y: (screenY - pageOffsetRef.current.y) / Math.max(1, stageHeightFit),
    };
  }, [stageWidth, stageHeightFit]);

  const hitTest = useCallback(
    (localX: number, localY: number): DragMode => {
      const box = valueRef.current;
      const px = (n: number) => n * stageWidth;
      const py = (n: number) => n * stageHeightFit;
      const corners: [DragMode, number, number][] = [
        ['nw', px(box.x0), py(box.y0)],
        ['ne', px(box.x1), py(box.y0)],
        ['sw', px(box.x0), py(box.y1)],
        ['se', px(box.x1), py(box.y1)],
      ];
      for (const [mode, cx, cy] of corners) {
        const screenX = localX * stageWidth;
        const screenY = localY * stageHeightFit;
        if (Math.hypot(screenX - cx, screenY - cy) <= HANDLE_HIT_PX) return mode;
      }
      if (localX >= box.x0 && localX <= box.x1 && localY >= box.y0 && localY <= box.y1) return 'move';
      return null;
    },
    [stageWidth, stageHeightFit]
  );

  const beginDrag = useCallback(
    (screenX: number, screenY: number) => {
      const local = toLocal(screenX, screenY);
      const mode = hitTest(local.x, local.y);
      if (!mode) return;
      dragRef.current = { mode, startX: local.x, startY: local.y, startBox: valueRef.current };
    },
    [toLocal, hitTest]
  );

  const extendDrag = useCallback(
    (screenX: number, screenY: number) => {
      const drag = dragRef.current;
      if (!drag) return;
      const local = toLocal(screenX, screenY);
      const dx = local.x - drag.startX;
      const dy = local.y - drag.startY;
      const start = drag.startBox;
      let next: DesignRegionCrop = { ...start };

      if (drag.mode === 'move') {
        const w = start.x1 - start.x0;
        const h = start.y1 - start.y0;
        let x0 = start.x0 + dx;
        let y0 = start.y0 + dy;
        x0 = Math.min(Math.max(0, x0), 1 - w);
        y0 = Math.min(Math.max(0, y0), 1 - h);
        next = { x0, y0, x1: x0 + w, y1: y0 + h };
      } else {
        if (drag.mode === 'nw' || drag.mode === 'sw') {
          next.x0 = Math.min(Math.max(0, start.x0 + dx), start.x1 - MIN_BOX_SIZE);
        }
        if (drag.mode === 'ne' || drag.mode === 'se') {
          next.x1 = Math.max(Math.min(1, start.x1 + dx), start.x0 + MIN_BOX_SIZE);
        }
        if (drag.mode === 'nw' || drag.mode === 'ne') {
          next.y0 = Math.min(Math.max(0, start.y0 + dy), start.y1 - MIN_BOX_SIZE);
        }
        if (drag.mode === 'sw' || drag.mode === 'se') {
          next.y1 = Math.max(Math.min(1, start.y1 + dy), start.y0 + MIN_BOX_SIZE);
        }
      }
      onChange(next);
    },
    [toLocal, onChange]
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
  }, []);

  // Mouse coordinates here deliberately use `clientX`/`clientY` (viewport-
  // relative), paired with `refreshWebOffset`'s own `getBoundingClientRect()`
  // (also viewport-relative) -- same reasoning as VectorRegionEditor's own
  // `refreshWebStageOffset` (see that component's comment for the full
  // story of the web-only page-offset bug this avoids). Called directly
  // in the gesture-start handler, not inside `beginDrag` itself, so it
  // isn't a stale closure dependency `beginDrag`'s own `useCallback` would
  // otherwise need to track.
  // NOTE: `style` is deliberately split out of this object and merged into
  // the stage's own `style` *array* below (rather than spread directly onto
  // the <View>) -- spreading `{...webOnlyProps}` after the stage's real
  // `style={[styles.stage, { width, height }]}` prop would otherwise let
  // this object's own `style` key silently clobber (not merge with) that
  // whole array, collapsing the stage back to a heightless 0x0 box on web
  // (the image/crop box/handles all inherit that same collapsed size,
  // since they're positioned relative to it) -- exactly the "blank gray
  // crop screen" bug this comment is here to stop someone reintroducing.
  const webOnlyStyle: Record<string, unknown> = isWeb ? { cursor: 'crosshair' } : {};
  const webOnlyProps: Record<string, unknown> = isWeb
    ? {
        onMouseDown: (e: any) => {
          refreshWebOffset();
          beginDrag(e.nativeEvent.clientX ?? e.nativeEvent.pageX, e.nativeEvent.clientY ?? e.nativeEvent.pageY);
        },
        onMouseMove: (e: any) => extendDrag(e.nativeEvent.clientX ?? e.nativeEvent.pageX, e.nativeEvent.clientY ?? e.nativeEvent.pageY),
        onMouseUp: endDrag,
        onMouseLeave: endDrag,
      }
    : {};

  const boxLeft = value.x0 * stageWidth;
  const boxTop = value.y0 * stageHeightFit;
  const boxWidth = (value.x1 - value.x0) * stageWidth;
  const boxHeight = (value.y1 - value.y0) * stageHeightFit;

  return (
    <View
      style={{ width: '100%' }}
      onLayout={(e) => setWrapWidth(e.nativeEvent.layout.width)}
    >
      <View
        ref={containerRef}
        onLayout={onLayout}
        style={[styles.stage, { width: stageWidth, height: stageHeightFit }, webOnlyStyle]}
        onStartShouldSetResponder={() => true}
        onResponderGrant={(e) => beginDrag(e.nativeEvent.pageX, e.nativeEvent.pageY)}
        onResponderMove={(e) => extendDrag(e.nativeEvent.pageX, e.nativeEvent.pageY)}
        onResponderRelease={endDrag}
        onResponderTerminate={endDrag}
        {...webOnlyProps}
      >
        <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} resizeMode="contain" />

        {/* Dimmed mask outside the crop box -- four rectangles, simpler and
         * more reliably cross-platform than SVG masking. */}
        <View pointerEvents="none" style={[styles.dim, { left: 0, top: 0, right: 0, height: Math.max(0, boxTop) }]} />
        <View
          pointerEvents="none"
          style={[styles.dim, { left: 0, top: boxTop + boxHeight, right: 0, bottom: 0 }]}
        />
        <View pointerEvents="none" style={[styles.dim, { left: 0, top: boxTop, width: Math.max(0, boxLeft), height: boxHeight }]} />
        <View
          pointerEvents="none"
          style={[styles.dim, { left: boxLeft + boxWidth, top: boxTop, right: 0, height: boxHeight }]}
        />

        <View pointerEvents="none" style={[styles.box, { left: boxLeft, top: boxTop, width: boxWidth, height: boxHeight }]} />

        {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => {
          const cx = corner.includes('w') ? boxLeft : boxLeft + boxWidth;
          const cy = corner.includes('n') ? boxTop : boxTop + boxHeight;
          return (
            <View
              key={corner}
              pointerEvents="none"
              style={[styles.handle, { left: cx - 8, top: cy - 8 }]}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    backgroundColor: colors.gray100,
    borderRadius: radius.card,
    overflow: 'hidden',
    position: 'relative',
    alignSelf: 'center',
  },
  dim: {
    position: 'absolute',
    backgroundColor: 'rgba(15, 15, 20, 0.55)',
  },
  box: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: colors.white,
  },
  handle: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.indigo,
  },
});
