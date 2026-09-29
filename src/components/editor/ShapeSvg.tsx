import React from 'react';
import Svg, { Circle, Rect, Polygon, Path } from 'react-native-svg';
import type { ShapeKind } from './types';

interface ShapeSvgProps {
  kind: ShapeKind;
  size: number;
  color: string;
}

function starPoints(size: number): string {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 2;
  const innerR = outerR * 0.42;
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return points.join(' ');
}

export function ShapeSvg({ kind, size, color }: ShapeSvgProps) {
  switch (kind) {
    case 'circle':
      return (
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={size / 2 - 2} fill={color} />
        </Svg>
      );
    case 'square':
      return (
        <Svg width={size} height={size}>
          <Rect x={2} y={2} width={size - 4} height={size - 4} rx={size * 0.14} fill={color} />
        </Svg>
      );
    case 'triangle':
      return (
        <Svg width={size} height={size}>
          <Polygon
            points={`${size / 2},3 ${size - 3},${size - 3} 3,${size - 3}`}
            fill={color}
          />
        </Svg>
      );
    case 'star':
      return (
        <Svg width={size} height={size}>
          <Polygon points={starPoints(size)} fill={color} />
        </Svg>
      );
    case 'heart':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            d="M12,21.35l-1.45-1.32C5.4,15.36,2,12.28,2,8.5 C2,5.42,4.42,3,7.5,3c1.74,0,3.41,0.81,4.5,2.09 C13.09,3.81,14.76,3,16.5,3 C19.58,3,22,5.42,22,8.5 c0,3.78-3.4,6.86-8.55,11.54L12,21.35z"
            fill={color}
          />
        </Svg>
      );
    default:
      return null;
  }
}
