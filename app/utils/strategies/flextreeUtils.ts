import type { Edge, Node } from 'reactflow';
import { getNodeDimensions } from '../layoutUtils';
import { runCompactLayout } from './compactPlacement';
import type { LayoutDirection, LayoutPoint } from './types';

export interface HierarchyDatum {
    id: string;
    width: number;
    height: number;
    children?: HierarchyDatum[];
}

export function buildHierarchy(nodes: Node[], edges: Edge[], rootId?: string): HierarchyDatum | null {
    const childrenMap = new Map<string, string[]>();
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const validEdges = edges.filter((edge) => nodeMap.has(edge.source) && nodeMap.has(edge.target));
    const incomingCount = new Map<string, number>();

    nodes.forEach((node) => {
        childrenMap.set(node.id, []);
        incomingCount.set(node.id, 0);
    });

    validEdges.forEach((edge) => {
        childrenMap.get(edge.source)?.push(edge.target);
        incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1);
    });

    const resolvedRootId = rootId ?? nodes.find((node) => (incomingCount.get(node.id) ?? 0) === 0)?.id;
    if (!resolvedRootId) {
        return null;
    }

    function buildNode(id: string): HierarchyDatum {
        const node = nodeMap.get(id)!;
        const { width, height } = getNodeDimensions(node);
        const childIds = childrenMap.get(id) || [];
        return {
            id,
            width,
            height,
            children: childIds.length > 0 ? childIds.map(buildNode) : undefined,
        };
    }

    return buildNode(resolvedRootId);
}

export function buildForest(nodes: Node[], edges: Edge[]): HierarchyDatum[] {
    if (nodes.length === 0) {
        return [];
    }

    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const incomingCount = new Map<string, number>(nodes.map((node) => [node.id, 0]));

    edges
        .filter((edge) => nodeMap.has(edge.source) && nodeMap.has(edge.target))
        .forEach((edge) => {
            incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1);
        });

    const roots = nodes
        .filter((node) => (incomingCount.get(node.id) ?? 0) === 0)
        .map((node) => node.id);

    const rootIds = roots.length > 0 ? roots : [nodes[0].id];
    const built = new Map<string, HierarchyDatum>();

    rootIds.forEach((candidateRootId) => {
        const hierarchy = buildHierarchy(nodes, edges, candidateRootId);
        if (hierarchy) {
            built.set(candidateRootId, hierarchy);
        }
    });

    nodes.forEach((node) => {
        if (built.has(node.id)) {
            return;
        }
        const hierarchy = buildHierarchy(nodes, edges, node.id);
        if (hierarchy) {
            built.set(node.id, hierarchy);
        }
    });

    return Array.from(built.values());
}

export function runFlextreeLayout(
    nodes: Node[],
    edges: Edge[],
    spacing: number,
    direction: LayoutDirection = 'right',
): Map<string, LayoutPoint> {
    return runCompactLayout(nodes, edges, spacing, direction);
}
