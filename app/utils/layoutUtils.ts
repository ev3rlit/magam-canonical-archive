import { Node, Edge } from 'reactflow';

type NodeWithGroup = Node & {
    data?: {
        groupId?: unknown;
        [key: string]: unknown;
    };
};

/**
 * Find the root node (node with no incoming edges)
 */
export function findRootNode(nodes: Node[], edges: Edge[]): Node | null {
    const targetIds = new Set(edges.map(e => e.target));
    return nodes.find(n => !targetIds.has(n.id)) || null;
}

/**
 * Collect all descendant node IDs of given root IDs (BFS)
 */
export function collectDescendants(
    rootIds: string[],
    edges: Edge[]
): Set<string> {
    const descendants = new Set<string>(rootIds);
    const childrenMap = new Map<string, string[]>();

    edges.forEach(e => {
        if (!childrenMap.has(e.source)) childrenMap.set(e.source, []);
        childrenMap.get(e.source)!.push(e.target);
    });

    const queue = [...rootIds];
    while (queue.length > 0) {
        const current = queue.shift()!;
        const children = childrenMap.get(current) || [];
        children.forEach(child => {
            if (!descendants.has(child)) {
                descendants.add(child);
                queue.push(child);
            }
        });
    }

    return descendants;
}

/**
 * Get node dimensions from React Flow node
 */
export function getNodeDimensions(node: Node): { width: number; height: number } {
    // @ts-ignore
    const w = node.measured?.width ?? node.width ?? node.data?.width ?? 150;
    // @ts-ignore
    const h = node.measured?.height ?? node.height ?? node.data?.height ?? 50;
    return { width: w, height: h };
}

export function isNodeMeasured(node: Node): boolean {
    const { width, height } = getNodeDimensions(node);
    return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
}

export function areNodesMeasured(nodes: Node[]): boolean {
    if (nodes.length === 0) return false;
    return nodes.every((node) => isNodeMeasured(node));
}

export function quantizeSize(value: number, quantizationPx = 2): number {
    if (!Number.isFinite(value)) return 0;
    const unit = quantizationPx > 0 ? quantizationPx : 1;
    return Math.round(value / unit) * unit;
}

function getMindMapGroupId(node: Node): string | null {
    const groupId = (node as NodeWithGroup).data?.groupId;
    if (typeof groupId !== 'string' || groupId.length === 0) {
        return null;
    }
    return groupId;
}

function getQuantizedMindMapSizeEntry(node: Node, quantizationPx: number): string {
    const { width, height } = getNodeDimensions(node);
    return `${node.id}:${quantizeSize(width, quantizationPx)}x${quantizeSize(height, quantizationPx)}`;
}

export function getMindMapSizeSignaturesByGroup(
    nodes: Node[],
    options?: { quantizationPx?: number },
): Map<string, string> {
    const quantizationPx = options?.quantizationPx ?? 2;
    const entriesByGroup = new Map<string, string[]>();

    nodes.forEach((node) => {
        const groupId = getMindMapGroupId(node);
        if (!groupId) {
            return;
        }

        const nextEntry = getQuantizedMindMapSizeEntry(node, quantizationPx);
        const entries = entriesByGroup.get(groupId);
        if (entries) {
            entries.push(nextEntry);
            return;
        }

        entriesByGroup.set(groupId, [nextEntry]);
    });

    return new Map(
        [...entriesByGroup.entries()]
            .sort(([leftGroupId], [rightGroupId]) => leftGroupId.localeCompare(rightGroupId))
            .map(([groupId, entries]) => [
                groupId,
                entries.sort((leftEntry, rightEntry) => leftEntry.localeCompare(rightEntry)).join('|'),
            ]),
    );
}

export function getMindMapSizeSignature(
    nodes: Node[],
    options?: { quantizationPx?: number },
): string {
    const quantizationPx = options?.quantizationPx ?? 2;
    const entries = nodes
        .filter((node) => getMindMapGroupId(node) !== null)
        .map((node) => getQuantizedMindMapSizeEntry(node, quantizationPx))
        .sort((a, b) => a.localeCompare(b));
    return entries.join('|');
}

/**
 * Calculate the bounding box for a group of nodes
 */
export function calculateGroupBoundingBox(nodes: Node[]): { x: number; y: number; width: number; height: number } {
    if (nodes.length === 0) {
        return { x: 0, y: 0, width: 0, height: 0 };
    }

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    nodes.forEach(node => {
        const { width, height } = getNodeDimensions(node);

        minX = Math.min(minX, node.position.x);
        minY = Math.min(minY, node.position.y);
        maxX = Math.max(maxX, node.position.x + width);
        maxY = Math.max(maxY, node.position.y + height);
    });

    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
    };
}

/**
 * Calculate Y bounding box for positions, excluding a specific ID
 */
export function getYBounds(
    positions: Map<string, { x: number; y: number }>,
    excludeId: string
): { min: number; max: number; center: number } {
    let minY = Infinity;
    let maxY = -Infinity;

    positions.forEach((pos, nodeId) => {
        if (nodeId !== excludeId) {
            minY = Math.min(minY, pos.y);
            maxY = Math.max(maxY, pos.y);
        }
    });

    return {
        min: minY,
        max: maxY,
        center: (minY + maxY) / 2
    };
}
