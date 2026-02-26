import React, { memo } from 'react';
import { NodeProps, Handle, Position } from 'reactflow';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { BaseNode } from './BaseNode';
import { useGraphStore } from '@/store/graph';
import { toAssetApiUrl } from '@/utils/imageSource';
import type { RenderableChild } from '@/utils/childComposition';
import { renderNodeContent } from './renderableContent';
import type { FontFamilyPreset } from '@magam/core';
import {
  hasExplicitFontFamilyClass,
  resolveFontFamilyCssValue,
} from '@/utils/fontHierarchy';

interface PortData {
  id: string;
  position?: string;
  className?: string;
  style?: React.CSSProperties;
}

interface ShapeNodeData {
  type: 'rectangle' | 'circle' | 'triangle';
  label?: string;
  /** Enable bubble overlay when zoomed out */
  bubble?: boolean;
  // Shape styling
  color?: string;
  // Rich text styling
  labelColor?: string;
  labelFontSize?: number;
  labelBold?: boolean;
  fontFamily?: FontFamilyPreset;
  className?: string;
  ports?: PortData[];
  imageSrc?: string;
  imageFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  children?: RenderableChild[];
}

// Helper to determine Handle position and style based on string position
const getHandleConfig = (pos: string = 'top') => {
  let position = Position.Top;
  let style: React.CSSProperties = {};

  switch (pos) {
    case 'top': position = Position.Top; break;
    case 'right': position = Position.Right; break;
    case 'bottom': position = Position.Bottom; break;
    case 'left': position = Position.Left; break;
    // Composite positions to absolute styling overrides
    case 'top-left':
      position = Position.Top;
      style = { left: '25%' };
      break;
    case 'top-right':
      position = Position.Top;
      style = { left: '75%' };
      break;
    case 'bottom-left':
      position = Position.Bottom;
      style = { left: '25%' };
      break;
    case 'bottom-right':
      position = Position.Bottom;
      style = { left: '75%' };
      break;
    case 'left-top':
      position = Position.Left;
      style = { top: '25%' };
      break;
    case 'left-bottom':
      position = Position.Left;
      style = { top: '75%' };
      break;
    case 'right-top':
      position = Position.Right;
      style = { top: '25%' };
      break;
    case 'right-bottom':
      position = Position.Right;
      style = { top: '75%' };
      break;
    default: position = Position.Top;
  }
  return { position, style };
};

const ShapeNode = ({ data, selected }: NodeProps<ShapeNodeData>) => {
  const currentFile = useGraphStore((state) => state.currentFile);
  const globalFontFamily = useGraphStore((state) => state.globalFontFamily);
  const canvasFontFamily = useGraphStore((state) => state.canvasFontFamily);
  const shouldApplyHierarchy = !hasExplicitFontFamilyClass(data.className);
  const resolvedFontFamily = shouldApplyHierarchy
    ? resolveFontFamilyCssValue({
      nodeFontFamily: data.fontFamily,
      canvasFontFamily,
      globalFontFamily,
    })
    : undefined;
  const shapeClasses = clsx(
    'flex items-center justify-center transition-all duration-200',
    {
      'rounded-md': data.type === 'rectangle',
      'rounded-full': data.type === 'circle',
      'clip-triangle': data.type === 'triangle',
    },
  );

  const containerClasses = twMerge(
    clsx(
      'min-w-36 min-h-20 w-auto h-auto flex items-center justify-center p-4',
      'bg-white border-2 border-node-border text-node-text transition-all duration-300',
      'shadow-node rounded-lg',
      // Only apply hover effects if NOT selected
      !selected && 'hover:shadow-node-hover hover:-translate-y-1 hover:border-brand-100',
      {
        'border-brand-500 shadow-node-selected scale-105': selected,
      },
      data.color, // Assuming this is a class string for background
      shapeClasses,
      data.className, // Apply custom className (can override defaults)
    ),
  );

  const labelStyle = {
    color: data.labelColor,
    fontSize: data.labelFontSize,
    fontWeight: data.labelBold ? 'bold' : 'normal',
    fontFamily: resolvedFontFamily,
  };

  // Render ports
  const renderPorts = () => {
    if (!data.ports || data.ports.length === 0) return null;

    return data.ports.map((port) => {
      const { position, style: posStyle } = getHandleConfig(port.position);

      return (
        <Handle
          key={port.id}
          id={port.id}
          type="source" // In ReactFlow, handles are often source/target agnostic if connectionMode is loose, but let's default to source
          position={position}
          className={clsx('w-3 h-3 bg-slate-400 border-2 border-white', port.className)}
          style={{ ...posStyle, ...port.style }}
        />
      );
    });
  };

  const imageUrl = data.imageSrc ? toAssetApiUrl(currentFile, data.imageSrc) : '';
  const hasImage = !!imageUrl && data.type !== 'triangle';
  const imageStyle = hasImage ? {
    backgroundImage: `url(${imageUrl})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    backgroundSize: data.imageFit || 'cover',
  } : undefined;

  if (data.type === 'triangle') {
    return (
      <BaseNode className="w-32 h-32 flex items-center justify-center" bubble={data.bubble} label={data.label}>
        <div
          className={twMerge(
            clsx(
              'w-full h-full transition-all duration-300 filter drop-shadow-md',
              {
                'drop-shadow-xl scale-105': selected,
                'hover:drop-shadow-lg hover:scale-105': !selected,
              },
            ),
          )}
        >
          <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
            <polygon
              points="50,0 100,100 0,100"
              className={twMerge(
                clsx(
                  'fill-white stroke-slate-200 stroke-2',
                  data.color?.replace('bg-', 'fill-'),
                ),
              )}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center pt-8 pointer-events-none select-none">
            <div className="flex items-center gap-2 px-4">
              {renderNodeContent({
                children: data.children,
                fallbackLabel: data.label,
                iconClassName: 'w-4 h-4 text-slate-500 shrink-0',
                textClassName:
                  'text-sm font-medium leading-tight text-center text-slate-700 whitespace-pre-wrap',
                textStyle: labelStyle,
              })}
            </div>
          </div>
          {renderPorts()}
        </div>
      </BaseNode>
    );
  }

  return (
    <BaseNode
      className={containerClasses}
      bubble={data.bubble}
      label={data.label}
      style={imageStyle}
    >
      <div className="w-full flex items-start justify-center text-left break-words p-4 pointer-events-none select-none">
        <div className="flex items-center gap-2">
          {renderNodeContent({
            children: data.children,
            fallbackLabel: data.label,
            iconClassName: 'w-4 h-4 text-slate-500 shrink-0',
            textClassName:
              'text-sm font-medium leading-relaxed text-slate-700 whitespace-pre-wrap',
            textStyle: labelStyle,
          })}
        </div>
      </div>
      {renderPorts()}
    </BaseNode>
  );
};

export default memo(ShapeNode);
