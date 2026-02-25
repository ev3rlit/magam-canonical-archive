import React, { ErrorInfo, memo, useEffect, useMemo, useState } from 'react';
import { NodeProps, useNodeId } from 'reactflow';
import { BaseNode } from './BaseNode';
import { normalizeStickerData } from '@/utils/stickerDefaults';
import { useGraphStore } from '@/store/graph';
import { getLucideIconByName } from '@/utils/lucideRegistry';
import { toAssetApiUrl } from '@/utils/imageSource';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { RenderableChild } from '@/utils/childComposition';
import { stickerDebugLog } from '@/utils/stickerDebug';

interface StickerNodeData {
  label?: string;
  width?: number;
  height?: number;
  rotation?: number;
  outlineWidth?: number;
  outlineColor?: string;
  shadow?: 'none' | 'sm' | 'md' | 'lg';
  padding?: number;
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
          <span className="text-xs font-medium text-amber-800">스티커 렌더 오류</span>
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
      candidate.type === 'graph-markdown'
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
  const normalized = useMemo(() => normalizeStickerData(data as Record<string, any>), [data]);
  const children = useMemo(() => resolveRenderableChildren(data.children), [data.children]);

  const hasChildren = children.length > 0;
  const isTextMode = useMemo(
    () =>
      hasChildren
        ? children.every((child) => child.type === 'text' || child.type === 'lucide-icon')
        : true,
    [children, hasChildren],
  );

  const fallbackLabel = data.label || 'Sticker';
  const outlineWidth = normalized.outlineWidth;
  const outlineColor = normalized.outlineColor;
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

  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const hasImageChild = useMemo(
    () => children.some((child) => child.type === 'graph-image'),
    [children],
  );
  const hasMarkdownChild = useMemo(
    () => children.some((child) => child.type === 'graph-markdown'),
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
      modeReason: isTextMode ? 'text-or-icon-only' : 'contains-markdown-or-image',
      hasImageChild,
      hasMarkdownChild,
      outlineWidth,
      outlineColor,
      textStroke,
      diecutTextShadow,
      edgeShadow,
      depthShadow,
      dualShadow,
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
    hasImageChild,
    hasChildren,
    hasMarkdownChild,
    isTextMode,
    nodeId,
    dualShadow,
    edgeShadow,
    diecutTextShadow,
    depthShadow,
    normalized.padding,
    normalized.shadow,
    outlineColor,
    outlineWidth,
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

    return (
      <span
        key={`text-${index}`}
        style={{
          color: '#111827',
          fontSize: hasChildren ? 22 : 20,
          fontWeight: 700,
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
                    borderRadius: isJpgLike ? 0 : 12,
                    filter: isJpgLike
                      ? 'drop-shadow(0 4px 10px rgba(0,0,0,0.2))'
                      : 'drop-shadow(0 2px 8px rgba(0,0,0,0.18))',
                  }}
                  onError={() => markImageError(imageErrorKey)}
                />
              );
            }

            if (child.type === 'graph-markdown') {
              return (
                <div
                  key={`markdown-${index}`}
                  className="prose prose-slate prose-sm max-w-none"
                  style={{ lineHeight: 1.2 }}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {child.content}
                  </ReactMarkdown>
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
    background: isTextMode ? 'transparent' : '#fff',
    padding: isTextMode ? 0 : Math.max(2, Math.round(outlineWidth)),
    borderRadius: isTextMode ? undefined : 24,
    clipPath: isTextMode ? undefined : STICKER_CUTLINE,
    WebkitClipPath: isTextMode ? undefined : STICKER_CUTLINE,
    border: isTextMode
      ? 'none'
      : `${Math.max(2, Math.round(outlineWidth / 1.5))}px solid ${outlineColor}`,
    boxShadow: dualShadow,
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
    background: isTextMode ? 'transparent' : 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, #fefefe 100%)',
    borderRadius: isTextMode ? undefined : 18,
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

  if (isTextMode) {
    return (
      <BaseNode
        selected={selected}
        style={{ transform: data.rotation ? `rotate(${data.rotation}deg)` : undefined }}
        startHandle
        endHandle
      >
        <div style={textModeStyle}>{renderContent()}</div>
      </BaseNode>
    );
  }

  return (
    <BaseNode
      selected={selected}
      style={{ transform: data.rotation ? `rotate(${data.rotation}deg)` : undefined }}
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
