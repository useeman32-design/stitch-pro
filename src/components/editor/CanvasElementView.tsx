import React, { useEffect, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { colors, radius, typography } from '@/theme';
import { ShapeSvg } from './ShapeSvg';
import { CANVAS_SIZE, ELEMENT_BASE_SIZE, type EditorElement } from './types';

interface CanvasElementViewProps {
  element: EditorElement;
  selected: boolean;
  onSelect: () => void;
  onPositionChange: (pos: { x: number; y: number }) => void;
}

/**
 * A single draggable element on the manual-editor canvas. Position is kept
 * as local render state driven by refs (not directly by the `element` prop)
 * so PanResponder's closures never go stale mid-gesture; the final position
 * is only committed back up to the parent on release.
 */
export function CanvasElementView({
  element,
  selected,
  onSelect,
  onPositionChange,
}: CanvasElementViewProps) {
  const posRef = useRef({ x: element.x, y: element.y });
  const dragStartRef = useRef({ x: element.x, y: element.y });
  const onSelectRef = useRef(onSelect);
  const onPositionChangeRef = useRef(onPositionChange);
  onSelectRef.current = onSelect;
  onPositionChangeRef.current = onPositionChange;

  const [renderPos, setRenderPos] = useState(posRef.current);

  useEffect(() => {
    posRef.current = { x: element.x, y: element.y };
    setRenderPos(posRef.current);
  }, [element.x, element.y]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
      onPanResponderGrant: () => {
        dragStartRef.current = posRef.current;
        onSelectRef.current();
      },
      onPanResponderMove: (_, g) => {
        const clampedX = Math.max(-20, Math.min(CANVAS_SIZE - 20, dragStartRef.current.x + g.dx));
        const clampedY = Math.max(-20, Math.min(CANVAS_SIZE - 20, dragStartRef.current.y + g.dy));
        const next = { x: clampedX, y: clampedY };
        posRef.current = next;
        setRenderPos(next);
      },
      onPanResponderRelease: () => {
        onPositionChangeRef.current(posRef.current);
      },
      onPanResponderTerminate: () => {
        onPositionChangeRef.current(posRef.current);
      },
    })
  ).current;

  const size = ELEMENT_BASE_SIZE * element.scale;

  return (
    <View
      {...panResponder.panHandlers}
      style={[
        styles.wrap,
        {
          left: renderPos.x,
          top: renderPos.y,
          transform: [{ rotate: `${element.rotation}deg` }],
        },
        selected && styles.selected,
      ]}
    >
      {element.type === 'shape' && element.shape ? (
        <ShapeSvg kind={element.shape} size={size} color={element.color} />
      ) : (
        <Text
          style={[
            typography.h2,
            {
              color: element.color,
              fontSize: 22 * element.scale,
              maxWidth: CANVAS_SIZE,
            },
          ]}
          numberOfLines={1}
        >
          {element.text || 'Text'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    borderRadius: radius.sm,
  },
  selected: {
    borderWidth: 1.5,
    borderColor: colors.indigo,
    borderStyle: 'dashed',
  },
});
