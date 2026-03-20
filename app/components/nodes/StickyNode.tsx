import React, { memo, useCallback, useMemo } from 'react';
import { NodeProps, useNodeId } from 'reactflow';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  BaseNode,
  NoiseOverlay,
  resolvePaperSurface,
  resolveStickyLikeShapeStyle,
} from './BaseNode';
import type { RenderableChild } from '@/utils/childComposition';
import {
  renderNodeContent,
  resolveBodyEditSession,
  useExplicitBodyEntryAffordance,
} from './renderableContent';
import { useGraphStore } from '@/store/graph';
import type {
  FontFamilyPreset,
  ObjectSizeInput,
  PaperMaterial,
  PaperTextureParams,
} from '@magam/core';
import {
  resolveFontFamilyCssValue,
} from '@/utils/fontHierarchy';
import {
  DEFAULT_STICKY_PRESET_ID,
  normalizeStickyDefaults,
} from '@/utils/washiTapeDefaults';
import { normalizeObjectSizeInput, resolveObject2D } from '@/utils/sizeResolver';

type StickyShape = 'rectangle' | 'heart' | 'cloud' | 'speech';

interface StickyNodeData {
  label: string;
  color?: string;
  pattern?: PaperMaterial;
  texture?: PaperTextureParams | Record<string, unknown>;
  shape?: StickyShape;
  size?: ObjectSizeInput;
  // Legacy size API (unsupported for standardized size contract)
  width?: number;
  // Legacy size API (unsupported for standardized size contract)
  height?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  fontFamily?: FontFamilyPreset;
  labelColor?: string;
  className?: string;
  children?: RenderableChild[];
}

export interface StickySizing {
  hasWidth: boolean;
  hasHeight: boolean;
  hasFixedFrame: boolean;
  width?: number;
  height?: number;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function isCssColorLike(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('#')) return true;
  if (trimmed.startsWith('rgb(') || trimmed.startsWith('rgba(')) return true;
  if (trimmed.startsWith('hsl(') || trimmed.startsWith('hsla(')) return true;
  if (trimmed.startsWith('var(')) return true;
  return /^[a-zA-Z]+$/.test(trimmed);
}

export function resolveStickySizing(width: unknown, height: unknown): StickySizing {
  const parsedWidth = toNumber(width);
  const parsedHeight = toNumber(height);
  const hasWidth = parsedWidth !== null && parsedWidth > 0;
  const hasHeight = parsedHeight !== null && parsedHeight > 0;
  return {
    hasWidth,
    hasHeight,
    hasFixedFrame: hasWidth && hasHeight,
    ...(hasWidth ? { width: parsedWidth } : {}),
    ...(hasHeight ? { height: parsedHeight } : {}),
  };
}

const StickyNode = ({ data, selected }: NodeProps<StickyNodeData>) => {
  const nodeId = useNodeId();
  const raw = (data || {}) as StickyNodeData;
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
    nodeFontFamily: raw.fontFamily,
    canvasFontFamily,
    globalFontFamily,
  });

  const normalized = useMemo(
    () => normalizeStickyDefaults(raw as unknown as Record<string, unknown>),
    [raw],
  );
  const resolvedObjectSize = useMemo(() => {
    const normalizedSize = normalizeObjectSizeInput(raw.size, {
      component: 'StickyNode',
      inputPath: 'size',
      defaultRatio: 'landscape',
    });
    const resolved = resolveObject2D(normalizedSize, {
      component: 'StickyNode',
      inputPath: 'size',
    });
    return resolved.mode === 'fixed' ? resolved : null;
  }, [raw.size]);
  const sizing = useMemo(
    () => {
      if (!resolvedObjectSize) {
        return resolveStickySizing(undefined, undefined);
      }
      return resolveStickySizing(resolvedObjectSize.widthPx, resolvedObjectSize.heightPx);
    },
    [resolvedObjectSize],
  );
  const isContentDrivenAuto = !sizing.hasWidth && !sizing.hasHeight;
  const isActiveEditor = Boolean(nodeId && selected && activeTextEditNodeId === nodeId);
  const bodyEditSession = nodeId ? resolveBodyEditSession({
    id: nodeId,
    type: 'sticky',
    data: raw,
  }) : null;
  const shouldRenderExplicitBodyEntry = (
    selected
    && !isActiveEditor
    && explicitBodyEntryEnabled
    && Boolean(bodyEditSession)
  );

  const paperSurface = useMemo(
    () => resolvePaperSurface({
      pattern: normalized.pattern,
      texture: raw.texture,
      selected: !!selected,
      fallbackPresetId: DEFAULT_STICKY_PRESET_ID,
      applyFallbackSurface: true,
    }),
    [normalized.pattern, raw.texture, selected],
  );

  const textColor = (() => {
    if (typeof raw.labelColor === 'string' && raw.labelColor.trim() !== '') return raw.labelColor;
    if (typeof paperSurface.textColor === 'string' && paperSurface.textColor.trim() !== '') {
      return paperSurface.textColor;
    }
    return '#1f2937';
  })();

  const stickyStyle: React.CSSProperties = {
    position: 'relative',
    width: sizing.hasWidth ? sizing.width : 'fit-content',
    minWidth: sizing.hasWidth ? sizing.width : 160,
    maxWidth: sizing.hasWidth ? sizing.width : 360,
    height: sizing.hasHeight ? sizing.height : undefined,
    minHeight: sizing.hasHeight ? sizing.height : isContentDrivenAuto ? undefined : 96,
    padding: isContentDrivenAuto ? '10px 14px' : 16,
    overflow: sizing.hasFixedFrame ? 'hidden' : 'visible',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.24s ease',
    ...(raw.stroke ? { border: `${raw.strokeWidth ?? 1}px solid ${raw.stroke}` } : {}),
    ...resolveStickyLikeShapeStyle(normalized.shape),
    ...paperSurface.surfaceStyle,
    backgroundColor: raw.fill
      ?? (typeof raw.color === 'string' && isCssColorLike(raw.color) ? raw.color : undefined)
      ?? paperSurface.surfaceStyle.backgroundColor
      ?? '#fce588',
  };
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

  return (
    <BaseNode
      className={twMerge(
        clsx(
          'flex flex-col justify-center items-center',
          !selected && 'hover:-translate-y-0.5',
        ),
      )}
      style={stickyStyle}
    >
      <NoiseOverlay opacity={paperSurface.noiseOpacity} />
      {shouldRenderExplicitBodyEntry ? (
        <button
          type="button"
          aria-label="Edit content"
          className="pointer-events-auto absolute right-3 top-3 z-10 rounded-full border border-slate-700/10 bg-white/85 px-2 py-1 text-[11px] font-medium text-slate-700 shadow-sm backdrop-blur"
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
      ) : null}
      {isActiveEditor ? (
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
          className="pointer-events-auto w-[220px] min-h-[120px] rounded border border-slate-300 bg-white/95 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
          style={{ fontFamily: resolvedFontFamily, color: textColor }}
        />
      ) : (() => {
        const hasMarkdownChildren = Array.isArray(raw.children) &&
          raw.children.some((c) => c.type === 'graph-markdown');

        return (
          <div
            className={twMerge(
              'w-full h-full flex break-words pointer-events-none select-none',
              hasMarkdownChildren
                ? 'items-start justify-start text-left'
                : 'items-center justify-center text-center',
            )}
            style={{
              position: 'relative',
              zIndex: 1,
              overflow: sizing.hasFixedFrame ? 'hidden' : 'visible',
              lineClamp: sizing.hasFixedFrame ? 5 : undefined,
            } as React.CSSProperties}
          >
            <div className={twMerge(
              'max-w-full',
              hasMarkdownChildren ? 'w-full' : 'flex items-center gap-2',
            )}>
              {renderNodeContent({
                children: raw.children,
                fallbackLabel: raw.label,
                iconClassName: 'w-4 h-4 shrink-0',
                textClassName: isContentDrivenAuto
                  ? 'text-base leading-normal font-medium'
                  : 'text-base leading-relaxed font-medium',
                textStyle: {
                  fontFamily: resolvedFontFamily,
                  color: textColor,
                },
              })}
            </div>
          </div>
        );
      })()}
    </BaseNode>
  );
};

export default memo(StickyNode);
