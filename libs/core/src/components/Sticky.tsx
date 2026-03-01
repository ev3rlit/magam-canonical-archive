import * as React from 'react';
import { MagamError } from '../errors';
import { useNodeId } from '../hooks/useNodeId';
import type { PaperMaterial } from '../material/types';
import type { FontFamilyPreset } from '../types/font';

export interface StickyProps {
  id?: string;
  text?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  color?: string;
  fontFamily?: FontFamilyPreset;
  pattern?: PaperMaterial;
  className?: string; // Tailwind support
  children?: React.ReactNode; // Content and Nested Edges support
  [key: string]: any;
}

export const Sticky: React.FC<StickyProps> = (props) => {
  const scopedId = useNodeId(props.id);

  if (!scopedId) {
    throw new MagamError("Missing required prop 'id'", 'props');
  }
  if (props.x === undefined) {
    throw new MagamError("Missing required prop 'x'", 'props');
  }
  if (props.y === undefined) {
    throw new MagamError("Missing required prop 'y'", 'props');
  }

  return React.createElement('graph-sticky', { ...props, id: scopedId }, props.children);
};
