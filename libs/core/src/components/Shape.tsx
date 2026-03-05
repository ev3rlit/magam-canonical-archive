import * as React from 'react';
import { useInMindMap } from '../context/MindMapContext';
import { MagamError } from '../errors';
import { useNodeId } from '../hooks/useNodeId';
import type { ObjectSizeInput } from '../lib/size';
import type { FontFamilyPreset } from '../types/font';
import type { FromProp } from './Node';

export type AnchorPosition =
  | 'top' | 'bottom' | 'left' | 'right'
  | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface ShapeProps {
  id?: string;
  type?: 'rectangle' | 'circle' | 'triangle' | string;
  // Position: either x/y or anchor/position
  x?: number;
  y?: number;
  // Anchor-based positioning (alternative to x/y)
  anchor?: string;           // Reference node ID
  position?: AnchorPosition; // Position relative to anchor
  gap?: number;              // Gap from anchor (default: 40)
  align?: 'start' | 'center' | 'end'; // Alignment (default: center)
  size?: ObjectSizeInput;
  // Size
  // Legacy experimental API (unsupported in standardized size contract)
  width?: number;
  // Legacy experimental API (unsupported in standardized size contract)
  height?: number;
  // Shape styles
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  // Text styles
  label?: string;
  labelColor?: string;
  labelFontSize?: number;
  labelBold?: boolean;
  fontFamily?: FontFamilyPreset;
  from?: FromProp;
  className?: string;
  children?: React.ReactNode;
  [key: string]: any;
}

export const Shape: React.FC<ShapeProps> = (props) => {
  const scopedId = useNodeId(props.id);
  const inMindMap = useInMindMap();

  if (!scopedId) {
    throw new MagamError("Missing required prop 'id'", 'props');
  }

  // Allow either x/y or anchor/position
  const hasCoordinates = props.x !== undefined && props.y !== undefined;
  const hasAnchor = props.anchor !== undefined;
  const hasFrom = props.from !== undefined;

  if (!inMindMap && !hasFrom && !hasCoordinates && !hasAnchor) {
    throw new MagamError("Shape requires either 'x' and 'y' coordinates or 'anchor' positioning", 'props');
  }

  return React.createElement('graph-shape', { ...props, id: scopedId }, props.children);
};
