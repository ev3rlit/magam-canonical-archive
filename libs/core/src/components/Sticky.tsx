import * as React from 'react';
import { useInMindMap } from '../context/MindMapContext';
import { MagamError } from '../errors';
import { useNodeId } from '../hooks/useNodeId';
import type { ObjectSizeInput } from '../lib/size';
import type { PaperMaterial } from '../material/types';
import type { FontFamilyPreset } from '../types/font';
import type { AtDef } from './WashiTape.helpers';
import type { FromProp } from './Node';

export interface StickyProps {
  id?: string;
  text?: string;
  x?: number;
  y?: number;
  size?: ObjectSizeInput;
  // Legacy experimental API (unsupported in standardized size contract)
  width?: number;
  // Legacy experimental API (unsupported in standardized size contract)
  height?: number;
  color?: string;
  fontFamily?: FontFamilyPreset;
  from?: FromProp;
  pattern?: PaperMaterial;
  at?: AtDef | Record<string, unknown>;
  className?: string; // Tailwind support
  children?: React.ReactNode; // Content and Nested Edges support
  [key: string]: any;
}

export const Sticky: React.FC<StickyProps> = (props) => {
  const scopedId = useNodeId(props.id);
  const inMindMap = useInMindMap();

  if (!scopedId) {
    throw new MagamError("Missing required prop 'id'", 'props');
  }
  const hasAt = props.at && typeof props.at === 'object';
  const hasCoordinates = props.x !== undefined && props.y !== undefined;
  const hasFrom = props.from !== undefined;
  if (!inMindMap && !hasFrom && !hasAt && !hasCoordinates) {
    throw new MagamError(
      "Sticky requires either 'at' placement input or 'x' and 'y' coordinates",
      'props',
    );
  }

  return React.createElement('graph-sticky', { ...props, id: scopedId }, props.children);
};
