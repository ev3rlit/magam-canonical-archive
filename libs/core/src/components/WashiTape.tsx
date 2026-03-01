import * as React from 'react';
import { MagamError } from '../errors';
import { useNodeId } from '../hooks/useNodeId';

export interface WashiTapeProps {
  id?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  at?: Record<string, unknown>;
  preset?: string;
  pattern?: Record<string, unknown>;
  edge?: Record<string, unknown>;
  texture?: Record<string, unknown>;
  text?: Record<string, unknown>;
  seed?: string | number;
  opacity?: number;
  className?: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}

function resolveFallbackAt(props: WashiTapeProps): Record<string, unknown> {
  const x = typeof props.x === 'number' ? props.x : 0;
  const y = typeof props.y === 'number' ? props.y : 0;
  const length = typeof props.width === 'number' ? Math.max(24, props.width) : 180;
  const thickness = typeof props.height === 'number' ? Math.max(8, props.height) : 36;
  return {
    type: 'polar',
    x,
    y,
    length,
    thickness,
  };
}

export const WashiTape: React.FC<WashiTapeProps> = (props) => {
  const scopedId = useNodeId(props.id);

  if (!scopedId) {
    throw new MagamError("Missing required prop 'id'", 'props');
  }

  const hasAt = props.at && typeof props.at === 'object';
  const hasCoordinates = props.x !== undefined && props.y !== undefined;
  if (!hasAt && !hasCoordinates) {
    throw new MagamError(
      "WashiTape requires either 'at' placement input or 'x' and 'y' coordinates",
      'props',
    );
  }

  const at = hasAt ? props.at : resolveFallbackAt(props);

  return React.createElement(
    'graph-washi-tape',
    { ...props, id: scopedId, at },
    props.children,
  );
};
