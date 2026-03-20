import React, { ErrorInfo, memo, useEffect, useMemo, useState } from 'react';
import { NodeProps, useNodeId } from 'reactflow';
import { BaseNode } from './BaseNode';
import { normalizeStickerData } from '@/utils/stickerDefaults';
import { useGraphStore } from '@/store/graph';
import { getLucideIconByName } from '@/utils/lucideRegistry';
import { toAssetApiUrl } from '@/utils/imageSource';
import type { RenderableChild, RenderChildNode } from '@/utils/childComposition';
import { stickerDebugLog } from '@/utils/stickerDebug';
import { getStickerJitterAngle, resolveStickerRotation } from '@/utils/stickerJitter';
import type { FontFamilyPreset } from '@magam/core';
import { LazyMarkdownRenderer } from '@/components/markdown/LazyMarkdownRenderer';
import { emitSizeWarning } from '@/utils/sizeWarnings';
import { resolveTypography } from '@/utils/sizeResolver';
import {
  resolveFontFamilyCssValue,
} from '@/utils/fontHierarchy';

interface StickerNodeData {
  label?: string;
  width?: number;
  height?: number;
  rotation?: number;
  outlineWidth?: number;
  outlineColor?: string;
  shadow?: 'none' | 'sm' | 'md' | 'lg';
  padding?: number;
  fontFamily?: FontFamilyPreset;
  children?: RenderableChild[];
  className?: string;
}

type StickerTextChild = Extract<RenderableChild, { type: 'text' | 'lucide-icon' }>;

interface StickerNodeBoundaryProps {
  selected: boolean;
  resetKey: string;
  children: React.ReactNode;
}

interface StickerNodeBoundaryState {
  hasError: boolean;
}

class StickerNodeBoundary extends React.Component<StickerNodeBoundaryProps, StickerNodeBoundaryState> {
  state: StickerNodeBoundaryState = { hasError: false };

  static getDerivedStateFromError(): StickerNodeBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[StickerNode] render error:', error, info);
  }

  componentDidUpdate(prevProps: StickerNodeBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <BaseNode
          className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2"
          startHandle
          endHandle
        >
          <span className="text-xs font-medium text-amber-800">Sticker render error</span>
        </BaseNode>
      );
    }

    return this.props.children;
  }
}

const EDGE_STROKE_SHADOW_MAP: Record<NonNullable<StickerNodeData['shadow']>, string> = {
  none: 'none',
  sm: '0 0 1px rgba(15, 23, 42, 0.28)',
  md: '0 0 3px rgba(15, 23, 42, 0.8)',
  lg: '0 0 5px rgba(15, 23, 42, 0.42)',
};

const DEPTH_SHADOW_MAP: Record<NonNullable<StickerNodeData['shadow']>, string> = {
  none: 'none',
  sm: '0 0 10px rgba(15, 23, 42, 0.2)',
  md: '0 0 10px rgba(15, 23, 42, 0.6)',
  lg: '0 0 24px rgba(15, 23, 42, 0.6)',
};

const STICKER_CUTLINE = 'polygon(3% 11%, 10% 3%, 90% 2%, 97% 10%, 99% 30%, 98% 88%, 93% 99%, 7% 98%, 2% 86%, 1% 30%)';
const INLINE_SVG_ALLOWED_TAGS = new Set([
  'svg',
  'g',
  'defs',
  'lineargradient',
  'radialgradient',
  'stop',
  'pattern',
  'clippath',
  'mask',
  'symbol',
  'use',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'title',
  'desc',
  'image',
  'filter',
  'fegaussianblur',
  'feoffset',
  'fecolormatrix',
  'feblend',
  'femorphology',
  'fedropshadow',
  'fecomposite',
  'femerge',
  'femergenode',
]);

function buildDiecutTextShadow(outlineColor: string, radius: number, depthShadow: string): string {
  const r = Math.max(1, Math.min(8, Math.round(radius)));
  const shadows: string[] = [];

  for (let x = -r; x <= r; x += 1) {
    for (let y = -r; y <= r; y += 1) {
      if (x === 0 && y === 0) continue;
      if ((x * x) + (y * y) > (r * r)) continue;
      shadows.push(`${x}px ${y}px 0 ${outlineColor}`);
    }
  }

  if (depthShadow !== 'none') {
    shadows.push(depthShadow);
  }

  return shadows.join(', ');
}

function composeDualShadow(edgeShadow: string, depthShadow: string): string {
  if (edgeShadow === 'none' && depthShadow === 'none') {
    return 'none';
  }
  if (edgeShadow === 'none') {
    return depthShadow;
  }
  if (depthShadow === 'none') {
    return edgeShadow;
  }
  return `${edgeShadow}, ${depthShadow}`;
}

function toReactPropName(propName: string): string {
  const lowered = propName.toLowerCase();
  if (lowered === 'class') return 'className';
  if (lowered === 'for') return 'htmlFor';
  if (lowered === 'viewbox') return 'viewBox';
  if (lowered === 'preserveaspectratio') return 'preserveAspectRatio';
  if (lowered === 'xlink:href') return 'xlinkHref';
  if (lowered === 'xml:space') return 'xmlSpace';
  if (propName.startsWith('data-') || propName.startsWith('aria-')) return propName;
  if (!propName.includes('-') && !propName.includes(':')) return propName;
  return propName.replace(/[:-]+([a-zA-Z])/g, (_, char: string) => char.toUpperCase());
}

function normalizeInlineNodeProps(
  props: RenderChildNode['props'] | undefined,
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  if (!props) return normalized;

  Object.entries(props).forEach(([propName, value]) => {
    if (value === undefined || value === null) return;
    if (propName === 'text' || propName === 'content') return;
    if (propName.startsWith('on')) return;
    normalized[toReactPropName(propName)] = value;
  });

  return normalized;
}

function isPrimitiveRenderableValue(value: unknown): value is string | number {
  return typeof value === 'string' || typeof value === 'number';
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

function getInlineTextNodeValue(node: RenderChildNode): string | number | null {
  if (!(node.type === 'text' || node.type === '#text')) {
    return null;
  }

  const props = node.props ?? {};
  const meaningfulKeys = Object.keys(props).filter((key) => props[key] !== undefined && props[key] !== null);
  const isPureTextNode = meaningfulKeys.every(
    (key) => key === 'text' || key === 'content' || key === 'children',
  );

  if (!isPureTextNode || (Array.isArray(node.children) && node.children.length > 0)) {
    return null;
  }

  const value = props.text ?? props.content ?? props.children;
  if (!isPrimitiveRenderableValue(value)) {
    return null;
  }

  return value;
}

interface InlineSvgRenderOptions {
  isRoot?: boolean;
  rootStyle?: React.CSSProperties;
}

function renderInlineSvgNode(
  node: RenderChildNode,
  key: string,
  options: InlineSvgRenderOptions = {},
): React.ReactNode {
  const textValue = getInlineTextNodeValue(node);
  if (textValue !== null) {
    return textValue;
  }

  if (typeof node.type !== 'string' || node.type.trim() === '') {
    return null;
  }

  const tagName = node.type;
  if (!INLINE_SVG_ALLOWED_TAGS.has(tagName.toLowerCase())) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[StickerNode] Unsupported inline SVG tag '${tagName}' ignored.`);
    }
    return null;
  }

  const normalizedProps = normalizeInlineNodeProps(node.props);

  if (tagName.toLowerCase() === 'svg' && options.isRoot) {
    const rawStyle = normalizedProps.style;
    const normalizedStyle =
      rawStyle && typeof rawStyle === 'object' && !Array.isArray(rawStyle)
        ? rawStyle as React.CSSProperties
        : {};
    if (normalizedProps.preserveAspectRatio === undefined) {
      normalizedProps.preserveAspectRatio = 'xMidYMid meet';
    }
    normalizedProps.style = {
      ...normalizedStyle,
      display: 'block',
      width: '100%',
      height: '100%',
      maxWidth: '100%',
      maxHeight: '100%',
      ...options.rootStyle,
    };
  }

  const propChildren = normalizedProps.children;
  delete normalizedProps.children;

  const renderedChildren: React.ReactNode[] = [];

  if (Array.isArray(node.children) && node.children.length > 0) {
    node.children.forEach((child, index) => {
      renderedChildren.push(renderInlineSvgNode(child, `${key}-${index}`));
    });
  } else if (Array.isArray(propChildren)) {
    propChildren.forEach((child, index) => {
      if (isPrimitiveRenderableValue(child)) {
        renderedChildren.push(child);
        return;
      }
      if (child && typeof child === 'object' && 'type' in (child as Record<string, unknown>)) {
        renderedChildren.push(renderInlineSvgNode(child as RenderChildNode, `${key}-${index}`));
      }
    });
  } else if (isPrimitiveRenderableValue(propChildren)) {
    renderedChildren.push(propChildren);
  } else {
    const fallbackText = node.props?.text ?? node.props?.content;
    if (isPrimitiveRenderableValue(fallbackText)) {
      renderedChildren.push(fallbackText);
    }
  }

  if (renderedChildren.length > 0) {
    return React.createElement(tagName, { ...normalizedProps, key }, ...renderedChildren);
  }

  return React.createElement(tagName, { ...normalizedProps, key });
}

interface AlphaOutlineFilterSpec {
  dilateRadius: number;
  hasDepth: boolean;
  depthDy: number;
  depthStdDeviation: number;
  depthOpacity: number;
}

function resolveAlphaOutlineFilterSpec(
  outlineWidth: number,
  shadow: NonNullable<StickerNodeData['shadow']>,
): AlphaOutlineFilterSpec {
  const dilateRadius = Math.max(1, Math.min(7, outlineWidth * 0.45));

  if (shadow === 'none') {
    return {
      dilateRadius,
      hasDepth: false,
      depthDy: 0,
      depthStdDeviation: 0,
      depthOpacity: 0,
    };
  }

  if (shadow === 'sm') {
    return {
      dilateRadius,
      hasDepth: true,
      depthDy: 1.6,
      depthStdDeviation: 1.8,
      depthOpacity: 0.2,
    };
  }

  if (shadow === 'md') {
    return {
      dilateRadius,
      hasDepth: true,
      depthDy: 2.4,
      depthStdDeviation: 2.6,
      depthOpacity: 0.3,
    };
  }

  return {
    dilateRadius,
    hasDepth: true,
    depthDy: 3.2,
    depthStdDeviation: 3.2,
    depthOpacity: 0.38,
  };
}

function sanitizeFilterIdPart(value: string): string {
  const safe = value.replace(/[^a-zA-Z0-9_-]/g, '-');
  return safe.length > 0 ? safe : 'node';
}

const resolveRenderableChildren = (children: unknown): RenderableChild[] => {
  if (!Array.isArray(children)) {
    return [];
  }

  const filtered: RenderableChild[] = [];

  children.forEach((child) => {
    if (!child || typeof child !== 'object' || !('type' in (child as Record<string, unknown>))) {
      return;
    }

    const candidate = child as RenderableChild;
    if (
      candidate.type === 'text' ||
      candidate.type === 'lucide-icon' ||
      candidate.type === 'graph-image' ||
      candidate.type === 'graph-markdown' ||
      candidate.type === 'svg-inline'
    ) {
      filtered.push(candidate);
      return;
    }

    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[StickerNode] Unknown sticker child type '${(child as { type?: string }).type}' ignored.`);
    }
  });

  return filtered;
};

const resolveImageErrorStateKey = (src: string, index: number) => `${src}:${index}`;

const StickerNode = ({ data, selected }: NodeProps<StickerNodeData>) => {
  const nodeId = useNodeId();
  const currentFile = useGraphStore((state) => state.currentFile);
  const globalFontFamily = useGraphStore((state) => state.globalFontFamily);
  const canvasFontFamily = useGraphStore((state) => state.canvasFontFamily);
  const normalized = useMemo(() => normalizeStickerData(data as Record<string, unknown>), [data]);
  const children = useMemo(() => resolveRenderableChildren(data.children), [data.children]);
  const resolvedFontFamily = resolveFontFamilyCssValue({
    nodeFontFamily: data.fontFamily,
    canvasFontFamily,
    globalFontFamily,
  });
  useEffect(() => {
    const sizeInput = (data as { size?: unknown }).size;
    if (sizeInput === undefined) return;
    emitSizeWarning({
      code: 'UNSUPPORTED_LEGACY_SIZE_API',
      component: 'StickerNode',
      inputPath: 'size',
      fallbackApplied: 'ignored legacy input',
    });
  }, [(data as { size?: unknown }).size]);

  const hasChildren = children.length > 0;
  const isTextMode = useMemo(
    () =>
      hasChildren
        ? children.every((child) => child.type === 'text' || child.type === 'lucide-icon')
        : true,
    [children, hasChildren],
  );
  const isAlphaVisualMode = useMemo(
    () => hasChildren && children.every((child) => child.type === 'svg-inline' || child.type === 'graph-image'),
    [children],
  );

  const fallbackLabel = data.label || 'Sticker';
  const outlineWidth = normalized.outlineWidth;
  const outlineColor = normalized.outlineColor;
  const hasExplicitRotation = typeof data.rotation === 'number' && Number.isFinite(data.rotation);
  const jitterSeed = nodeId || fallbackLabel;
  const jitterRotation = useMemo(() => getStickerJitterAngle(jitterSeed), [jitterSeed]);
  const effectiveRotation = useMemo(
    () => resolveStickerRotation(data.rotation, jitterSeed),
    [data.rotation, jitterSeed],
  );
  const textStroke = Math.max(1, Math.min(14, Math.round(outlineWidth / 2)));
  const edgeShadow = EDGE_STROKE_SHADOW_MAP[normalized.shadow];
  const depthShadow = DEPTH_SHADOW_MAP[normalized.shadow];
  const dualShadow = useMemo(
    () => composeDualShadow(edgeShadow, depthShadow),
    [depthShadow, edgeShadow],
  );
  const diecutTextShadow = useMemo(
    () => buildDiecutTextShadow(outlineColor, textStroke, dualShadow),
    [dualShadow, outlineColor, textStroke],
  );
  const alphaOutlineFilterSpec = useMemo(
    () => resolveAlphaOutlineFilterSpec(outlineWidth, normalized.shadow),
    [normalized.shadow, outlineWidth],
  );
  const alphaOutlineFilterId = useMemo(
    () => `sticker-alpha-outline-${sanitizeFilterIdPart(nodeId || fallbackLabel)}`,
    [fallbackLabel, nodeId],
  );
  const alphaOutlineFilterUrl = useMemo(
    () => `url(#${alphaOutlineFilterId})`,
    [alphaOutlineFilterId],
  );

  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const hasImageChild = useMemo(
    () => children.some((child) => child.type === 'graph-image'),
    [children],
  );
  const hasMarkdownChild = useMemo(
    () => children.some((child) => child.type === 'graph-markdown'),
    [children],
  );
  const hasInlineSvgChild = useMemo(
    () => children.some((child) => child.type === 'svg-inline'),
    [children],
  );

  const markImageError = (src: string) => {
    stickerDebugLog('image-error', { src });
    const key = src;
    setImageErrors((prev) => {
      if (prev[key]) return prev;
      return { ...prev, [key]: true };
    });
  };

  useEffect(() => {
    stickerDebugLog('render', {
      nodeId,
      nodeLabel: fallbackLabel,
      childTypes: children.map((child) => child.type),
      hasChildren,
      isTextMode,
      modeReason: isTextMode ? 'text-or-icon-only' : isAlphaVisualMode ? 'alpha-visual' : 'contains-markdown-or-image',
      hasImageChild,
      hasMarkdownChild,
      hasInlineSvgChild,
      isAlphaVisualMode,
      outlineWidth,
      outlineColor,
      hasExplicitRotation,
      jitterSeed,
      jitterRotation,
      effectiveRotation,
      textStroke,
      diecutTextShadow,
      edgeShadow,
      depthShadow,
      dualShadow,
      alphaOutlineFilterId,
      alphaOutlineFilterSpec,
      shadow: normalized.shadow,
      padding: normalized.padding,
      rotation: data.rotation ?? 0,
      width: data.width,
      height: data.height,
      currentFile,
    });
  }, [
    children,
    currentFile,
    data.height,
    data.rotation,
    data.width,
    fallbackLabel,
    hasExplicitRotation,
    hasImageChild,
    hasChildren,
    hasMarkdownChild,
    hasInlineSvgChild,
    isAlphaVisualMode,
    isTextMode,
    jitterRotation,
    jitterSeed,
    nodeId,
    dualShadow,
    edgeShadow,
    diecutTextShadow,
    depthShadow,
    normalized.padding,
    normalized.shadow,
    outlineColor,
    outlineWidth,
    alphaOutlineFilterId,
    alphaOutlineFilterSpec,
    effectiveRotation,
    textStroke,
  ]);

  useEffect(() => {
    if (typeof document === 'undefined' || !nodeId) {
      return;
    }

    const escapedId =
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape(nodeId)
        : nodeId.replace(/"/g, '\\"');
    const wrapper = document.querySelector(`.react-flow__node[data-id="${escapedId}"]`) as HTMLElement | null;
    if (!wrapper) {
      stickerDebugLog('wrapper-style', {
        nodeId,
        found: false,
      });
      return;
    }

    const computed = window.getComputedStyle(wrapper);
    stickerDebugLog('wrapper-style', {
      nodeId,
      found: true,
      className: wrapper.className,
      backgroundColor: computed.backgroundColor,
      border: computed.border,
      padding: computed.padding,
      boxShadow: computed.boxShadow,
    });
  }, [nodeId, isTextMode]);

  const renderTextContent = (child: StickerTextChild, index: number) => {
    if (child.type === 'lucide-icon') {
      const Icon = getLucideIconByName(child.name);
      if (!Icon) return null;

      return <Icon key={`icon-${child.name}-${index}`} className="w-6 h-6" />;
    }

    const typography = child.fontSize !== undefined
      ? resolveTypography(child.fontSize, {
          component: 'StickerNode',
          inputPath: `children[${index}].fontSize`,
        })
      : null;

    return (
      <span
        key={`text-${index}`}
        style={{
          color: '#111827',
          fontSize: typography ? typography.fontSizePx : hasChildren ? 22 : 20,
          ...(typography ? { lineHeight: `${typography.lineHeightPx}px` } : {}),
          fontWeight: 700,
          fontFamily: resolvedFontFamily,
          letterSpacing: '0.02em',
          whiteSpace: 'pre-wrap',
          textAlign: 'center',
          WebkitTextStrokeWidth: '1px',
          WebkitTextStrokeColor: outlineColor,
          paintOrder: 'stroke fill',
          textShadow: diecutTextShadow,
        }}
      >
        {child.text}
      </span>
    );
  };

  const renderContent = () => {
    if (isTextMode) {
      const sourceChildren: StickerTextChild[] = hasChildren
        ? (children as StickerTextChild[])
        : [{ type: 'text', text: fallbackLabel }];

      return (
        <div className="inline-flex flex-wrap items-center justify-center gap-2 px-1" style={{ maxWidth: 280 }}>
          {sourceChildren.map((child, index) => renderTextContent(child, index))}
        </div>
      );
    }

    return children.length === 0
      ? (
        <span
          key="text-fallback"
        style={{
          color: '#111827',
          fontSize: 20,
          fontWeight: 700,
          fontFamily: resolvedFontFamily,
          whiteSpace: 'pre-wrap',
          lineHeight: 1.2,
          textAlign: 'center',
            textShadow: dualShadow,
          }}
        >
          {fallbackLabel}
        </span>
      )
      : (
        <div className="inline-flex flex-wrap items-center justify-center gap-2">
          {children.map((child, index) => {
            if (child.type === 'text') {
              return (
                <span
                  key={`text-${index}`}
                  style={{
                    fontSize: 18,
                    fontFamily: resolvedFontFamily,
                    lineHeight: 1.2,
                    color: '#111827',
                    whiteSpace: 'pre-wrap',
                    maxWidth: 320,
                  }}
                >
                  {child.text}
                </span>
              );
            }

            if (child.type === 'lucide-icon') {
              const Icon = getLucideIconByName(child.name);
              if (!Icon) return null;

              return <Icon key={`icon-${child.name}-${index}`} className="w-6 h-6" />;
            }

            if (child.type === 'graph-image') {
              const resolved = child.src
                ? toAssetApiUrl(currentFile, child.src)
                : '';

              const imageErrorKey = resolved
                ? resolveImageErrorStateKey(resolved, index)
                : `${index}`;

              if (!resolved || imageErrors[imageErrorKey]) {
                return (
                  <div
                    key={`image-${index}`}
                    style={{
                      width: data.width || child.width || 150,
                      height: data.height || child.height || 100,
                    }}
                    className="flex items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-500"
                  >
                    image not found
                  </div>
                );
              }

              const isJpgLike = /\.(jpe?g)(\?.*)?$/i.test(child.src);

              return (
                <img
                  key={`image-${index}`}
                  src={resolved}
                  alt={child.alt || ''}
                  className="max-h-64 max-w-64"
                  style={{
                    width: data.width || child.width || 'auto',
                    height: data.height || child.height || 'auto',
                    borderRadius: isAlphaVisualMode
                      ? 0
                      : isJpgLike
                        ? 0
                        : 12,
                    filter: isAlphaVisualMode
                      ? alphaOutlineFilterUrl
                      : isJpgLike
                        ? 'drop-shadow(0 4px 10px rgba(0,0,0,0.2))'
                        : 'drop-shadow(0 2px 8px rgba(0,0,0,0.18))',
                  }}
                  onError={() => markImageError(imageErrorKey)}
                />
              );
            }

            if (child.type === 'svg-inline') {
              const svgWidth = Math.max(
                72,
                Math.min(
                  240,
                  Math.round(coerceNumber(data.width) ?? coerceNumber(child.node.props?.width) ?? 140),
                ),
              );
              const svgHeight = Math.max(
                72,
                Math.min(
                  200,
                  Math.round(coerceNumber(data.height) ?? coerceNumber(child.node.props?.height) ?? 110),
                ),
              );

              return (
                <div
                  key={`svg-inline-${index}`}
                  className="inline-flex items-center justify-center"
                  style={{
                    width: svgWidth,
                    height: svgHeight,
                  }}
                >
                  {renderInlineSvgNode(
                    child.node,
                    `svg-inline-${index}-root`,
                    {
                      isRoot: true,
                      rootStyle: isAlphaVisualMode
                        ? {
                            overflow: 'visible',
                            filter: alphaOutlineFilterUrl,
                          }
                        : undefined,
                    },
                  )}
                </div>
              );
            }

            if (child.type === 'graph-markdown') {
              return (
                <div
                  key={`markdown-${index}`}
                  className="prose prose-slate prose-sm max-w-none"
                  style={{ lineHeight: 1.2, fontFamily: resolvedFontFamily }}
                >
                  <LazyMarkdownRenderer content={child.content} />
                </div>
              );
            }

            return null;
          })}
        </div>
      );
  };

  const containerStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: (isTextMode || isAlphaVisualMode) ? 'transparent' : '#fff',
    padding: (isTextMode || isAlphaVisualMode) ? 0 : Math.max(2, Math.round(outlineWidth)),
    borderRadius: (isTextMode || isAlphaVisualMode) ? undefined : 24,
    clipPath: (isTextMode || isAlphaVisualMode) ? undefined : STICKER_CUTLINE,
    WebkitClipPath: (isTextMode || isAlphaVisualMode) ? undefined : STICKER_CUTLINE,
    border: (isTextMode || isAlphaVisualMode)
      ? 'none'
      : `${Math.max(2, Math.round(outlineWidth / 1.5))}px solid ${outlineColor}`,
    boxShadow: isAlphaVisualMode ? 'none' : dualShadow,
    fontFamily: resolvedFontFamily,
    minWidth: data.width ? `${data.width}px` : undefined,
    minHeight: data.height ? `${data.height}px` : undefined,
    borderColor: outlineColor,
  };

  const innerStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: isTextMode
      ? `${Math.max(2, Math.round((normalized.padding || 0) / 2))}px ${Math.max(4, normalized.padding || 0)}px`
      : `${Math.max(2, normalized.padding || 0)}px ${Math.max(4, normalized.padding || 0)}px`,
    background: (isTextMode || isAlphaVisualMode) ? 'transparent' : 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, #fefefe 100%)',
    borderRadius: (isTextMode || isAlphaVisualMode) ? undefined : 18,
    minWidth: 24,
    minHeight: 24,
  };

  const textModeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: `${Math.max(2, Math.round((normalized.padding || 0) / 2))}px ${Math.max(4, normalized.padding || 0)}px`,
    minWidth: 24,
    minHeight: 24,
  };

  const alphaOutlineFilterDefs = isAlphaVisualMode
    ? (
      <svg
        width="0"
        height="0"
        aria-hidden
        focusable="false"
        style={{ position: 'absolute', pointerEvents: 'none', overflow: 'hidden' }}
      >
        <defs>
          <filter
            id={alphaOutlineFilterId}
            x="-40%"
            y="-40%"
            width="180%"
            height="180%"
            colorInterpolationFilters="sRGB"
          >
            <feMorphology
              in="SourceAlpha"
              operator="dilate"
              radius={alphaOutlineFilterSpec.dilateRadius}
              result="outlineDilated"
            />
            <feComposite
              in="outlineDilated"
              in2="SourceAlpha"
              operator="out"
              result="outlineRing"
            />
            <feFlood floodColor={outlineColor} result="outlineColorLayer" />
            <feComposite in="outlineColorLayer" in2="outlineRing" operator="in" result="outlineLayer" />
            <feMerge result="baseComposite">
              <feMergeNode in="outlineLayer" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
            {alphaOutlineFilterSpec.hasDepth ? (
              <feDropShadow
                in="baseComposite"
                dx="0"
                dy={alphaOutlineFilterSpec.depthDy}
                stdDeviation={alphaOutlineFilterSpec.depthStdDeviation}
                floodColor="#0f172a"
                floodOpacity={alphaOutlineFilterSpec.depthOpacity}
              />
            ) : null}
          </filter>
        </defs>
      </svg>
    )
    : null;

  if (isTextMode || isAlphaVisualMode) {
    return (
      <BaseNode
        selected={selected}
        style={{ transform: effectiveRotation !== 0 ? `rotate(${effectiveRotation}deg)` : undefined }}
        startHandle
        endHandle
      >
        {alphaOutlineFilterDefs}
        <div
          style={isAlphaVisualMode
            ? {
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: `${Math.max(0, Math.round((normalized.padding || 0) / 3))}px`,
                minWidth: 24,
                minHeight: 24,
              }
            : textModeStyle}
        >
          {renderContent()}
        </div>
      </BaseNode>
    );
  }

  return (
    <BaseNode
      selected={selected}
      style={{ transform: effectiveRotation !== 0 ? `rotate(${effectiveRotation}deg)` : undefined }}
      startHandle
      endHandle
    >
      <div style={containerStyle}>
        <div style={innerStyle}>{renderContent()}</div>
      </div>
    </BaseNode>
  );
};

const StickerNodeWithBoundary = (props: NodeProps<StickerNodeData>) => {
  const data = (props.data || {}) as Record<string, unknown>;
  const childrenSummary = JSON.stringify((data.children as RenderableChild[]) || []);
  const resetKey = `${props.id}|${JSON.stringify({
    rotation: data.rotation,
    outlineWidth: (data.outlineWidth as number | undefined) ?? 0,
    shadow: data.shadow,
    padding: (data.padding as number | undefined) ?? 0,
    childrenSummary,
  })}`;

  return (
    <StickerNodeBoundary selected={props.selected} resetKey={resetKey}>
      <StickerNode {...props} />
    </StickerNodeBoundary>
  );
};

export default memo(StickerNodeWithBoundary);
