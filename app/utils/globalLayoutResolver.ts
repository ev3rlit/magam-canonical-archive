import { Node } from 'reactflow';
// @ts-ignore
import ELK from 'elkjs/lib/elk.bundled';
import { ElkNode, ElkExtendedEdge } from 'elkjs/lib/elk-api';
import type { MindMapGroup } from '@/store/graph';
import { calculateGroupBoundingBox } from './layoutUtils';
import { DEFAULT_LAYOUT_OPTIONS } from './elkUtils';

export type AnchorPosition =
    | 'top' | 'bottom' | 'left' | 'right'
    | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface GroupMetaNode {
    id: string;
    width: number;
    height: number;
    anchor?: string;         // Reference to another group ID
    anchorPosition?: AnchorPosition;
    anchorGap?: number;
}

/**
 * Convert anchor position to ELK edge direction hint
 * This helps ELK understand the desired relative positioning
 */
function getAnchorDirection(position: AnchorPosition): 'RIGHT' | 'LEFT' | 'DOWN' | 'UP' {
    switch (position) {
        case 'right':
        case 'top-right':
        case 'bottom-right':
            return 'RIGHT';
        case 'left':
        case 'top-left':
        case 'bottom-left':
            return 'LEFT';
        case 'bottom':
            return 'DOWN';
        case 'top':
            return 'UP';
        default:
            return 'RIGHT';
    }
}

/**
 * Create ELK edges from anchor relationships
 * Direction: anchor -> anchored (source -> target)
 */
function createMetaEdges(
    metaNodes: GroupMetaNode[]
): ElkExtendedEdge[] {
    const edges: ElkExtendedEdge[] = [];
    const nodeIds = new Set(metaNodes.map(n => n.id));

    metaNodes.forEach(node => {
        if (node.anchor && nodeIds.has(node.anchor)) {
            edges.push({
                id: `meta-edge-${node.anchor}-${node.id}`,
                sources: [node.anchor],
                targets: [node.id],
            });
        }
    });

    return edges;
}

/**
 * Calculate global positions for MindMap groups using ELK
 * Treats each group as a single metanode with its bounding box dimensions
 */
export async function calculateGlobalGroupLayout(
    groupMetaNodes: GroupMetaNode[],
    spacing: number = 100
): Promise<Map<string, { x: number; y: number }>> {
    if (groupMetaNodes.length === 0) {
        return new Map();
    }

    // If only one group, position at origin
    if (groupMetaNodes.length === 1) {
        const result = new Map<string, { x: number; y: number }>();
        result.set(groupMetaNodes[0].id, { x: 0, y: 0 });
        return result;
    }

    const elk = new ELK();

    // Create ELK nodes from metanodes
    const elkNodes: ElkNode[] = groupMetaNodes.map(meta => ({
        id: meta.id,
        width: meta.width,
        height: meta.height,
    }));

    // Create edges from anchor relationships
    const elkEdges = createMetaEdges(groupMetaNodes);

    // Determine layout direction based on primary anchor directions
    // Default to RIGHT if no anchors or mixed directions
    let primaryDirection: 'RIGHT' | 'DOWN' = 'RIGHT';
    const anchoredNodes = groupMetaNodes.filter(n => n.anchorPosition);
    if (anchoredNodes.length > 0) {
        const directions = anchoredNodes.map(n => getAnchorDirection(n.anchorPosition!));
        const downCount = directions.filter(d => d === 'DOWN').length;
        const rightCount = directions.filter(d => d === 'RIGHT' || d === 'LEFT').length;
        if (downCount > rightCount) {
            primaryDirection = 'DOWN';
        }
    }

    const layoutOptions = {
        ...DEFAULT_LAYOUT_OPTIONS,
        'elk.direction': primaryDirection,
        'elk.spacing.nodeNode': String(spacing),
        'elk.layered.spacing.nodeNodeBetweenLayers': String(spacing),
    };

    const graph: ElkNode = {
        id: 'global-root',
        layoutOptions,
        children: elkNodes,
        edges: elkEdges,
    };

    console.log('[GlobalLayout] Running ELK on metanodes:', {
        nodes: elkNodes.map(n => ({ id: n.id, w: n.width, h: n.height })),
        edges: elkEdges.map(e => ({ from: e.sources[0], to: e.targets[0] })),
    });

    const layoutedGraph = await elk.layout(graph);

    const positions = new Map<string, { x: number; y: number }>();
    layoutedGraph.children?.forEach(n => {
        positions.set(n.id, { x: n.x!, y: n.y! });
    });

    console.log('[GlobalLayout] Calculated positions:', Object.fromEntries(positions));

    return positions;
}

/**
 * Build GroupMetaNode array from MindMap groups and their rendered nodes
 * Each metanode's size is the bounding box of its contained nodes
 */
export function buildGroupMetaNodes(
    mindMapGroups: MindMapGroup[],
    nodes: Node[]
): GroupMetaNode[] {
    // Group nodes by their groupId
    const groupNodesMap = new Map<string, Node[]>();
    nodes.forEach(node => {
        const groupId = node.data?.groupId as string | undefined;
        if (groupId) {
            const existing = groupNodesMap.get(groupId) ?? [];
            existing.push(node);
            groupNodesMap.set(groupId, existing);
        }
    });

    return mindMapGroups.map(group => {
        const groupNodes = groupNodesMap.get(group.id) ?? [];
        const bbox = calculateGroupBoundingBox(groupNodes);

        return {
            id: group.id,
            width: bbox.width || 200,  // Minimum size if empty
            height: bbox.height || 100,
            anchor: group.anchor,
            anchorPosition: group.anchorPosition as AnchorPosition | undefined,
            anchorGap: group.anchorGap,
        };
    });
}

/**
 * Apply global offsets to nodes based on their group's calculated position
 * Shifts all nodes in a group by the difference between calculated and current position
 */
export function applyGlobalOffsets(
    nodes: Node[],
    mindMapGroups: MindMapGroup[],
    globalPositions: Map<string, { x: number; y: number }>
): Node[] {
    // Group nodes by their groupId
    const groupNodesMap = new Map<string, Node[]>();
    nodes.forEach(node => {
        const groupId = node.data?.groupId as string | undefined;
        if (groupId) {
            const existing = groupNodesMap.get(groupId) ?? [];
            existing.push(node);
            groupNodesMap.set(groupId, existing);
        }
    });

    // Calculate offsets for each group
    const groupOffsets = new Map<string, { dx: number; dy: number }>();

    mindMapGroups.forEach(group => {
        const groupNodes = groupNodesMap.get(group.id) ?? [];
        if (groupNodes.length === 0) return;

        const currentBBox = calculateGroupBoundingBox(groupNodes);
        const targetPos = globalPositions.get(group.id);

        if (targetPos) {
            const dx = targetPos.x - currentBBox.x;
            const dy = targetPos.y - currentBBox.y;

            if (dx !== 0 || dy !== 0) {
                groupOffsets.set(group.id, { dx, dy });
                console.log(`[GlobalLayout] Group "${group.id}" offset: (${dx.toFixed(0)}, ${dy.toFixed(0)})`);
            }
        }
    });

    // Apply offsets to all nodes
    if (groupOffsets.size === 0) {
        return nodes;
    }

    return nodes.map(node => {
        const groupId = node.data?.groupId as string | undefined;
        if (groupId) {
            const offset = groupOffsets.get(groupId);
            if (offset) {
                return {
                    ...node,
                    position: {
                        x: node.position.x + offset.dx,
                        y: node.position.y + offset.dy
                    }
                };
            }
        }
        return node;
    });
}
