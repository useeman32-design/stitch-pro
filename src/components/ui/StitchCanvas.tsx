import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { colors, radius } from '@/theme';
import type { StitchSegment } from '@/utils/stitchEngine';

interface StitchCanvasProps {
  segments: StitchSegment[];
  palette: string[];
  gridSize: number;
  progress: number; // 0..1
  onNeedlePosition?: (pos: { xPct: number; yPct: number } | null) => void;
}

/**
 * Actually draws the generated stitch path progressively on a <canvas>,
 * scaled to the container. This is a real vector reveal (each line is a
 * genuine generated stitch segment), not a photo being wiped away.
 */
export function StitchCanvas({ segments, palette, gridSize, progress, onNeedlePosition }: StitchCanvasProps) {
  const wrapRef = useRef<View>(null);
  const canvasRef = useRef<any>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    if (Platform.OS !== 'web' || !canvasRef.current || box.w <= 0 || box.h <= 0) return;
    const canvas = canvasRef.current as HTMLCanvasElement;
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    canvas.width = box.w * dpr;
    canvas.height = box.h * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, box.w, box.h);

    // soft fabric backdrop
    ctx.fillStyle = '#F4F3EF';
    ctx.fillRect(0, 0, box.w, box.h);
    ctx.strokeStyle = 'rgba(180,178,168,0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i < box.w; i += 8) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, box.h);
      ctx.stroke();
    }

    if (!segments.length || !palette.length) {
      onNeedlePosition?.(null);
      return;
    }

    const scaleX = box.w / gridSize;
    const scaleY = box.h / gridSize;
    const totalUnits = segments.length;
    const exact = Math.max(0, Math.min(totalUnits, progress * totalUnits));
    const fullCount = Math.floor(exact);
    const frac = exact - fullCount;

    ctx.lineCap = 'round';
    let tip: { x: number; y: number } | null = null;

    const drawSeg = (seg: StitchSegment, t = 1) => {
      const x1 = (seg.x1 + 0.5) * scaleX;
      const y1 = (seg.y1 + 0.5) * scaleY;
      const x2 = seg.x1 + (seg.x2 - seg.x1) * t;
      const yEnd = (seg.y2 + 0.5) * scaleY;
      const xEnd = (x2 + 0.5) * scaleX;
      ctx.strokeStyle = palette[seg.colorIndex % palette.length] ?? colors.indigo;
      ctx.lineWidth = Math.max(1.4, scaleX * 0.9);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(xEnd, yEnd);
      ctx.stroke();
      tip = { x: xEnd, y: yEnd };
    };

    for (let i = 0; i < fullCount; i++) {
      drawSeg(segments[i], 1);
    }
    if (fullCount < segments.length && frac > 0) {
      drawSeg(segments[fullCount], frac);
    } else if (fullCount > 0 && !tip) {
      const last = segments[fullCount - 1];
      tip = { x: (last.x2 + 0.5) * scaleX, y: (last.y2 + 0.5) * scaleY };
    }

    if (tip) {
      onNeedlePosition?.({ xPct: (tip.x / box.w) * 100, yPct: (tip.y / box.h) * 100 });
    } else {
      onNeedlePosition?.(null);
    }
  }, [segments, palette, gridSize, progress, box]);

  return (
    <View
      ref={wrapRef}
      style={styles.wrap}
      onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      {Platform.OS === 'web'
        ? React.createElement('canvas', {
            ref: canvasRef,
            style: { width: '100%', height: '100%', display: 'block' },
          })
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    height: '100%',
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: '#F4F3EF',
  },
});
