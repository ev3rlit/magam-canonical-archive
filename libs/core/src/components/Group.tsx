import * as React from 'react';
import { useNodeId } from '../hooks/useNodeId';

export interface GroupProps {
  id?: string;
  x?: number;
  y?: number;
  anchor?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  gap?: number;
  align?: 'start' | 'center' | 'end';
  width?: number;
  height?: number;
  [key: string]: any;
}

export const Group: React.FC<GroupProps> = (props) => {
  const scopedId = useNodeId(props.id);
  return React.createElement('graph-group', { ...props, id: scopedId });
};
