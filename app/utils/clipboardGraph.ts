import { v4 as uuidv4 } from 'uuid';
import type { Edge, Node } from 'reactflow';

export interface GraphClipboardPayload {
  nodes: Node[];
  edges: Edge[];
}

export interface GraphSnapshot {
  nodes: Node[];
  edges: Edge[];
  selectedNodeIds: string[];
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createGraphClipboardPayload(
  nodes: Node[],
  edges: Edge[],
  selectedNodeIds: string[],
): GraphClipboardPayload {
  if (selectedNodeIds.length === 0) {
    return {
      nodes: deepClone(nodes),
      edges: deepClone(edges),
    };
  }

  const selectedNodeIdSet = new Set(selectedNodeIds);
  return {
    nodes: nodes
      .filter((node) => selectedNodeIdSet.has(node.id))
      .map((node) => deepClone(node)),
    edges: edges
      .filter((edge) => selectedNodeIdSet.has(edge.source) && selectedNodeIdSet.has(edge.target))
      .map((edge) => deepClone(edge)),
  };
}

export function serializeNodeIdsForClipboard(payload: GraphClipboardPayload): string {
  return payload.nodes.map((node) => node.id).join('\n');
}

export function isGraphClipboardPayload(value: unknown): value is GraphClipboardPayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Record<string, unknown>;
  return Array.isArray(payload.nodes) && Array.isArray(payload.edges);
}

export function snapshotGraphState(nodes: Node[], edges: Edge[]): GraphSnapshot {
  return {
    nodes: deepClone(nodes),
    edges: deepClone(edges),
    selectedNodeIds: nodes.filter((node) => node.selected).map((node) => node.id),
  };
}

export function applyGraphSnapshot(snapshot: GraphSnapshot): {
  nodes: Node[];
  edges: Edge[];
  selectedNodeIds: string[];
} {
  return {
    nodes: deepClone(snapshot.nodes),
    edges: deepClone(snapshot.edges),
    selectedNodeIds: [...snapshot.selectedNodeIds],
  };
}

export function createPastedGraphState(
  payload: GraphClipboardPayload,
  baseNodes: Node[],
  baseEdges: Edge[],
  offset = 32,
): { nodes: Node[]; edges: Edge[]; selectedNodeIds: string[] } {
  const nodeIdMap = new Map<string, string>();

  const pastedNodes = payload.nodes.map((node) => {
    const nextId = uuidv4();
    nodeIdMap.set(node.id, nextId);

    return {
      ...deepClone(node),
      id: nextId,
      selected: true,
      position: {
        x: (node.position?.x ?? 0) + offset,
        y: (node.position?.y ?? 0) + offset,
      },
    } satisfies Node;
  });

  const pastedEdges: Edge[] = payload.edges.flatMap((edge) => {
    const source = nodeIdMap.get(edge.source);
    const target = nodeIdMap.get(edge.target);
    if (!source || !target) return [];

    return [{
      ...deepClone(edge),
      id: uuidv4(),
      source,
      target,
      selected: false,
    }];
  });

  const deSelectedBaseNodes = baseNodes.map((node) => ({ ...node, selected: false }));

  return {
    nodes: [...deSelectedBaseNodes, ...pastedNodes],
    edges: [...baseEdges, ...pastedEdges],
    selectedNodeIds: pastedNodes.map((node) => node.id),
  };
}
