import React, { memo, useMemo } from 'react';
import { NodeProps, Handle, Position } from 'reactflow';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  BaseNode,
  NoiseOverlay,
  resolvePaperSurface,
  resolveStickyLikeShapeStyle,
} from './BaseNode';
import { useGraphStore } from '@/store/graph';
import { toAssetApiUrl } from '@/utils/imageSource';
import type { RenderableChild } from '@/utils/childComposition';
import { renderNodeContent } from './renderableContent';
import type {
  FontFamilyPreset,
  ObjectSizeInput,
  PaperMaterial,
  PaperTextureParams,
} from '@magam/core';
import {
  hasExplicitFontFamilyClass,
  resolveFontFamilyCssValue,
} from '@/utils/fontHierarchy';
import { useZoom } from '@/contexts/ZoomContext';
import {
  normalizeObjectSizeInput,
  resolveObject2D,
  resolveShapeDefaultRatio,
} from '@/utils/sizeResolver';
import { emitSizeWarning } from '@/utils/sizeWarnings';
import { DEFAULT_STICKY_PRESET_ID } from '@/utils/washiTapeDefaults';

interface PortData {
  id: string;
  position?: string;
  className?: string;
  style?: React.CSSProperties;
}

interface ShapeNodeData {
  type: 'rectangle' | 'circle' | 'triangle' | 'heart' | 'cloud' | 'speech';
  label?: string;
  /** Enable bubble overlay when zoomed out */
  bubble?: boolean;
  // Shape styling
  color?: string;
  size?: ObjectSizeInput;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  pattern?: PaperMaterial;
  texture?: PaperTextureParams | Record<string, unknown>;
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
  const { isZoomBold } = useZoom();
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
  const resolvedObjectSize = useMemo(() => {
    const defaultRatio = resolveShapeDefaultRatio(data.type);
    const normalized = normalizeObjectSizeInput(data.size, {
      component: 'ShapeNode',
      inputPath: 'size',
      defaultRatio,
    });
    if (normalized.mode === 'auto') {
      return null;
    }
    let normalizedRatio = normalized.ratio;
    if (
      (data.type === 'circle' || data.type === 'triangle')
      && normalized.mode === 'token'
      && normalizedRatio !== 'square'
    ) {
      emitSizeWarning({
        code: 'UNSUPPORTED_RATIO',
        component: 'ShapeNode',
        inputPath: 'size.ratio',
        fallbackApplied: 'ratio=square',
      });
      normalizedRatio = 'square';
    }
    const resolved = resolveObject2D(
      {
        ...normalized,
        ratio: normalizedRatio,
      },
      {
        component: 'ShapeNode',
        inputPath: 'size',
      },
    );
    return resolved.mode === 'fixed' ? resolved : null;
  }, [data.size, data.type]);
  const frameStyle = resolvedObjectSize
    ? {
      width: resolvedObjectSize.widthPx,
      height: resolvedObjectSize.heightPx,
      minWidth: resolvedObjectSize.widthPx,
      minHeight: resolvedObjectSize.heightPx,
    }
    : undefined;
  const isContentDrivenAuto = resolvedObjectSize === null;
  const materialSurface = useMemo(
    () => resolvePaperSurface({
      pattern: data.pattern,
      texture: data.texture,
      selected: !!selected,
      fallbackPresetId: DEFAULT_STICKY_PRESET_ID,
      applyFallbackSurface: false,
    }),
    [data.pattern, data.texture, selected],
  );
  const shapeClasses = clsx(
    'relative flex items-center justify-center overflow-hidden transition-all duration-200',
    {
      'rounded-md': data.type === 'rectangle',
      'rounded-full': data.type === 'circle',
      'clip-triangle': data.type === 'triangle',
    },
  );

  const containerClasses = twMerge(
    clsx(
      resolvedObjectSize
        ? 'w-auto h-auto flex items-center justify-center p-4'
        : 'w-auto h-auto flex items-center justify-center px-3 py-2',
      'border-2 border-node-border text-node-text transition-all duration-300',
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
    color: data.labelColor ?? materialSurface.textColor,
    fontSize: data.labelFontSize,
    fontWeight: (isZoomBold || data.labelBold) ? 'bold' : 'normal',
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
  const baseContainerStyle: React.CSSProperties = {
    ...materialSurface.surfaceStyle,
    ...(data.fill ? { backgroundColor: data.fill } : {}),
    ...(data.stroke ? { borderColor: data.stroke } : {}),
    ...(typeof data.strokeWidth === 'number' ? { borderWidth: data.strokeWidth } : {}),
    ...(imageStyle ?? {}),
  };
  const stickyLikeShapeStyle = (
    data.type === 'heart' || data.type === 'cloud' || data.type === 'speech'
  )
    ? resolveStickyLikeShapeStyle(data.type)
    : undefined;

  if (data.type === 'triangle' && !isContentDrivenAuto) {
    return (
      <BaseNode
        className="flex items-center justify-center"
        bubble={data.bubble}
        label={data.label}
        style={frameStyle ?? { width: 128, height: 128, minWidth: 128, minHeight: 128 }}
      >
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
              fill={data.fill ?? '#ffffff'}
              stroke={data.stroke ?? '#e2e8f0'}
              strokeWidth={data.strokeWidth ?? 2}
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
      style={frameStyle}
    >
      <div
        className={clsx(
          'relative w-full flex justify-center text-left break-words pointer-events-none select-none',
          isContentDrivenAuto ? 'items-center px-2 py-1.5' : 'items-start p-4',
        )}
        style={{
          ...baseContainerStyle,
          ...(stickyLikeShapeStyle ?? {}),
        }}
      >
        <NoiseOverlay opacity={materialSurface.noiseOpacity} />
        <div className="flex items-center gap-2">
          {renderNodeContent({
            children: data.children,
            fallbackLabel: data.label,
            iconClassName: 'w-4 h-4 text-slate-500 shrink-0',
            textClassName:
              isContentDrivenAuto
                ? 'text-sm font-medium leading-normal text-slate-700 whitespace-pre-wrap'
                : 'text-sm font-medium leading-relaxed text-slate-700 whitespace-pre-wrap',
            textStyle: labelStyle,
          })}
        </div>
      </div>
      {renderPorts()}
    </BaseNode>
  );
};

export default memo(ShapeNode);
