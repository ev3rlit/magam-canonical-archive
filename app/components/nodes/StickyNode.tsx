import React, { memo, useMemo } from 'react';
import { NodeProps } from 'reactflow';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { BaseNode } from './BaseNode';
import type { RenderableChild } from '@/utils/childComposition';
import { renderNodeContent } from './renderableContent';
import { useGraphStore } from '@/store/graph';
import type { FontFamilyPreset, PaperMaterial, PaperTextureParams } from '@magam/core';
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
  const getMaskStyle = (svgContent: string): React.CSSProperties => {
    const encoded = `url("data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}")`;
    return {
      WebkitMaskImage: encoded,
      WebkitMaskSize: '100% 100%',
      WebkitMaskRepeat: 'no-repeat',
      WebkitMaskPosition: 'center',
      maskImage: encoded,
      maskSize: '100% 100%',
      maskRepeat: 'no-repeat',
      maskPosition: 'center',
      borderRadius: 0,
    };
  };

  if (shape === 'heart') {
    return getMaskStyle(`
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M50 95 C 20 70 0 45 0 25 C 0 10 12 0 25 0 C 37 0 45 10 50 18 C 55 10 63 0 75 0 C 88 0 100 10 100 25 C 100 45 80 70 50 95 Z" />
      </svg>
    `);
  }
  if (shape === 'cloud') {
    return getMaskStyle(`
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M25 90 c-13.8 0-25-11.2-25-25 c0-11.8 8.1-21.7 19.2-24.3 C22 25 33.7 12 48 12 c16 0 29.3 11.4 32.5 26.5 C92 40 100 49.8 100 61.5 c0 13-10.5 23.5-23.5 23.5 H25 z" />
      </svg>
    `);
  }
  if (shape === 'speech') {
    return getMaskStyle(`
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 10 C5 0 15 0 15 0 L85 0 C95 0 95 10 95 10 L95 70 C95 80 85 80 85 80 L40 80 L15 100 L20 80 L15 80 C5 80 5 70 5 70 Z" />
      </svg>
    `);
  }
  return {
    borderRadius: 6,
  };
}

const NOISE_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E")`;

interface PaperTextureResult {
  backgroundImage?: string;
  backgroundSize?: string;
  boxShadow: string;
}

function buildPaperTextureStyle(
  texture: PaperTextureParams | undefined,
  baseBackgroundImage: string | undefined,
  baseBackgroundSize: string | undefined,
  selected: boolean,
): PaperTextureResult {
  if (!texture) {
    return {
      boxShadow: selected
        ? '0 0 0 2px rgba(56, 189, 248, 0.45), 0 10px 24px rgba(15, 23, 42, 0.2)'
        : '0 8px 20px rgba(15, 23, 42, 0.16)',
    };
  }

  const { glossOpacity = 0, insetShadowOpacity = 0, shadowWarmth = 0 } = texture;

  // Gloss layer prepended to existing backgroundImage
  const glossLayer = glossOpacity > 0
    ? `linear-gradient(180deg, rgba(255,255,255,${glossOpacity}), transparent 30%)`
    : null;

  let backgroundImage: string | undefined;
  let backgroundSize: string | undefined;
  if (glossLayer) {
    backgroundImage = baseBackgroundImage
      ? `${glossLayer}, ${baseBackgroundImage}`
      : glossLayer;
    backgroundSize = baseBackgroundSize
      ? `100% 100%, ${baseBackgroundSize}`
      : '100% 100%';
  }

  // Warm shadow interpolation: cool rgba(15,23,42) → warm rgba(90,62,40)
  const r = Math.round(15 + (90 - 15) * shadowWarmth);
  const g = Math.round(23 + (62 - 23) * shadowWarmth);
  const b = Math.round(42 + (40 - 42) * shadowWarmth);

  const insetPart = insetShadowOpacity > 0
    ? `inset 0 -2px 4px rgba(0,0,0,${insetShadowOpacity})`
    : null;

  const outerShadow = selected
    ? `0 0 0 2px rgba(56, 189, 248, 0.45), 0 10px 24px rgba(${r},${g},${b},0.2)`
    : `0 8px 20px rgba(${r},${g},${b},0.16)`;

  const boxShadow = insetPart ? `${outerShadow}, ${insetPart}` : outerShadow;

  return {
    ...(backgroundImage ? { backgroundImage, backgroundSize } : {}),
    boxShadow,
  };
}

function NoiseOverlay({ opacity }: { opacity: number }) {
  if (opacity <= 0) return null;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 'inherit',
        background: NOISE_SVG,
        backgroundSize: '256px 256px',
        opacity,
        mixBlendMode: 'multiply',
        pointerEvents: 'none',
      }}
    />
  );
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

  const textureStyle = useMemo(
    () => buildPaperTextureStyle(
      resolvedPattern.texture,
      resolvedPattern.backgroundImage,
      resolvedPattern.backgroundSize,
      !!selected,
    ),
    [resolvedPattern.texture, resolvedPattern.backgroundImage, resolvedPattern.backgroundSize, selected],
  );

  const noiseOpacity = resolvedPattern.texture?.noiseOpacity ?? 0;

  const stickyStyle: React.CSSProperties = {
    position: 'relative',
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
    ...resolveStickyShapeStyle(normalized.shape),
    ...textureStyle,
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
      <NoiseOverlay opacity={noiseOpacity} />
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
