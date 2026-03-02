import React, { memo, useMemo } from 'react';
import { NodeProps } from 'reactflow';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { BaseNode } from './BaseNode';
import type { RenderableChild } from '@/utils/childComposition';
import { renderNodeContent } from './renderableContent';
import { useGraphStore } from '@/store/graph';
import type { FontFamilyPreset, PaperMaterial } from '@magam/core';
import {
  hasExplicitFontFamilyClass,
  resolveFontFamilyCssValue,
} from '@/utils/fontHierarchy';
import { normalizeStickyDefaults } from '@/utils/washiTapeDefaults';
import { resolveStickyPattern } from '@/utils/washiTapePattern';

type StickyShape = 'rectangle' | 'heart' | 'cloud' | 'speech';

interface StickyNodeData {
  label: string;
  color?: string;
  pattern?: PaperMaterial;
  shape?: StickyShape;
  width?: number;
  height?: number;
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

function resolveStickyShapeStyle(shape: StickyShape): React.CSSProperties {
  if (shape === 'heart') {
    return {
      clipPath:
        'polygon(50% 96%, 86% 64%, 96% 38%, 88% 18%, 68% 10%, 50% 26%, 32% 10%, 12% 18%, 4% 38%, 14% 64%)',
      borderRadius: 0,
    };
  }
  if (shape === 'cloud') {
    return {
      clipPath:
        'polygon(8% 54%, 15% 39%, 30% 33%, 40% 19%, 57% 16%, 69% 26%, 84% 29%, 92% 43%, 90% 59%, 81% 72%, 66% 76%, 56% 86%, 39% 87%, 28% 80%, 16% 76%)',
      borderRadius: 0,
    };
  }
  if (shape === 'speech') {
    return {
      clipPath:
        'polygon(4% 8%, 96% 8%, 96% 76%, 62% 76%, 49% 94%, 46% 76%, 4% 76%)',
      borderRadius: 0,
    };
  }
  return {
    borderRadius: 14,
  };
}

const StickyNode = ({ data, selected }: NodeProps<StickyNodeData>) => {
  const raw = (data || {}) as StickyNodeData;
  const globalFontFamily = useGraphStore((state) => state.globalFontFamily);
  const canvasFontFamily = useGraphStore((state) => state.canvasFontFamily);

  const shouldApplyHierarchy = !hasExplicitFontFamilyClass(raw.className);
  const resolvedFontFamily = shouldApplyHierarchy
    ? resolveFontFamilyCssValue({
      nodeFontFamily: raw.fontFamily,
      canvasFontFamily,
      globalFontFamily,
    })
    : undefined;

  const normalized = useMemo(
    () => normalizeStickyDefaults(raw as unknown as Record<string, unknown>),
    [raw],
  );
  const resolvedPattern = useMemo(
    () => resolveStickyPattern(normalized.pattern),
    [normalized.pattern],
  );
  const sizing = useMemo(
    () => resolveStickySizing(raw.width ?? normalized.width, raw.height ?? normalized.height),
    [normalized.height, normalized.width, raw.height, raw.width],
  );

  const legacyColorClassName = (
    typeof raw.color === 'string'
    && raw.color.trim() !== ''
    && !isCssColorLike(raw.color)
  ) ? raw.color : undefined;

  const textColor = (() => {
    if (typeof raw.labelColor === 'string' && raw.labelColor.trim() !== '') return raw.labelColor;
    if (typeof resolvedPattern.textColor === 'string' && resolvedPattern.textColor.trim() !== '') {
      return resolvedPattern.textColor;
    }
    return '#1f2937';
  })();

  const stickyStyle: React.CSSProperties = {
    width: sizing.hasWidth ? sizing.width : 'fit-content',
    minWidth: sizing.hasWidth ? sizing.width : 160,
    maxWidth: sizing.hasWidth ? sizing.width : 360,
    height: sizing.hasHeight ? sizing.height : undefined,
    minHeight: sizing.hasHeight ? sizing.height : 96,
    padding: 16,
    backgroundColor: resolvedPattern.backgroundColor ?? '#fce588',
    backgroundImage: resolvedPattern.backgroundImage,
    backgroundRepeat: resolvedPattern.backgroundRepeat,
    backgroundSize: resolvedPattern.backgroundSize,
    overflow: sizing.hasFixedFrame ? 'hidden' : 'visible',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.24s ease',
    boxShadow: selected
      ? '0 0 0 2px rgba(56, 189, 248, 0.45), 0 10px 24px rgba(15, 23, 42, 0.2)'
      : '0 8px 20px rgba(15, 23, 42, 0.16)',
    ...resolveStickyShapeStyle(normalized.shape),
  };

  return (
    <BaseNode
      className={twMerge(
        clsx(
          'flex flex-col justify-center items-center',
          !selected && 'hover:-translate-y-0.5',
          legacyColorClassName,
          raw.className,
        ),
      )}
      style={stickyStyle}
    >
      {(() => {
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
                textClassName: 'text-base leading-relaxed font-medium',
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
