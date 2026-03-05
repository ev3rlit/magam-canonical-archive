import * as React from 'react';
import { MagamError } from '../errors';
import { useNodeId } from '../hooks/useNodeId';
import type { FontSizeInput } from '../lib/size';
import type { FontFamilyPreset } from '../types/font';

export interface TextProps {
  id?: string;
  text?: string;
  // Position: either x/y or anchor/position
  x?: number;
  y?: number;
  // Anchor-based positioning (alternative to x/y)
  anchor?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  gap?: number;
  align?: 'start' | 'center' | 'end';

  content?: string;

  // Style props
  fontSize?: FontSizeInput;
  color?: string;
  fontFamily?: FontFamilyPreset;
  className?: string;
  children?: React.ReactNode;
  bold?: boolean;
  italic?: boolean;

  [key: string]: any;
}

export const Text: React.FC<TextProps> = (props) => {
  const scopedId = useNodeId(props.id);

  return React.createElement('graph-text', { ...props, id: scopedId }, props.children);
};
