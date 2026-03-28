import React, { memo, useCallback, useMemo } from 'react';
import { NodeProps, Handle, Position, useNodeId } from 'reactflow';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  BaseNode,
  NoiseOverlay,
  NODE_EDIT_BUTTON_CLASS,
  NODE_INLINE_LABEL_CLASS,
  resolvePaperSurface,
  resolveStickyLikeShapeStyle,
} from './BaseNode';
import { getInputClassName } from '@/components/ui/Input';
import { useGraphStore } from '@/store/graph';
import { toAssetApiUrl } from '@/utils/imageSource';
import type { RenderableChild } from '@/utils/childComposition';
import {
  renderNodeContent,
  resolveBodyEditSession,
  useExplicitBodyEntryAffordance,
} from './renderableContent';
import type {
  FontFamilyPreset,
  ObjectSizeInput,
  PaperMaterial,
  PaperTextureParams,
} from '@magam/core';
import {
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
  type: 'rectangle' | 'circle' | 'ellipse' | 'triangle' | 'diamond' | 'line' | 'heart' | 'cloud' | 'speech';
  label?: string;
  /** Enable bubble overlay when zoomed out */
  bubble?: boolean;
  // Shape styling
  color?: string;
  size?: ObjectSizeInput;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  lineDirection?: 'up' | 'down';
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
  const nodeId = useNodeId();
  const { isZoomBold } = useZoom();
  const assetBasePath = useGraphStore((state) => state.assetBasePath);
  const globalFontFamily = useGraphStore((state) => state.globalFontFamily);
  const canvasFontFamily = useGraphStore((state) => state.canvasFontFamily);
  const activeTextEditNodeId = useGraphStore((state) => state.activeTextEditNodeId);
  const textEditDraft = useGraphStore((state) => state.textEditDraft);
  const startTextEditSession = useGraphStore((state) => state.startTextEditSession);
  const updateTextEditDraft = useGraphStore((state) => state.updateTextEditDraft);
  const requestTextEditCommit = useGraphStore((state) => state.requestTextEditCommit);
  const requestTextEditCancel = useGraphStore((state) => state.requestTextEditCancel);
  const explicitBodyEntryEnabled = useExplicitBodyEntryAffordance();
  const resolvedFontFamily = resolveFontFamilyCssValue({
    nodeFontFamily: data.fontFamily,
    canvasFontFamily,
    globalFontFamily,
  });
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
      'rounded-full': data.type === 'circle' || data.type === 'ellipse',
      'clip-triangle': data.type === 'triangle',
    },
  );
  const shapeStyle: React.CSSProperties | undefined = data.type === 'diamond'
    ? {
        clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
      }
    : undefined;

  const containerClasses = twMerge(
    clsx(
      resolvedObjectSize
        ? 'w-auto h-auto flex items-center justify-center p-4'
        : 'w-auto h-auto flex items-center justify-center px-3 py-2',
      'rounded-lg text-foreground shadow-raised shadow-[inset_0_0_0_1px_rgb(var(--color-border)/0.14)] transition-all duration-base',
      !selected && 'hover:-translate-y-1 hover:shadow-floating',
      {
        'scale-105 shadow-[0_0_0_1px_rgb(var(--color-primary)/0.24),0_0_0_12px_rgb(var(--color-primary)/0.08),0_18px_56px_-28px_rgb(var(--shadow-color)/0.42)]': selected,
      },
      shapeClasses,
    ),
  );

  const labelStyle = {
    color: data.labelColor ?? materialSurface.textColor,
    fontSize: data.labelFontSize,
    fontWeight: (isZoomBold || data.labelBold) ? 'bold' : 'normal',
    fontFamily: resolvedFontFamily,
  };
  const isActiveEditor = Boolean(nodeId && selected && activeTextEditNodeId === nodeId);
  const bodyEditSession = nodeId ? resolveBodyEditSession({
    id: nodeId,
    type: 'shape',
    data,
  }) : null;
  const shouldRenderExplicitBodyEntry = (
    selected
    && !isActiveEditor
    && explicitBodyEntryEnabled
    && Boolean(bodyEditSession)
  );

  const beginEditing = useCallback(() => {
    if (!selected || !bodyEditSession) return;
    startTextEditSession(bodyEditSession);
  }, [bodyEditSession, selected, startTextEditSession]);

  const commitEditing = useCallback(() => {
    if (!nodeId) return;
    requestTextEditCommit(nodeId);
  }, [nodeId, requestTextEditCommit]);

  const cancelEditing = useCallback(() => {
    if (!nodeId) return;
    requestTextEditCancel(nodeId);
  }, [nodeId, requestTextEditCancel]);

  const editButton = shouldRenderExplicitBodyEntry ? (
    <button
      type="button"
      aria-label="Edit content"
      className={NODE_EDIT_BUTTON_CLASS}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        beginEditing();
      }}
    >
      Edit
    </button>
  ) : null;

  const bodyEditor = isActiveEditor ? (
    <textarea
      autoFocus
      value={textEditDraft}
      onChange={(event) => updateTextEditDraft(event.currentTarget.value)}
      onBlur={commitEditing}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          cancelEditing();
          return;
        }
        const isCommitShortcut = (event.metaKey || event.ctrlKey) && event.key === 'Enter';
        if (isCommitShortcut) {
          event.preventDefault();
          commitEditing();
        }
      }}
      placeholder="Write markdown..."
      className={getInputClassName({
        className: 'pointer-events-auto relative z-10 w-full min-h-[72px]',
        multiline: true,
      })}
    />
  ) : null;

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
          className="w-3 h-3 border-2 border-card bg-foreground/35"
          style={{ ...posStyle, ...port.style }}
        />
      );
    });
  };

  const imageUrl = data.imageSrc ? toAssetApiUrl(assetBasePath, data.imageSrc) : '';
  const hasImage = !!imageUrl && data.type !== 'triangle';
  const hasLineShape = data.type === 'line';
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

  if (hasLineShape) {
    const width = resolvedObjectSize?.widthPx ?? 180;
    const height = Math.max(resolvedObjectSize?.heightPx ?? 48, 24);
    const lineDirection = data.lineDirection === 'up' ? 'up' : 'down';

    return (
      <BaseNode
        className="flex items-center justify-center px-2 py-1"
        bubble={data.bubble}
        label={data.label}
        style={{
          width,
          height,
          minWidth: width,
          minHeight: height,
        }}
      >
        {editButton}
        <svg
          className="absolute inset-0 h-full w-full overflow-visible"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <line
            x1="6"
            y1={lineDirection === 'up' ? '92%' : '8%'}
            x2="94"
            y2={lineDirection === 'up' ? '8%' : '92%'}
            stroke={data.stroke ?? 'rgb(var(--color-foreground) / 0.68)'}
            strokeWidth={data.strokeWidth ?? 3}
            strokeLinecap="round"
          />
        </svg>
        {bodyEditor ?? (data.label ? (
          <div
            className={NODE_INLINE_LABEL_CLASS}
            style={{ fontFamily: resolvedFontFamily }}
          >
            {renderNodeContent({
              children: data.children,
              fallbackLabel: data.label,
              iconClassName: 'w-4 h-4 text-foreground/42 shrink-0',
              textClassName: 'whitespace-pre-wrap leading-tight',
              textStyle: labelStyle,
            })}
          </div>
        ) : null)}
      </BaseNode>
    );
  }

  if (data.type === 'triangle' && !isContentDrivenAuto) {
    return (
      <BaseNode
        className="flex items-center justify-center"
        bubble={data.bubble}
        label={data.label}
        style={frameStyle ?? { width: 128, height: 128, minWidth: 128, minHeight: 128 }}
      >
        {editButton}
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
              fill={data.fill ?? 'rgb(var(--color-card))'}
              stroke={data.stroke ?? 'rgb(var(--color-border) / 0.32)'}
              strokeWidth={data.strokeWidth ?? 2}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center pt-8 px-4">
            <div className={isActiveEditor ? 'w-full max-w-[280px]' : 'pointer-events-none flex items-center gap-2 px-4 select-none'}>
              {bodyEditor ?? renderNodeContent({
                children: data.children,
                fallbackLabel: data.label,
                iconClassName: 'w-4 h-4 text-foreground/42 shrink-0',
                textClassName:
                  'text-sm font-medium leading-tight text-center text-foreground/78 whitespace-pre-wrap',
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
      style={{
        ...(frameStyle ?? {}),
        ...(shapeStyle ?? {}),
      }}
    >
      {editButton}
      <div
        className={clsx(
          'relative w-full flex justify-center text-left break-words',
          isActiveEditor ? 'pointer-events-auto' : 'pointer-events-none select-none',
          isContentDrivenAuto ? 'items-center px-2 py-1.5' : 'items-start p-4',
        )}
        style={{
          ...baseContainerStyle,
          ...(stickyLikeShapeStyle ?? {}),
        }}
      >
        <NoiseOverlay opacity={materialSurface.noiseOpacity} />
        <div className={isActiveEditor ? 'w-full' : 'flex items-center gap-2'}>
          {bodyEditor ?? renderNodeContent({
            children: data.children,
            fallbackLabel: data.label,
            iconClassName: 'w-4 h-4 text-foreground/42 shrink-0',
            textClassName:
              isContentDrivenAuto
                ? 'text-sm font-medium leading-normal text-foreground/78 whitespace-pre-wrap'
                : 'text-sm font-medium leading-relaxed text-foreground/78 whitespace-pre-wrap',
            textStyle: labelStyle,
          })}
        </div>
      </div>
      {renderPorts()}
    </BaseNode>
  );
};

export default memo(ShapeNode);
