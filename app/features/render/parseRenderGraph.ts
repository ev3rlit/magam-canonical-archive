import { extractNodeContent, extractStickerContent } from '@/utils/nodeContent';
import type { RenderChildNode } from '@/utils/childComposition';
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
import type {
  FontFamilyPreset,
  MarkdownSizeInput,
  ObjectSizeInput,
  SizeValue,
} from '@magam/core';
import { isFontFamilyPreset } from '@/utils/fontHierarchy';
import { emitSizeWarning } from '@/utils/sizeWarnings';
import {
  assertMindMapTopology,
  buildMindMapEdge,
  fromToEndpointValue,
  parseEdgeEndpoint,
  resolveNodeId,
  type FromProp,
} from '@/app/mindmapParser';
import { deriveEditMeta } from '@/features/editing/editability';
import { createCanonicalFromLegacyAliasInput } from '@/features/render/aliasNormalization';
import type {
  CapabilityBag,
  CanonicalObjectAlias,
  ObjectCore,
} from '@/features/render/canonicalObject';

const DEFAULT_MINDMAP_SPACING = 50;

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
    locked?: boolean;
    fontSize?: SizeValue | string;
    labelColor?: string;
    labelFontSize?: number;
    labelBold?: boolean;
    bold?: boolean;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    lineDirection?: 'up' | 'down';
    labelTextColor?: string;
    labelBgColor?: string;
    edgeLabel?: string;
    edgeClassName?: string;
    content?: string | Record<string, unknown>;
    variant?: string;
    groupId?: string;
    src?: string;
    imageSrc?: string;
    alt?: string;
    fit?: string;
    frame?: Record<string, unknown>;
    material?: Record<string, unknown>;
    imageFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
    pattern?: Record<string, unknown>;
    edge?: Record<string, unknown>;
    texture?: Record<string, unknown>;
    attach?: Record<string, unknown>;
    at?: Record<string, unknown>;
    shape?: 'rectangle' | 'heart' | 'cloud' | 'speech';
    seed?: string | number;
    opacity?: number;
    anchor?: string;
    position?: string;
    gap?: number;
    align?: 'start' | 'center' | 'end';
    size?: unknown;
    width?: number;
    height?: number;
    zIndex?: number;
    layout?:
      | 'tree'
      | 'bidirectional'
      | 'radial'
      | 'compact'
      | 'compact-bidir'
      | 'depth-hybrid'
      | 'treemap-pack'
      | 'quadrant-pack'
      | 'voronoi-pack';
    spacing?: number;
    density?: number;
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
      filePath?: string;
      kind: 'canvas' | 'mindmap';
      scopeId?: string;
      renderedId?: string;
      frameScope?: string;
      framePath?: string[];
    };
    __mindmapEmbedScope?: string;
    __magamScope?: string;
    pluginInstanceId?: string;
    pluginPackage?: string;
    packageName?: string;
    pluginVersion?: string;
    pluginVersionId?: string;
    version?: string;
    pluginExport?: string;
    exportName?: string;
    pluginDisplayName?: string;
    pluginProps?: Record<string, unknown>;
    pluginBindingConfig?: Record<string, unknown>;
    pluginPersistedState?: Record<string, unknown>;
    pluginCapabilities?: string[];
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
  sourceVersions?: Record<string, string>;
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
  sourceVersions?: Record<string, string>;
}

export function parseRenderGraph(data: RenderGraphResponse): ParsedRenderGraph | null {
  if (!data || !data.graph || !data.graph.children) {
    return null;
  }

  const { children } = data.graph;
  const nodes: any[] = [];
  const edges: any[] = [];

  const withEditMeta = (
    nodeType: string,
    nodeId: string,
    nodeData: Record<string, unknown>,
    canonicalInput?: {
      alias: CanonicalObjectAlias;
      legacyProps: Record<string, unknown>;
      legacyChildren?: unknown[];
    },
  ): Record<string, unknown> => {
    const dataWithSource: Record<string, unknown> = {
      ...nodeData,
      sourceMeta: nodeData.sourceMeta || {
        sourceId: nodeId,
        kind: 'canvas',
      },
    };

    const enrichedData: Record<string, unknown> = {
      ...dataWithSource,
      editMeta: deriveEditMeta({
        id: nodeId,
        type: nodeType,
        data: dataWithSource,
      }),
    };

    if (!canonicalInput) {
      return enrichedData;
    }

    const sourceMeta = enrichedData.sourceMeta as ObjectCore['sourceMeta'];
    const relations = {
      ...(canonicalInput.legacyProps.from !== undefined
        ? { from: canonicalInput.legacyProps.from }
        : {}),
      ...(canonicalInput.legacyProps.to !== undefined
        ? { to: canonicalInput.legacyProps.to }
        : {}),
      ...(canonicalInput.legacyProps.anchor !== undefined
        ? { anchor: canonicalInput.legacyProps.anchor }
        : {}),
    };

    const core: ObjectCore = {
      id: nodeId,
      position: {
        ...(typeof canonicalInput.legacyProps.x === 'number'
          ? { x: canonicalInput.legacyProps.x }
          : {}),
        ...(typeof canonicalInput.legacyProps.y === 'number'
          ? { y: canonicalInput.legacyProps.y }
          : {}),
      },
      ...(Object.keys(relations).length > 0 ? { relations } : {}),
      ...(Array.isArray(enrichedData.children)
        ? { children: enrichedData.children }
        : {}),
      sourceMeta,
    };

    const canonicalResult = createCanonicalFromLegacyAliasInput({
      alias: canonicalInput.alias,
      core,
      explicitCapabilities: deriveExplicitCapabilities(
        canonicalInput.alias,
        canonicalInput.legacyProps,
        canonicalInput.legacyChildren,
      ),
      legacyProps: canonicalInput.legacyProps,
      legacyChildren: canonicalInput.legacyChildren,
    });

    if (canonicalResult.ok) {
      return {
        ...enrichedData,
        canonicalObject: canonicalResult.canonical,
      };
    }

    return {
      ...enrichedData,
      canonicalValidation: canonicalResult,
    };
  };

  const readStringProp = (value: unknown): string | undefined => (
    typeof value === 'string' && value.trim().length > 0 ? value : undefined
  );

  const readNumberProp = (value: unknown): number | undefined => (
    typeof value === 'number' && Number.isFinite(value) ? value : undefined
  );

  const readBooleanProp = (value: unknown): boolean | undefined => (
    typeof value === 'boolean' ? value : undefined
  );

  const resolveParsedGroupId = (input: {
    explicitGroupId?: unknown;
    mindmapId?: string | null;
  }): string | undefined => {
    if (typeof input.explicitGroupId === 'string' && input.explicitGroupId.length > 0) {
      return input.explicitGroupId;
    }
    return input.mindmapId ?? undefined;
  };

  const resolveParsedZIndex = (value: unknown): number | undefined => (
    typeof value === 'number' && Number.isFinite(value) ? value : undefined
  );

  const isRecord = (value: unknown): value is Record<string, unknown> => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
  );

  const readRecordProp = (value: unknown): Record<string, unknown> => (
    isRecord(value) ? value : {}
  );

  const readStringArrayProp = (value: unknown): string[] => (
    Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  );

  const normalizePluginCapabilities = (value: unknown): string[] => {
    const allowedCapabilities = new Set([
      'query:objects',
      'object:get',
      'selection:read',
      'instance:update-props',
      'action:emit',
      'resize:request',
    ]);
    return readStringArrayProp(value).filter((capability) => allowedCapabilities.has(capability));
  };

  const toPluginNodeData = (input: {
    child: RenderNode;
    nodeId: string;
    mindmapId?: string;
    groupId?: string;
    zIndex?: number;
  }): Record<string, unknown> => {
    const instanceId = readStringProp(input.child.props.pluginInstanceId) || `${input.nodeId}.instance`;
    const packageName = (
      readStringProp(input.child.props.pluginPackage)
      || readStringProp(input.child.props.packageName)
      || 'local'
    );
    const version = (
      readStringProp(input.child.props.pluginVersionId)
      || readStringProp(input.child.props.pluginVersion)
      || readStringProp(input.child.props.version)
      || '0.0.0'
    );
    const exportName = (
      readStringProp(input.child.props.pluginExport)
      || readStringProp(input.child.props.exportName)
      || 'widget.default'
    );
    const displayName = (
      readStringProp(input.child.props.pluginDisplayName)
      || readStringProp(input.child.props.label)
      || exportName
    );

    const pluginProps = readRecordProp(input.child.props.pluginProps ?? input.child.props.content);
    const pluginBindingConfig = readRecordProp(input.child.props.pluginBindingConfig);
    const pluginPersistedState = readRecordProp(input.child.props.pluginPersistedState);
    const pluginCapabilities = normalizePluginCapabilities(input.child.props.pluginCapabilities);

    return {
      label: displayName,
      groupId: input.groupId ?? input.mindmapId,
      zIndex: input.zIndex,
      sourceMeta: input.child.props.sourceMeta || {
        sourceId: input.nodeId,
        kind: input.mindmapId ? 'mindmap' : 'canvas',
        scopeId: input.mindmapId,
      },
      plugin: {
        instanceId,
        packageName,
        version,
        exportName,
        displayName,
        props: pluginProps,
        bindingConfig: pluginBindingConfig,
        persistedState: pluginPersistedState,
        capabilities: pluginCapabilities,
      },
      pluginRuntime: {
        status: 'loading',
        updatedAt: Date.now(),
      },
    };
  };

  const readMarkdownSourceFromChildren = (children?: unknown[]): string | undefined => {
    for (const child of children || []) {
      if (!isRecord(child) || child.type !== 'graph-markdown') {
        continue;
      }
      const props = isRecord(child.props) ? child.props : undefined;
      const source = readStringProp(props?.content);
      if (source !== undefined) {
        return source;
      }
    }
    return undefined;
  };

  const readTextContentFromChildren = (
    children?: unknown[],
    joiner = '',
  ): string | undefined => {
    const textParts: string[] = [];

    const visit = (items?: unknown[]) => {
      for (const child of items || []) {
        if (!isRecord(child)) {
          continue;
        }

        if (child.type === 'text') {
          const props = isRecord(child.props) ? child.props : undefined;
          const text = readStringProp(props?.text);
          if (text !== undefined) {
            textParts.push(text);
          }
          continue;
        }

        if (child.type === 'graph-text') {
          const nestedChildren = Array.isArray(child.children) ? child.children : undefined;
          visit(nestedChildren);
        }
      }
    };

    visit(children);
    return textParts.length > 0 ? textParts.join(joiner) : undefined;
  };

  const getFrameCapabilityInput = (
    legacyProps: Record<string, unknown>,
  ): Record<string, unknown> | undefined => (
    isRecord(legacyProps.frame) ? legacyProps.frame : undefined
  );

  const getMaterialCapabilityInput = (
    legacyProps: Record<string, unknown>,
  ): Record<string, unknown> | undefined => (
    isRecord(legacyProps.material) ? legacyProps.material : undefined
  );

  const getTextureCapabilityInput = (
    legacyProps: Record<string, unknown>,
  ): Record<string, unknown> | undefined => (
    isRecord(legacyProps.texture) ? legacyProps.texture : undefined
  );

  const getAttachCapabilityInput = (
    legacyProps: Record<string, unknown>,
  ): Record<string, unknown> | undefined => (
    isRecord(legacyProps.attach) ? legacyProps.attach : undefined
  );

  const getBubbleCapabilityInput = (
    legacyProps: Record<string, unknown>,
  ): Record<string, unknown> | undefined => (
    isRecord(legacyProps.bubble) ? legacyProps.bubble : undefined
  );

  const getContentCapabilityInput = (
    legacyProps: Record<string, unknown>,
  ): Record<string, unknown> | undefined => {
    if (!isRecord(legacyProps.content)) {
      return undefined;
    }

    return readStringProp(legacyProps.content.kind) ? legacyProps.content : undefined;
  };

  const resolveRenderablePattern = (
    legacyProps: Record<string, unknown>,
  ): Record<string, unknown> | undefined => {
    const material = getMaterialCapabilityInput(legacyProps);
    if (material) {
      if (isRecord(material.pattern)) {
        return material.pattern;
      }

      const preset = readStringProp(material.preset);
      if (preset !== undefined) {
        return {
          type: 'preset',
          id: preset,
        };
      }
    }

    return isRecord(legacyProps.pattern) ? legacyProps.pattern : undefined;
  };

  const resolveRenderableAt = (
    legacyProps: Record<string, unknown>,
  ): Record<string, unknown> | undefined => {
    if (isRecord(legacyProps.at)) {
      return legacyProps.at;
    }

    const attach = getAttachCapabilityInput(legacyProps);
    if (!attach) {
      return undefined;
    }

    const target = readStringProp(attach.target);
    if (target === undefined) {
      return undefined;
    }

    const placementRaw = readStringProp(attach.position);
    const placement = placementRaw === 'top'
      || placementRaw === 'bottom'
      || placementRaw === 'left'
      || placementRaw === 'right'
      || placementRaw === 'center'
        ? placementRaw
        : 'center';

    return {
      type: 'attach',
      target,
      placement,
      ...(readNumberProp(attach.offset) !== undefined ? { offset: readNumberProp(attach.offset) } : {}),
    };
  };

  const resolveRenderablePorts = (
    legacyProps: Record<string, unknown>,
  ): unknown[] | undefined => {
    if (Array.isArray(legacyProps.ports)) {
      return legacyProps.ports;
    }

    const portsCapability = isRecord(legacyProps.ports)
      ? legacyProps.ports
      : undefined;
    return Array.isArray(portsCapability?.ports) ? portsCapability.ports : undefined;
  };

  const resolveRenderableBubble = (
    legacyProps: Record<string, unknown>,
  ): boolean | undefined => {
    const bubbleCapability = getBubbleCapabilityInput(legacyProps);
    if (bubbleCapability) {
      return readBooleanProp(bubbleCapability.bubble);
    }

    return readBooleanProp(legacyProps.bubble);
  };

  const deriveExplicitCapabilities = (
    alias: CanonicalObjectAlias,
    legacyProps: Record<string, unknown>,
    legacyChildren?: unknown[],
  ): Partial<CapabilityBag> => {
    const explicit: Partial<CapabilityBag> = {};
    const frameCapability = getFrameCapabilityInput(legacyProps);
    const materialCapability = getMaterialCapabilityInput(legacyProps);
    const textureCapability = getTextureCapabilityInput(legacyProps);
    const attachCapability = getAttachCapabilityInput(legacyProps);
    const bubbleCapability = getBubbleCapabilityInput(legacyProps);
    const contentCapability = getContentCapabilityInput(legacyProps);

    const frameShape =
      readStringProp(frameCapability?.shape)
      || readStringProp(legacyProps.shape)
      || readStringProp(legacyProps.type);
    const frameFill = readStringProp(frameCapability?.fill) || readStringProp(legacyProps.fill);
    const frameStroke = readStringProp(frameCapability?.stroke) || readStringProp(legacyProps.stroke);
    const frameStrokeWidth = readNumberProp(frameCapability?.strokeWidth) ?? readNumberProp(legacyProps.strokeWidth);
    if (
      frameShape !== undefined
      || frameFill !== undefined
      || frameStroke !== undefined
      || frameStrokeWidth !== undefined
    ) {
      explicit.frame = {
        ...(frameShape !== undefined ? { shape: frameShape } : {}),
        ...(frameFill !== undefined ? { fill: frameFill } : {}),
        ...(frameStroke !== undefined ? { stroke: frameStroke } : {}),
        ...(frameStrokeWidth !== undefined ? { strokeWidth: frameStrokeWidth } : {}),
      };
    }

    const materialPattern = materialCapability?.pattern ?? legacyProps.pattern;
    const materialPreset = readStringProp(materialCapability?.preset);
    if (materialPattern !== undefined || materialPreset !== undefined) {
      explicit.material = {
        ...(materialPreset !== undefined ? { preset: materialPreset } : {}),
        ...(materialPattern !== undefined ? { pattern: materialPattern } : {}),
      };
    }

    if (textureCapability !== undefined) {
      const hasCanonicalTextureShape =
        'texture' in textureCapability
        || 'noiseOpacity' in textureCapability
        || 'glossOpacity' in textureCapability
        || 'gradientIntensity' in textureCapability
        || 'insetShadowOpacity' in textureCapability
        || 'shadowWarmth' in textureCapability;
      explicit.texture = hasCanonicalTextureShape
        ? textureCapability
        : { texture: textureCapability };
    }

    const at = isRecord(legacyProps.at) ? legacyProps.at : undefined;
    const attachTarget = readStringProp(attachCapability?.target) || readStringProp(at?.target) || readStringProp(legacyProps.anchor);
    const attachPosition = readStringProp(attachCapability?.position) || readStringProp(at?.position) || readStringProp(legacyProps.position);
    const attachOffset = readNumberProp(attachCapability?.offset) ?? readNumberProp(at?.offset) ?? readNumberProp(legacyProps.gap) ?? readNumberProp(legacyProps.offset);
    if (attachTarget !== undefined || attachPosition !== undefined || attachOffset !== undefined) {
      explicit.attach = {
        ...(attachTarget !== undefined ? { target: attachTarget } : {}),
        ...(attachPosition !== undefined ? { position: attachPosition } : {}),
        ...(attachOffset !== undefined ? { offset: attachOffset } : {}),
      };
    }

    const bubble = readBooleanProp(bubbleCapability?.bubble) ?? readBooleanProp(legacyProps.bubble);
    if (bubble !== undefined) {
      explicit.bubble = { bubble };
    }

    const portsCapability = isRecord(legacyProps.ports) ? legacyProps.ports : undefined;
    if (Array.isArray(portsCapability?.ports)) {
      explicit.ports = { ports: portsCapability.ports };
    } else if (Array.isArray(legacyProps.ports)) {
      explicit.ports = { ports: legacyProps.ports };
    }

    const textContent =
      readStringProp(legacyProps.text)
      || readStringProp(legacyProps.label)
      || readStringProp(legacyProps.value)
      || readTextContentFromChildren(
        legacyChildren,
        alias === 'Node' ? '\n' : alias === 'Sticker' ? ' ' : '',
      );
    const markdownSource =
      readStringProp(legacyProps.content)
      || readStringProp(legacyProps.source)
      || readMarkdownSourceFromChildren(legacyChildren);
    const mediaSrc = readStringProp(legacyProps.src);

    if (contentCapability) {
      explicit.content = contentCapability as unknown as CapabilityBag['content'];
      return explicit;
    }

    if (alias === 'Node' || alias === 'Shape' || alias === 'Sticky' || alias === 'Sticker') {
      if (alias === 'Node' && markdownSource !== undefined) {
        explicit.content = { kind: 'markdown', source: markdownSource };
      } else if (textContent !== undefined) {
        explicit.content = {
          kind: 'text',
          value: textContent,
          ...(legacyProps.fontSize !== undefined ? { fontSize: legacyProps.fontSize as number | string } : {}),
        };
      }
    }

    if (alias === 'Markdown' && markdownSource !== undefined) {
      explicit.content = {
        kind: 'markdown',
        source: markdownSource,
        ...(legacyProps.size !== undefined ? { size: legacyProps.size } : {}),
      };
    }

    if (alias === 'Image' && mediaSrc !== undefined) {
      explicit.content = {
        kind: 'media',
        src: mediaSrc,
        ...(readStringProp(legacyProps.alt) !== undefined ? { alt: readStringProp(legacyProps.alt) } : {}),
        ...(readStringProp(legacyProps.fit) !== undefined ? { fit: readStringProp(legacyProps.fit) as any } : {}),
        ...(readNumberProp(legacyProps.width) !== undefined ? { width: readNumberProp(legacyProps.width) } : {}),
        ...(readNumberProp(legacyProps.height) !== undefined ? { height: readNumberProp(legacyProps.height) } : {}),
      };
    }

    if (alias === 'Sequence') {
      const participants = Array.isArray(legacyProps.participants) ? legacyProps.participants : undefined;
      const messages = Array.isArray(legacyProps.messages) ? legacyProps.messages : undefined;
      if (participants !== undefined || messages !== undefined) {
        explicit.content = {
          kind: 'sequence',
          participants: participants ?? [],
          messages: messages ?? [],
        };
      }
    }

    return explicit;
  };

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
  const warnUnsupportedLegacySizeApi = (component: string, inputPath: string): void => {
    emitSizeWarning({
      code: 'UNSUPPORTED_LEGACY_SIZE_API',
      component,
      inputPath,
      fallbackApplied: 'ignored legacy input',
    });
  };

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
    if (child.props.from === undefined) {
      return;
    }
    edges.push(buildMindMapEdge({
      nodeId: params.nodeId,
      mindmapId: params.mindmapId,
      edgeId: `edge-${params.mindmapId}-${params.nodeId}-${edgeIdCounter++}`,
      from: child.props.from,
      localScope: child.props.__mindmapEmbedScope,
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
          child.props.__mindmapEmbedScope,
        );
        const targetMeta = parseEdgeEndpoint(
          child.props.to,
          mindmapId,
          child.props.__mindmapEmbedScope,
        );
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
            | 'depth-hybrid'
            | 'treemap-pack'
            | 'quadrant-pack'
            | 'voronoi-pack') ||
          'compact';
        const baseX = child.props.x ?? 0;
        const baseY = child.props.y ?? 0;

        mindMapGroups.push({
          id: mmId,
          layoutType,
          basePosition: { x: baseX, y: baseY },
          spacing: child.props.spacing ?? DEFAULT_MINDMAP_SPACING,
          density: child.props.density,
          anchor: child.props.anchor,
          anchorPosition: child.props.position,
          anchorGap: child.props.gap,
        });

        if (child.children && child.children.length > 0) {
          processChildren(child.children, mmId);
        }
      } else if (child.type === 'graph-plugin' || child.type === 'graph-widget') {
        const rawPluginId = child.props.id || `plugin-${nodeIdCounter++}`;
        const pluginNodeId = resolveNodeId(
          rawPluginId,
          mindmapId,
          child.props.__mindmapEmbedScope,
        );
        const parsedGroupId = resolveParsedGroupId({
          explicitGroupId: child.props.groupId,
          mindmapId,
        });
        const parsedZIndex = resolveParsedZIndex(child.props.zIndex);
        nodes.push({
          id: pluginNodeId,
          type: 'plugin',
          position: { x: child.props.x || 0, y: child.props.y || 0 },
          zIndex: parsedZIndex,
          data: withEditMeta('plugin', pluginNodeId, toPluginNodeData({
            child,
            nodeId: pluginNodeId,
            mindmapId,
            groupId: parsedGroupId,
            zIndex: parsedZIndex,
          })),
        });

        if (mindmapId) {
          createMindMapEdge(child, { nodeId: pluginNodeId, mindmapId });
        }
      } else if (child.type === 'graph-sequence') {
        if (child.props.size !== undefined) {
          warnUnsupportedLegacySizeApi('SequenceDiagramNode', 'size');
        }
        const rawSequenceId =
          child.props.id || `sequence-${sequenceIdCounter++}`;
        const seqId = resolveNodeId(
          rawSequenceId,
          mindmapId,
          child.props.__mindmapEmbedScope,
        );
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

        const sequenceRendererChildren = child.children || [];
        const parsedGroupId = resolveParsedGroupId({
          explicitGroupId: child.props.groupId,
          mindmapId,
        });
        const parsedZIndex = resolveParsedZIndex(child.props.zIndex);
        nodes.push({
          id: seqId,
          type: 'sequence-diagram',
          position: { x: child.props.x || 0, y: child.props.y || 0 },
          zIndex: parsedZIndex,
          data: withEditMeta('sequence-diagram', seqId, {
            participants,
            messages,
            participantSpacing: child.props.participantSpacing ?? 200,
            messageSpacing: child.props.messageSpacing ?? 60,
            locked: child.props.locked,
            fontFamily: sequenceFontFamily,
            groupId: parsedGroupId,
            zIndex: parsedZIndex,
            anchor: child.props.anchor,
            position: child.props.position,
            gap: child.props.gap,
            sourceMeta: child.props.sourceMeta || {
              sourceId: seqId,
              kind: mindmapId ? 'mindmap' : 'canvas',
              scopeId: mindmapId,
            },
          }, {
            alias: 'Sequence',
            legacyProps: child.props,
            legacyChildren: sequenceRendererChildren,
          }),
        });

        if (mindmapId) {
          createMindMapEdge(child, { nodeId: seqId, mindmapId });
        }
      } else if (child.type === 'graph-node') {
        const rawNodeId = child.props.id || `node-${nodeIdCounter++}`;
        const nodeId = resolveNodeId(
          rawNodeId,
          mindmapId,
          child.props.__mindmapEmbedScope,
        );

        const rendererChildren = child.children || [];
        const { label: baseLabel, parsedChildren } = extractNodeContent(
          rendererChildren as RenderChildNode[],
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
        const markdownChild = rendererChildren.find(
          (rendererChild: RenderNode) => rendererChild.type === 'graph-markdown',
        );
        const markdownSize = markdownChild?.props?.size as
          | MarkdownSizeInput
          | undefined;
        const resolvedMarkdownSize =
          markdownChild && markdownSize === undefined
            ? { token: 'auto' as const }
            : markdownSize;

        const hasMarkdown = rendererChildren.some(
          (c: RenderNode) =>
            c.type === 'graph-markdown' || c.type === 'graph-image',
        );

        const nodeBubble = child.props.bubble || childBubble;
        const nodeFontFamily = normalizeFontFamily(child.props.fontFamily);
        const parsedGroupId = resolveParsedGroupId({
          explicitGroupId: child.props.groupId,
          mindmapId,
        });
        const parsedZIndex = resolveParsedZIndex(child.props.zIndex);

        nodes.push({
          id: nodeId,
          type: hasMarkdown ? 'markdown' : 'shape',
          position: { x: child.props.x || 0, y: child.props.y || 0 },
          zIndex: parsedZIndex,
          data: withEditMeta(hasMarkdown ? 'markdown' : 'shape', nodeId, {
            label: safeLabel,
            type: child.props.type || 'rectangle',
            color: child.props.color || child.props.bg,
            locked: child.props.locked,
            groupId: parsedGroupId,
            zIndex: parsedZIndex,
            sourceMeta: child.props.sourceMeta || {
              sourceId: nodeId,
              kind: mindmapId ? 'mindmap' : 'canvas',
              scopeId: mindmapId,
            },
            fontSize: child.props.fontSize,
            labelColor: child.props.labelColor || child.props.color,
            labelFontSize:
              child.props.labelFontSize
              || (typeof child.props.fontSize === 'number'
                ? child.props.fontSize
                : undefined),
            labelBold: child.props.labelBold || child.props.bold,
            fill: child.props.fill,
            stroke: child.props.stroke,
            fontFamily: nodeFontFamily,
            children: parsedChildren,
            bubble: nodeBubble,
            size: resolvedMarkdownSize,
          }, {
            alias: 'Node',
            legacyProps: child.props,
            legacyChildren: rendererChildren,
          }),
        });

        if (mindmapId) {
          createMindMapEdge(child, { nodeId, mindmapId });
        }
      } else if (child.type === 'graph-image') {
        const rawImageId = child.props.id || `image-${imageIdCounter++}`;
        const imageId = resolveNodeId(
          rawImageId,
          mindmapId,
          child.props.__mindmapEmbedScope,
        );
        const parsedGroupId = resolveParsedGroupId({
          explicitGroupId: child.props.groupId,
          mindmapId,
        });
        const parsedZIndex = resolveParsedZIndex(child.props.zIndex);
        nodes.push({
          id: imageId,
          type: 'image',
          position: { x: child.props.x || 0, y: child.props.y || 0 },
          zIndex: parsedZIndex,
          data: withEditMeta('image', imageId, {
            src: child.props.src || '',
            alt: child.props.alt,
            width: child.props.width,
            height: child.props.height,
            fit: child.props.fit,
            locked: child.props.locked,
            groupId: parsedGroupId,
            zIndex: parsedZIndex,
            sourceMeta: child.props.sourceMeta || {
              sourceId: imageId,
              kind: mindmapId ? 'mindmap' : 'canvas',
              scopeId: mindmapId,
            },
          }, {
            alias: 'Image',
            legacyProps: child.props,
            legacyChildren: child.children,
          }),
        });

        if (mindmapId) {
          createMindMapEdge(child, { nodeId: imageId, mindmapId });
        }
      } else if (child.type === 'graph-sticker') {
        if (child.props.size !== undefined) {
          warnUnsupportedLegacySizeApi('StickerNode', 'size');
        }
        const rawStickerId = child.props.id || `sticker-${nodeIdCounter++}`;
        const stickerId = resolveNodeId(
          rawStickerId,
          mindmapId,
          child.props.__mindmapEmbedScope,
        );
        const stickerFontFamily = normalizeFontFamily(child.props.fontFamily);
        const stickerRendererChildren = child.children || [];
        const { label: stickerLabel, parsedChildren: stickerChildren } = extractStickerContent(
          stickerRendererChildren as RenderChildNode[],
          child.props.children,
          { textJoiner: ' ' },
        );
        const normalized = normalizeStickerData(child.props);
        const parsedGroupId = resolveParsedGroupId({
          explicitGroupId: child.props.groupId,
          mindmapId,
        });
        const parsedZIndex = resolveParsedZIndex(child.props.zIndex);

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
          zIndex: parsedZIndex,
          data: withEditMeta('sticker', stickerId, {
            label: stickerLabel || child.props.label || '',
            width: child.props.width,
            height: child.props.height,
            rotation: child.props.rotation,
            fontFamily: stickerFontFamily,
            locked: child.props.locked,
            groupId: parsedGroupId,
            zIndex: parsedZIndex,
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
          }, {
            alias: 'Sticker',
            legacyProps: child.props,
            legacyChildren: stickerRendererChildren,
          }),
        });

        if (mindmapId) {
          createMindMapEdge(child, { nodeId: stickerId, mindmapId });
        }
      } else if (child.type === 'graph-washi-tape') {
        const rawWashiId = child.props.id || `washi-${nodeIdCounter++}`;
        const washiId = resolveNodeId(
          rawWashiId,
          mindmapId,
          child.props.__mindmapEmbedScope,
        );
        const washiRendererChildren = child.children || [];
        const { label: washiLabel, parsedChildren: washiChildren } = extractStickerContent(
          washiRendererChildren as RenderChildNode[],
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
        const parsedGroupId = resolveParsedGroupId({
          explicitGroupId: child.props.groupId,
          mindmapId,
        });
        const parsedZIndex = resolveParsedZIndex(child.props.zIndex);

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
          zIndex: parsedZIndex,
          data: withEditMeta('washi-tape', washiId, {
            label: washiLabel || child.props.label || '',
            locked: child.props.locked,
            pattern: child.props.pattern ?? normalizedWashi.pattern,
            edge: child.props.edge,
            texture: child.props.texture,
            text: child.props.text,
            at: normalizedWashi.at,
            resolvedGeometry,
            seed: normalizedWashi.seed,
            opacity: normalizedWashi.opacity,
            groupId: parsedGroupId,
            zIndex: parsedZIndex,
            children: washiChildren,
            sourceMeta: child.props.sourceMeta || {
              sourceId: washiId,
              kind: mindmapId ? 'mindmap' : 'canvas',
              scopeId: mindmapId,
            },
          }),
        });

        if (mindmapId) {
          createMindMapEdge(child, { nodeId: washiId, mindmapId });
        }
      } else {
        const rawNodeId = child.props.id || `node-${nodeIdCounter++}`;
        const nodeId = resolveNodeId(
          rawNodeId,
          mindmapId,
          child.props.__mindmapEmbedScope,
        );
        const parsedGroupId = resolveParsedGroupId({
          explicitGroupId: child.props.groupId,
          mindmapId,
        });
        const parsedZIndex = resolveParsedZIndex(child.props.zIndex);
        const hasPluginReference = (
          child.props.pluginInstanceId !== undefined
          || child.props.pluginPackage !== undefined
          || child.props.packageName !== undefined
          || child.props.pluginExport !== undefined
          || child.props.exportName !== undefined
        );
        if (hasPluginReference) {
          nodes.push({
            id: nodeId,
            type: 'plugin',
            position: {
              x: typeof child.props.x === 'number' ? child.props.x : 0,
              y: typeof child.props.y === 'number' ? child.props.y : 0,
            },
            zIndex: parsedZIndex,
            data: withEditMeta('plugin', nodeId, toPluginNodeData({
              child,
              nodeId,
              mindmapId,
              groupId: parsedGroupId,
              zIndex: parsedZIndex,
            })),
          });

          if (mindmapId) {
            createMindMapEdge(child, { nodeId, mindmapId });
          }
          return;
        }
        const nodeFontFamily = normalizeFontFamily(child.props.fontFamily);

        const nestedEdges: RenderNode[] = [];
        const ports: any[] = [];

        const rendererChildren = child.children || [];
        const {
          label: parsedLabel,
          parsedChildren,
        } = extractNodeContent(rendererChildren as RenderChildNode[], child.props.children);

        rendererChildren.forEach((grandChild: RenderNode) => {
          if (grandChild.type === 'graph-edge') {
            nestedEdges.push(grandChild);
          } else if (grandChild.type === 'graph-port') {
            ports.push(grandChild.props);
          }
        });

        nestedEdges.forEach(
          (edgeChild: RenderNode, edgeIndex: number) => {
            const rawTargetId = edgeChild.props.to;
            if (!rawTargetId) {
              return;
            }
            const sourceId = resolveNodeId(
              fromToEndpointValue(edgeChild.props.from) || nodeId,
              mindmapId,
              child.props.__mindmapEmbedScope,
            );
            const targetId = resolveNodeId(
              rawTargetId,
              mindmapId,
              child.props.__mindmapEmbedScope,
            );
            const edgeFontFamily = normalizeFontFamily(edgeChild.props.fontFamily);

            edges.push({
              id:
                edgeChild.props.id ||
                `nested-edge-${nodeId}-${edgeIndex}`,
              source: sourceId,
              target: targetId,
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
        const isObjectSizedNode = nodeType === 'sticky' || nodeType === 'shape';
        if (
          isObjectSizedNode
          && (child.props.width !== undefined || child.props.height !== undefined)
        ) {
          if (child.props.width !== undefined) {
            warnUnsupportedLegacySizeApi(
              nodeType === 'sticky' ? 'StickyNode' : 'ShapeNode',
              'width',
            );
          }
          if (child.props.height !== undefined) {
            warnUnsupportedLegacySizeApi(
              nodeType === 'sticky' ? 'StickyNode' : 'ShapeNode',
              'height',
            );
          }
        }
        const objectSizeInput = isObjectSizedNode
          ? (child.props.size as ObjectSizeInput | undefined)
          : undefined;

        const normalizedSticky = nodeType === 'sticky'
          ? normalizeStickyDefaults({
            ...child.props,
            id: nodeId,
          })
          : null;
        const stickyAtInput = normalizedSticky?.at;
        const renderFrame = getFrameCapabilityInput(child.props);
        const renderPattern = resolveRenderablePattern(child.props);
        const renderAt = resolveRenderableAt(child.props);
        const renderPorts = resolveRenderablePorts(child.props);
        const renderBubble = resolveRenderableBubble(child.props);

        const canonicalAlias: CanonicalObjectAlias =
          child.type === 'graph-sticky'
            ? 'Sticky'
            : child.type === 'graph-text'
              ? 'Node'
              : 'Shape';

        nodes.push({
          id: nodeId,
          type: nodeType,
          position: {
            x: typeof child.props.x === 'number' ? child.props.x : 0,
            y: typeof child.props.y === 'number' ? child.props.y : 0,
          },
          zIndex: parsedZIndex,
          data: withEditMeta(nodeType, nodeId, {
            label: safeLabel,
            type: readStringProp(renderFrame?.shape) || child.props.type || 'rectangle',
            locked: child.props.locked,
            shape: nodeType === 'sticky'
              ? normalizedSticky?.shape ?? readStringProp(renderFrame?.shape)
              : undefined,
            color: child.props.color || child.props.bg,
            groupId: parsedGroupId,
            zIndex: parsedZIndex,
            pattern:
              nodeType === 'sticky'
                ? renderPattern ?? normalizedSticky?.pattern
                : renderPattern,
            at:
              nodeType === 'sticky'
                ? renderAt ?? stickyAtInput
                : renderAt,
            fontSize: child.props.fontSize,
            labelColor: child.props.labelColor || child.props.color,
            labelFontSize:
              child.props.labelFontSize
              || (typeof child.props.fontSize === 'number'
                ? child.props.fontSize
                : undefined),
            labelBold: child.props.labelBold || child.props.bold,
            fill: readStringProp(renderFrame?.fill) || child.props.fill,
            stroke: readStringProp(renderFrame?.stroke) || child.props.stroke,
            strokeWidth: readNumberProp(renderFrame?.strokeWidth) ?? child.props.strokeWidth,
            lineDirection:
              child.props.lineDirection === 'up'
                ? 'up'
                : child.props.lineDirection === 'down'
                  ? 'down'
                  : undefined,
            fontFamily: nodeFontFamily,
            children: parsedChildren,
            size: objectSizeInput,
            imageSrc: child.props.imageSrc,
            imageFit: child.props.imageFit,
            texture: child.props.texture,
            ports: renderPorts ?? ports,
            anchor: child.props.anchor,
            position: child.props.position,
            gap: child.props.gap,
            align: child.props.align,
            width: isObjectSizedNode ? undefined : child.props.width,
            height: isObjectSizedNode ? undefined : child.props.height,
            bubble: renderBubble,
            sourceMeta: child.props.sourceMeta || {
              sourceId: nodeId,
              kind: mindmapId ? 'mindmap' : 'canvas',
              scopeId: mindmapId,
            },
          }, {
            alias: canonicalAlias,
            legacyProps: child.props,
            legacyChildren: rendererChildren,
          }),
        });

        if (mindmapId) {
          createMindMapEdge(child, { nodeId, mindmapId });
        }
      }
    });
  };

  processChildren(children);

  const finalizedNodes = nodes.map((node) => {
    const baseNode = ((node.data || {}) as Record<string, unknown>).locked === true
      ? {
          ...node,
          draggable: false,
        }
      : node;

    if (baseNode.type !== 'washi-tape') {
      return baseNode;
    }

    const data = (baseNode.data || {}) as Record<string, unknown>;
    const normalizedWashi = normalizeWashiDefaults({
      ...data,
      id: baseNode.id,
      x: baseNode.position.x,
      y: baseNode.position.y,
    });
    const atInput = (data.at as Record<string, unknown> | undefined) ?? normalizedWashi.at;
    const resolvedGeometry = resolveWashiGeometry({
      at: atInput as any,
      nodes,
      seed: (data.seed as string | number | undefined) ?? normalizedWashi.seed,
      fallbackPosition: baseNode.position,
    });
    const isAttach = (atInput as { type?: unknown }).type === 'attach';
    const attachedPosition = getWashiNodePosition(resolvedGeometry);

    return {
      ...baseNode,
      position: isAttach ? attachedPosition : baseNode.position,
      data: {
        ...(baseNode.data || {}),
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
    sourceVersions: data.sourceVersions,
  };
}
