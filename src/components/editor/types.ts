export type ShapeKind = 'circle' | 'square' | 'triangle' | 'star' | 'heart';
export type EditorElementType = 'text' | 'shape';

export interface EditorElement {
  id: string;
  type: EditorElementType;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  color: string;
  text?: string;
  shape?: ShapeKind;
}

export const ELEMENT_BASE_SIZE = 60;
export const CANVAS_SIZE = 300;

export const elementColors = [
  '#5B4FE8',
  '#181B26',
  '#D9A441',
  '#3E7BFA',
  '#E5484D',
  '#1FAE6A',
  '#E24E96',
  '#FFFFFF',
];
