import * as React from 'react';
import { useMindMapEmbed } from '../context/MindMapEmbedContext';
import { useInMindMap } from '../context/MindMapContext';
import { EmbedScope } from './EmbedScope';
import { Group } from './Group';
import { MindMapEmbed } from './MindMapEmbed';
import type { FromProp } from './Node';

export type FrameMountProps = {
  id: string;
  from?: FromProp;
  sourceFile?: string;
  x?: number;
  y?: number;
  anchor?: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  gap?: number;
  align?: 'start' | 'center' | 'end';
  width?: number;
  height?: number;
};

export type FrameProps<P extends object> = Omit<P, keyof FrameMountProps> & FrameMountProps;

export type FrameComponent<P extends object> = React.FC<FrameProps<P>> & {
  __magamFrame: true;
};

function scopeMindMapMountFrom(from: FromProp | undefined, parentScope: string | undefined): FromProp | undefined {
  if (!parentScope || from === undefined) {
    return from;
  }

  if (typeof from === 'string') {
    if (!from || from.includes('.')) {
      return from;
    }

    const colonIndex = from.lastIndexOf(':');
    const nodeId = colonIndex > 0 ? from.substring(0, colonIndex) : from;
    const handle = colonIndex > 0 ? from.substring(colonIndex) : '';
    return `${parentScope}.${nodeId}${handle}`;
  }

  if (!from.node || from.node.includes('.')) {
    return from;
  }

  return {
    ...from,
    node: `${parentScope}.${from.node}`,
  };
}

export function frame<P extends object>(Component: React.ComponentType<P>): FrameComponent<P> {
  const WrappedFrame: React.FC<FrameProps<P>> = (props) => {
    const inMindMap = useInMindMap();
    const parentEmbed = useMindMapEmbed();
    const {
      id,
      from,
      sourceFile,
      x,
      y,
      anchor,
      position,
      gap,
      align,
      width,
      height,
      ...rest
    } = props as FrameProps<P> & Record<string, unknown>;

    const content = React.createElement(Component, rest as P);

    if (inMindMap) {
      return (
        <MindMapEmbed
          id={id}
          from={scopeMindMapMountFrom(from, parentEmbed?.scope)}
          sourceFile={sourceFile ?? parentEmbed?.sourceFile}
        >
          {content}
        </MindMapEmbed>
      );
    }

    const hasCanvasMountProps = (
      x !== undefined
      || y !== undefined
      || anchor !== undefined
      || position !== undefined
      || gap !== undefined
      || align !== undefined
      || width !== undefined
      || height !== undefined
    );

    if (hasCanvasMountProps) {
      return (
        <Group id={id} x={x} y={y} anchor={anchor} position={position} gap={gap} align={align} width={width} height={height}>
          <EmbedScope id={id}>{content}</EmbedScope>
        </Group>
      );
    }

    return <EmbedScope id={id}>{content}</EmbedScope>;
  };

  WrappedFrame.displayName = `frame(${Component.displayName || Component.name || 'Anonymous'})`;

  return Object.assign(WrappedFrame, {
    __magamFrame: true as const,
  });
}
