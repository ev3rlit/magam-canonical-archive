import * as React from 'react';
import { MagamError } from '../errors';
import { useNodeId } from '../hooks/useNodeId';
import type { PaperMaterial } from '../material/types';
import type { FontFamilyPreset } from '../types/font';
import type { AtDef } from './WashiTape.helpers';

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
  at?: AtDef | Record<string, unknown>;
  className?: string; // Tailwind support
  children?: React.ReactNode; // Content and Nested Edges support
  [key: string]: any;
}

export const Sticky: React.FC<StickyProps> = (props) => {
  const scopedId = useNodeId(props.id);

  if (!scopedId) {
    throw new MagamError("Missing required prop 'id'", 'props');
  }
  const hasAt = props.at && typeof props.at === 'object';
  const hasCoordinates = props.x !== undefined && props.y !== undefined;
  if (!hasAt && !hasCoordinates) {
    throw new MagamError(
      "Sticky requires either 'at' placement input or 'x' and 'y' coordinates",
      'props',
    );
  }

  return React.createElement('graph-sticky', { ...props, id: scopedId }, props.children);
};
