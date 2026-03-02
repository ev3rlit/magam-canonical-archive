import { extractNodeContent, extractStickerContent } from '@/utils/nodeContent';
import { normalizeStickerData } from '@/utils/stickerDefaults';
import {
  normalizeStickyDefaults,
  normalizeWashiDefaults,
} from '@/utils/washiTapeDefaults';
import {
  getWashiNodePosition,
  resolveWashiGeometry,
} from '@/utils/washiTapeGeometry';
import { stickerDebugLog } from '@/utils/stickerDebug';
import type { CanvasBackgroundStyle, MindMapGroup } from '@/store/graph';
import type { FontFamilyPreset } from '@magam/core';
import { isFontFamilyPreset } from '@/utils/fontHierarchy';
import {
  assertMindMapTopology,
  buildMindMapEdge,
  fromToEndpointValue,
  parseEdgeEndpoint,
  resolveNodeId,
  type FromProp,
} from '@/app/mindmapParser';

export interface RenderNode {
  type: string;
  props: {
    id?: string;
    from?: FromProp;
    to?: string;
    label?: string;
    text?: string;
    title?: string;
    x?: number;
    y?: number;
    type?: string;
    color?: string;
    bg?: string;
    className?: string;
    fontSize?: number;
    labelColor?: string;
    labelFontSize?: number;
    labelBold?: boolean;
    bold?: boolean;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    labelTextColor?: string;
    labelBgColor?: string;
    edgeLabel?: string;
    edgeClassName?: string;
    content?: string;
    variant?: string;
    src?: string;
    imageSrc?: string;
    alt?: string;
    fit?: string;
    imageFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
    pattern?: Record<string, unknown>;
    edge?: Record<string, unknown>;
    texture?: Record<string, unknown>;
    at?: Record<string, unknown>;
    shape?: 'rectangle' | 'heart' | 'cloud' | 'speech';
    seed?: string | number;
    opacity?: number;
    anchor?: string;
    position?: string;
    gap?: number;
    align?: 'start' | 'center' | 'end';
    width?: number;
    height?: number;
    layout?:
      | 'tree'
      | 'bidirectional'
      | 'radial'
      | 'compact'
      | 'compact-bidir'
      | 'depth-hybrid';
    spacing?: number;
    outlineWidth?: number;
    outlineColor?: string;
    shadow?: 'none' | 'sm' | 'md' | 'lg';
    padding?: number;
    rotation?: number;
    fontFamily?: FontFamilyPreset;
    bubble?: boolean;
    participantSpacing?: number;
    messageSpacing?: number;
    sourceMeta?: {
      sourceId: string;
      kind: 'canvas' | 'mindmap';
      scopeId?: string;
    };
    children?: any;
  };
  children?: RenderNode[];
}

interface RenderGraphResponse {
  graph?: {
    children?: RenderNode[];
    meta?: {
      background?: CanvasBackgroundStyle;
      fontFamily?: unknown;
    };
  };
  sourceVersion?: string | null;
}

export interface ParsedRenderGraph {
  nodes: any[];
  edges: any[];
  needsAutoLayout: boolean;
  layoutType: MindMapGroup['layoutType'];
  mindMapGroups: MindMapGroup[];
  canvasBackground?: CanvasBackgroundStyle;
  canvasFontFamily?: FontFamilyPreset;
  sourceVersion?: string | null;
}

export function parseRenderGraph(data: RenderGraphResponse): ParsedRenderGraph | null {
  if (!data || !data.graph || !data.graph.children) {
    return null;
  }

  const { children } = data.graph;
  const nodes: any[] = [];
  const edges: any[] = [];

  const getEdgeType = (type?: string) => {
    switch (type) {
      case 'straight':
        return 'straight';
      case 'curved':
        return 'default';
      case 'step':
        return 'step';
      case 'default':
        return 'smoothstep';
      default:
        return 'smoothstep';
    }
  };

  const getStrokeStyle = (className?: string) => {
    if (!className) return {};
    if (
      className.includes('dashed') ||
      className.includes('border-dashed')
    ) {
      return { strokeDasharray: '5 5' };
    }
    if (
      className.includes('dotted') ||
      className.includes('border-dotted')
    ) {
      return { strokeDasharray: '2 2' };
    }
    return {};
  };

  const normalizeFontFamily = (value?: unknown): FontFamilyPreset | undefined => (
    isFontFamilyPreset(value) ? value : undefined
  );

  let nodeIdCounter = 0;
  let edgeIdCounter = 0;
  let mindmapIdCounter = 0;
  let sequenceIdCounter = 0;
  let imageIdCounter = 0;

  const mindMapGroups: MindMapGroup[] = [];

  const createMindMapEdge = (
    child: RenderNode,
    params: { nodeId: string; mindmapId: string },
  ) => {
    edges.push(buildMindMapEdge({
      nodeId: params.nodeId,
      mindmapId: params.mindmapId,
      edgeId: `edge-${params.mindmapId}-${params.nodeId}-${edgeIdCounter++}`,
      from: child.props.from,
      edgeLabel: child.props.edgeLabel,
      edgeClassName: child.props.edgeClassName,
      getEdgeType,
      getStrokeStyle,
    }));
  };

  const processChildren = (
    childElements: RenderNode[],
    mindmapId?: string,
  ) => {
    childElements.forEach((child: RenderNode) => {
      assertMindMapTopology({
        mindmapId,
        childType: child.type,
        childId: child.props.id,
        from: child.props.from,
      });

      if (child.type === 'graph-edge') {
        const sourceMeta = parseEdgeEndpoint(
          fromToEndpointValue(child.props.from),
          mindmapId,
        );
        const targetMeta = parseEdgeEndpoint(child.props.to, mindmapId);
        const edgeFontFamily = normalizeFontFamily(child.props.fontFamily);

        const hasHandles = sourceMeta.handle || targetMeta.handle;
        const edgeType = hasHandles
          ? getEdgeType(child.props.type)
          : 'floating';

        edges.push({
          id: child.props.id || `edge-${edgeIdCounter++}`,
          source: sourceMeta.id,
          sourceHandle: sourceMeta.handle,
          target: targetMeta.id,
          targetHandle: targetMeta.handle,
          label: child.props.label,
          style: {
            stroke: child.props.stroke || '#94a3b8',
            strokeWidth: child.props.strokeWidth || 2,
            ...getStrokeStyle(child.props.className),
          },
          labelStyle: {
            fill: child.props.labelTextColor,
            fontSize: child.props.labelFontSize,
            fontWeight: 700,
            fontFamily: edgeFontFamily,
          },
          labelBgStyle: child.props.labelBgColor
            ? {
                fill: child.props.labelBgColor,
              }
            : undefined,
          animated: false,
          type: edgeType,
        });
      } else if (child.type === 'graph-mindmap') {
        const mmId = child.props.id || `mindmap-${mindmapIdCounter++}`;
        const layoutType =
          (child.props.layout as
            | 'tree'
            | 'bidirectional'
            | 'radial'
            | 'compact'
            | 'compact-bidir'
            | 'depth-hybrid') ||
          'tree';
        const baseX = child.props.x ?? 0;
        const baseY = child.props.y ?? 0;

        mindMapGroups.push({
          id: mmId,
          layoutType,
          basePosition: { x: baseX, y: baseY },
          spacing: child.props.spacing,
          anchor: child.props.anchor,
          anchorPosition: child.props.position,
          anchorGap: child.props.gap,
        });

        if (child.children && child.children.length > 0) {
          processChildren(child.children, mmId);
        }
      } else if (child.type === 'graph-sequence') {
        const rawSequenceId =
          child.props.id || `sequence-${sequenceIdCounter++}`;
        const seqId = resolveNodeId(rawSequenceId, mindmapId);
        const sequenceFontFamily = normalizeFontFamily(child.props.fontFamily);
        const participants: {
          id: string;
          label: string;
          className?: string;
        }[] = [];
        const messages: {
          from: string;
          to: string;
          label?: string;
          type: string;
        }[] = [];

        (child.children || []).forEach((seqChild: RenderNode) => {
          if (seqChild.type === 'graph-participant') {
            participants.push({
              id: seqChild.props.id || '',
              label: seqChild.props.label || seqChild.props.id || '',
              className: seqChild.props.className,
            });
          } else if (seqChild.type === 'graph-message') {
            const msgFrom = fromToEndpointValue(seqChild.props.from) || '';
            const msgTo = seqChild.props.to || '';
            messages.push({
              from: msgFrom,
              to: msgTo,
              label: seqChild.props.label,
              type:
                msgFrom === msgTo
                  ? 'self'
                  : seqChild.props.type || 'sync',
            });
          }
        });

        nodes.push({
          id: seqId,
          type: 'sequence-diagram',
          position: { x: child.props.x || 0, y: child.props.y || 0 },
          data: {
            participants,
            messages,
            participantSpacing: child.props.participantSpacing ?? 200,
            messageSpacing: child.props.messageSpacing ?? 60,
            className: child.props.className,
            fontFamily: sequenceFontFamily,
            groupId: mindmapId,
            anchor: child.props.anchor,
            position: child.props.position,
            gap: child.props.gap,
            sourceMeta: child.props.sourceMeta || {
              sourceId: seqId,
              kind: mindmapId ? 'mindmap' : 'canvas',
              scopeId: mindmapId,
            },
          },
        });

        if (mindmapId) {
          createMindMapEdge(child, { nodeId: seqId, mindmapId });
        }
      } else if (child.type === 'graph-node') {
        const rawNodeId = child.props.id || `node-${nodeIdCounter++}`;
        const nodeId = resolveNodeId(rawNodeId, mindmapId);

        const rendererChildren = child.children || [];
        const { label: baseLabel, parsedChildren } = extractNodeContent(
          rendererChildren,
          child.props.children,
          { textJoiner: '\n' },
        );

        const textChildren = baseLabel
          ? [{ type: 'text' as const, text: baseLabel }]
          : [];

        let childBubble = false;

        rendererChildren.forEach((grandChild: RenderNode) => {
          if (grandChild.type === 'graph-markdown') {
            if (grandChild.props.bubble) {
              childBubble = true;
            }
          } else if (grandChild.type === 'graph-image') {
            const imageSrc = grandChild.props.src;
            const imageAlt = grandChild.props.alt || '';
            if (imageSrc) {
              const markdownToken = `![${imageAlt}](${imageSrc})`;
              textChildren.push({ type: 'text', text: markdownToken });
            }
          }
        });

        const safeLabel =
          textChildren.map((content) => content.text).join('\n') ||
          child.props.label ||
          '';

        const hasMarkdown = rendererChildren.some(
          (c: RenderNode) =>
            c.type === 'graph-markdown' || c.type === 'graph-image',
        );

        const nodeBubble = child.props.bubble || childBubble;
        const nodeFontFamily = normalizeFontFamily(child.props.fontFamily);

        nodes.push({
          id: nodeId,
          type: hasMarkdown ? 'markdown' : 'shape',
          position: { x: child.props.x || 0, y: child.props.y || 0 },
          data: {
            label: safeLabel,
            type: child.props.type || 'rectangle',
            color: child.props.color || child.props.bg,
            className: child.props.className,
            groupId: mindmapId,
            sourceMeta: child.props.sourceMeta || {
              sourceId: nodeId,
              kind: mindmapId ? 'mindmap' : 'canvas',
              scopeId: mindmapId,
            },
            fontSize: child.props.fontSize,
            labelColor: child.props.labelColor || child.props.color,
            labelFontSize:
              child.props.labelFontSize || child.props.fontSize,
            labelBold: child.props.labelBold || child.props.bold,
            fill: child.props.fill,
            stroke: child.props.stroke,
            fontFamily: nodeFontFamily,
            children: parsedChildren,
            bubble: nodeBubble,
          },
        });

        if (mindmapId) {
          createMindMapEdge(child, { nodeId, mindmapId });
        }
      } else if (child.type === 'graph-image') {
        const rawImageId = child.props.id || `image-${imageIdCounter++}`;
        const imageId = resolveNodeId(rawImageId, mindmapId);
        nodes.push({
          id: imageId,
          type: 'image',
          position: { x: child.props.x || 0, y: child.props.y || 0 },
          data: {
            src: child.props.src || '',
            alt: child.props.alt,
            width: child.props.width,
            height: child.props.height,
            fit: child.props.fit,
            groupId: mindmapId,
            sourceMeta: child.props.sourceMeta || {
              sourceId: imageId,
              kind: mindmapId ? 'mindmap' : 'canvas',
              scopeId: mindmapId,
            },
          },
        });

        if (mindmapId) {
          createMindMapEdge(child, { nodeId: imageId, mindmapId });
        }
      } else if (child.type === 'graph-sticker') {
        const rawStickerId = child.props.id || `sticker-${nodeIdCounter++}`;
        const stickerId = resolveNodeId(rawStickerId, mindmapId);
        const stickerFontFamily = normalizeFontFamily(child.props.fontFamily);
        const stickerRendererChildren = child.children || [];
        const { label: stickerLabel, parsedChildren: stickerChildren } = extractStickerContent(
          stickerRendererChildren,
          child.props.children,
          { textJoiner: ' ' },
        );
        const normalized = normalizeStickerData(child.props);

        stickerDebugLog('parser', {
          stickerId,
          label: stickerLabel || child.props.label || '',
          rawTypes: stickerRendererChildren.map((item) => item.type),
          parsedTypes: stickerChildren.map((item) => item.type),
          outlineWidth: normalized.outlineWidth,
          outlineColor: normalized.outlineColor,
          shadow: normalized.shadow,
          padding: normalized.padding,
          anchor: child.props.anchor,
          position: child.props.position,
        });

        nodes.push({
          id: stickerId,
          type: 'sticker',
          position: { x: child.props.x || 0, y: child.props.y || 0 },
          data: {
            label: stickerLabel || child.props.label || '',
            width: child.props.width,
            height: child.props.height,
            rotation: child.props.rotation,
            fontFamily: stickerFontFamily,
            groupId: mindmapId,
            children: stickerChildren,
            outlineWidth: normalized.outlineWidth,
            outlineColor: normalized.outlineColor,
            shadow: normalized.shadow,
            padding: normalized.padding,
            anchor: child.props.anchor,
            position: child.props.position,
            gap: child.props.gap,
            align: child.props.align,
            sourceMeta: child.props.sourceMeta || {
              sourceId: stickerId,
              kind: mindmapId ? 'mindmap' : 'canvas',
              scopeId: mindmapId,
            },
          },
        });

        if (mindmapId) {
          createMindMapEdge(child, { nodeId: stickerId, mindmapId });
        }
      } else if (child.type === 'graph-washi-tape') {
        const rawWashiId = child.props.id || `washi-${nodeIdCounter++}`;
        const washiId = resolveNodeId(rawWashiId, mindmapId);
        const washiRendererChildren = child.children || [];
        const { label: washiLabel, parsedChildren: washiChildren } = extractStickerContent(
          washiRendererChildren,
          child.props.children,
          { textJoiner: ' ' },
        );
        const normalizedWashi = normalizeWashiDefaults({
          ...child.props,
          id: washiId,
        });
        const resolvedGeometry = resolveWashiGeometry({
          at: normalizedWashi.at,
          nodes,
          seed: normalizedWashi.seed,
          fallbackPosition: {
            x: child.props.x || 0,
            y: child.props.y || 0,
          },
        });
        const defaultPosition = getWashiNodePosition(resolvedGeometry);

        nodes.push({
          id: washiId,
          type: 'washi-tape',
          position: {
            x:
              typeof child.props.x === 'number'
                ? child.props.x
                : defaultPosition.x,
            y:
              typeof child.props.y === 'number'
                ? child.props.y
                : defaultPosition.y,
          },
          data: {
            label: washiLabel || child.props.label || '',
            pattern: child.props.pattern ?? normalizedWashi.pattern,
            edge: child.props.edge,
            texture: child.props.texture,
            text: child.props.text,
            at: normalizedWashi.at,
            resolvedGeometry,
            seed: normalizedWashi.seed,
            opacity: normalizedWashi.opacity,
            groupId: mindmapId,
            children: washiChildren,
            sourceMeta: child.props.sourceMeta || {
              sourceId: washiId,
              kind: mindmapId ? 'mindmap' : 'canvas',
              scopeId: mindmapId,
            },
          },
        });

        if (mindmapId) {
          createMindMapEdge(child, { nodeId: washiId, mindmapId });
        }
      } else {
        const rawNodeId = child.props.id || `node-${nodeIdCounter++}`;
        const nodeId = resolveNodeId(rawNodeId, mindmapId);
        const nodeFontFamily = normalizeFontFamily(child.props.fontFamily);

        const nestedEdges: RenderNode[] = [];
        const ports: any[] = [];

        const rendererChildren = child.children || [];
        const {
          label: parsedLabel,
          parsedChildren,
        } = extractNodeContent(rendererChildren, child.props.children);

        rendererChildren.forEach((grandChild: RenderNode) => {
          if (grandChild.type === 'graph-edge') {
            nestedEdges.push(grandChild);
          } else if (grandChild.type === 'graph-port') {
            ports.push(grandChild.props);
          }
        });

        nestedEdges.forEach(
          (edgeChild: RenderNode, edgeIndex: number) => {
            const sourceId = resolveNodeId(
              fromToEndpointValue(edgeChild.props.from) || nodeId,
              mindmapId,
            );
            const edgeFontFamily = normalizeFontFamily(edgeChild.props.fontFamily);

            edges.push({
              id:
                edgeChild.props.id ||
                `nested-edge-${nodeId}-${edgeIndex}`,
              source: sourceId,
              target: edgeChild.props.to,
              label: edgeChild.props.label,
              style: {
                stroke: edgeChild.props.stroke || '#94a3b8',
                strokeWidth: edgeChild.props.strokeWidth || 2,
                ...getStrokeStyle(edgeChild.props.className),
              },
              labelStyle: {
                fill: edgeChild.props.labelTextColor,
                fontSize: edgeChild.props.labelFontSize,
                fontWeight: 700,
                fontFamily: edgeFontFamily,
              },
              labelBgStyle: edgeChild.props.labelBgColor
                ? {
                    fill: edgeChild.props.labelBgColor,
                  }
                : undefined,
              animated: false,
              type: getEdgeType(edgeChild.props.type),
            });
          },
        );

        const safeLabel =
          parsedLabel ||
          child.props.label ||
          child.props.title ||
          child.props.text ||
          '';

        const nodeType =
          child.type === 'graph-sticky'
            ? 'sticky'
            : child.type === 'graph-text'
              ? 'text'
              : 'shape';

        const normalizedSticky = nodeType === 'sticky'
          ? normalizeStickyDefaults({
            ...child.props,
            id: nodeId,
          })
          : null;
        const stickyAtInput = normalizedSticky?.at;

        nodes.push({
          id: nodeId,
          type: nodeType,
          position: {
            x: typeof child.props.x === 'number' ? child.props.x : 0,
            y: typeof child.props.y === 'number' ? child.props.y : 0,
          },
          data: {
            label: safeLabel,
            type: child.props.type || 'rectangle',
            shape: nodeType === 'sticky' ? normalizedSticky?.shape : undefined,
            color: child.props.color || child.props.bg,
            className: child.props.className,
            groupId: mindmapId,
            pattern:
              nodeType === 'sticky'
                ? child.props.pattern ?? normalizedSticky?.pattern
                : child.props.pattern,
            at:
              nodeType === 'sticky'
                ? child.props.at ?? stickyAtInput
                : child.props.at,
            fontSize: child.props.fontSize,
            labelColor: child.props.labelColor || child.props.color,
            labelFontSize:
              child.props.labelFontSize || child.props.fontSize,
            labelBold: child.props.labelBold || child.props.bold,
            fill: child.props.fill,
            stroke: child.props.stroke,
            fontFamily: nodeFontFamily,
            children: parsedChildren,
            imageSrc: child.props.imageSrc,
            imageFit: child.props.imageFit,
            ports,
            anchor: child.props.anchor,
            position: child.props.position,
            gap: child.props.gap,
            align: child.props.align,
            width: nodeType === 'sticky' ? (normalizedSticky?.width ?? child.props.width) : child.props.width,
            height: nodeType === 'sticky' ? (normalizedSticky?.height ?? child.props.height) : child.props.height,
            bubble: child.props.bubble,
            sourceMeta: child.props.sourceMeta || {
              sourceId: nodeId,
              kind: mindmapId ? 'mindmap' : 'canvas',
              scopeId: mindmapId,
            },
          },
        });

        if (mindmapId) {
          createMindMapEdge(child, { nodeId, mindmapId });
        }
      }
    });
  };

  processChildren(children);

  const finalizedNodes = nodes.map((node) => {
    if (node.type !== 'washi-tape') {
      return node;
    }

    const data = (node.data || {}) as Record<string, unknown>;
    const normalizedWashi = normalizeWashiDefaults({
      ...data,
      id: node.id,
      x: node.position.x,
      y: node.position.y,
    });
    const atInput = (data.at as Record<string, unknown> | undefined) ?? normalizedWashi.at;
    const resolvedGeometry = resolveWashiGeometry({
      at: atInput as any,
      nodes,
      seed: (data.seed as string | number | undefined) ?? normalizedWashi.seed,
      fallbackPosition: node.position,
    });
    const isAttach = (atInput as { type?: unknown }).type === 'attach';
    const attachedPosition = getWashiNodePosition(resolvedGeometry);

    return {
      ...node,
      position: isAttach ? attachedPosition : node.position,
      data: {
        ...(node.data || {}),
        at: atInput,
        resolvedGeometry,
      },
    };
  });

  const hasMindMap = mindMapGroups.length > 0;
  const layoutType = mindMapGroups[0]?.layoutType || 'tree';

  const canvasBackground = data.graph.meta?.background;
  const rawCanvasFontFamily = data.graph.meta?.fontFamily;
  const canvasFontFamily = normalizeFontFamily(rawCanvasFontFamily);

  return {
    nodes: finalizedNodes,
    edges,
    needsAutoLayout: hasMindMap,
    layoutType,
    mindMapGroups,
    canvasBackground,
    canvasFontFamily,
    sourceVersion: data.sourceVersion ?? null,
  };
}
