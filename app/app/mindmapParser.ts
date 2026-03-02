export type FromEdgeLabel =
  | string
  | {
      text?: string;
      color?: string;
      bg?: string;
      fontSize?: number;
    };

export type FromEdgeStyle = {
  label?: FromEdgeLabel;
  stroke?: string;
  strokeWidth?: number;
  pattern?: string;
  className?: string;
  type?: string;
};

export type FromProp =
  | string
  | {
      node: string;
      edge?: FromEdgeStyle;
    };

export type ParsedFrom = {
  node: string;
  edge: FromEdgeStyle;
};

export type MindMapTopologyErrorCode = 'MISSING_FROM' | 'NESTED_MINDMAP';

export type MindMapTopologyError = Error & {
  code: MindMapTopologyErrorCode;
  mindmapId: string;
  nodeId?: string;
};

export function createMindMapTopologyError(params: {
  code: MindMapTopologyErrorCode;
  mindmapId: string;
  nodeId?: string;
  message: string;
}): MindMapTopologyError {
  const error = new Error(params.message) as MindMapTopologyError;
  error.code = params.code;
  error.mindmapId = params.mindmapId;
  error.nodeId = params.nodeId;
  return error;
}

export function isMindMapTopologyError(error: unknown): error is MindMapTopologyError {
  if (!(error instanceof Error)) return false;
  const candidate = error as Partial<MindMapTopologyError>;
  return (
    (candidate.code === 'MISSING_FROM' || candidate.code === 'NESTED_MINDMAP')
    && typeof candidate.mindmapId === 'string'
  );
}

export function resolveNodeId(id: string, currentMindmapId?: string): string {
  if (!id) return id;
  if (id.includes('.')) return id;
  if (currentMindmapId) return `${currentMindmapId}.${id}`;
  return id;
}

export function parseEdgeEndpoint(
  value: string | undefined,
  currentMindmapId: string | undefined,
): { id: string | undefined; handle: string | undefined } {
  if (!value) {
    return { id: undefined, handle: undefined };
  }

  const colonIndex = value.lastIndexOf(':');
  if (colonIndex > 0) {
    const id = value.substring(0, colonIndex);
    const handle = value.substring(colonIndex + 1);
    return { id: resolveNodeId(id, currentMindmapId), handle };
  }

  return {
    id: resolveNodeId(value, currentMindmapId),
    handle: undefined,
  };
}

export function parseFromProp(
  from: FromProp | undefined,
  params: { mindmapId: string; nodeId: string },
): ParsedFrom {
  if (!from) {
    throw createMindMapTopologyError({
      code: 'MISSING_FROM',
      mindmapId: params.mindmapId,
      nodeId: params.nodeId,
      message: `[MindMap:${params.mindmapId}] node "${params.nodeId}" is missing required from prop.`,
    });
  }

  if (typeof from === 'string') {
    const trimmed = from.trim();
    if (trimmed.length === 0) {
      throw createMindMapTopologyError({
        code: 'MISSING_FROM',
        mindmapId: params.mindmapId,
        nodeId: params.nodeId,
        message: `[MindMap:${params.mindmapId}] node "${params.nodeId}" has an empty from prop.`,
      });
    }
    return { node: trimmed, edge: {} };
  }

  const rawNode = from.node;
  if (typeof rawNode !== 'string' || rawNode.trim().length === 0) {
    throw createMindMapTopologyError({
      code: 'MISSING_FROM',
      mindmapId: params.mindmapId,
      nodeId: params.nodeId,
      message: `[MindMap:${params.mindmapId}] node "${params.nodeId}" has an invalid from prop.`,
    });
  }

  return {
    node: rawNode.trim(),
    edge: from.edge || {},
  };
}

export function assertMindMapTopology(params: {
  mindmapId?: string;
  childType: string;
  childId?: string;
  from?: FromProp;
}) {
  if (!params.mindmapId) {
    return;
  }
  if (params.childType === 'graph-edge') {
    return;
  }
  if (params.childType === 'graph-mindmap') {
    throw createMindMapTopologyError({
      code: 'NESTED_MINDMAP',
      mindmapId: params.mindmapId,
      nodeId: params.childId,
      message: `[MindMap:${params.mindmapId}] nested MindMap is not supported.`,
    });
  }
  parseFromProp(params.from, {
    mindmapId: params.mindmapId,
    nodeId: params.childId || 'unknown',
  });
}

export function getPatternStrokeStyle(pattern?: string) {
  if (!pattern) return {};
  if (pattern === 'dashed') return { strokeDasharray: '5 5' };
  if (pattern === 'dotted') return { strokeDasharray: '2 2' };
  return {};
}

export function fromToEndpointValue(from: FromProp | undefined): string | undefined {
  return typeof from === 'string' ? from : from?.node;
}

function getEdgeLabelText(edgeLabel: FromEdgeLabel | undefined, legacyLabel?: string) {
  if (typeof edgeLabel === 'string') return edgeLabel;
  if (edgeLabel?.text) return edgeLabel.text;
  return legacyLabel;
}

function getEdgeLabelStyle(edgeLabel?: FromEdgeLabel) {
  if (!edgeLabel || typeof edgeLabel === 'string') return {};
  return {
    ...(edgeLabel.color ? { fill: edgeLabel.color } : {}),
    ...(edgeLabel.fontSize ? { fontSize: edgeLabel.fontSize } : {}),
    fontWeight: 700,
  };
}

function getEdgeLabelBgStyle(edgeLabel?: FromEdgeLabel) {
  if (!edgeLabel || typeof edgeLabel === 'string' || !edgeLabel.bg) {
    return undefined;
  }
  return { fill: edgeLabel.bg };
}

export function buildMindMapEdge(params: {
  nodeId: string;
  mindmapId: string;
  edgeId: string;
  from: FromProp | undefined;
  edgeLabel?: string;
  edgeClassName?: string;
  getEdgeType: (type?: string) => string;
  getStrokeStyle: (className?: string) => Record<string, unknown>;
}): {
  id: string;
  source: string | undefined;
  sourceHandle?: string;
  target: string;
  label?: string;
  style: Record<string, unknown>;
  labelStyle: Record<string, unknown>;
  labelBgStyle?: Record<string, unknown>;
  animated: false;
  type: string;
} {
  const parsedFrom = parseFromProp(params.from, {
    mindmapId: params.mindmapId,
    nodeId: params.nodeId,
  });
  const sourceMeta = parseEdgeEndpoint(parsedFrom.node, params.mindmapId);

  const fromEdge = parsedFrom.edge;
  const styleClassName = typeof fromEdge.className === 'string'
    ? fromEdge.className
    : params.edgeClassName;
  const hasHandles = sourceMeta.handle;
  const edgeType = hasHandles ? params.getEdgeType(fromEdge.type) : 'floating';
  const fromLabel = fromEdge.label;

  return {
    id: params.edgeId,
    source: sourceMeta.id,
    ...(sourceMeta.handle ? { sourceHandle: sourceMeta.handle } : {}),
    target: params.nodeId,
    label: getEdgeLabelText(fromLabel, params.edgeLabel),
    style: {
      stroke: fromEdge.stroke || '#94a3b8',
      strokeWidth: fromEdge.strokeWidth || 2,
      ...params.getStrokeStyle(styleClassName),
      ...getPatternStrokeStyle(fromEdge.pattern),
    },
    labelStyle: getEdgeLabelStyle(fromLabel),
    labelBgStyle: getEdgeLabelBgStyle(fromLabel),
    animated: false,
    type: edgeType,
  };
}
