import { flextree } from 'd3-flextree';
import { hierarchy } from 'd3-hierarchy';
import { Node, Edge } from 'reactflow';
import { findRootNode, getNodeDimensions } from '../layoutUtils';

interface HierarchyDatum {
    id: string;
    width: number;
    height: number;
    children?: HierarchyDatum[];
}

/**
 * Build a nested hierarchy from flat nodes/edges.
 * Uses BFS from root to construct the tree.
 */
export function buildHierarchy(nodes: Node[], edges: Edge[]): HierarchyDatum | null {
    const root = findRootNode(nodes, edges);
    if (!root) return null;

    const childrenMap = new Map<string, string[]>();
    edges.forEach(e => {
        if (!childrenMap.has(e.source)) childrenMap.set(e.source, []);
        childrenMap.get(e.source)!.push(e.target);
    });

    const nodeMap = new Map(nodes.map(n => [n.id, n]));

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

    return buildNode(root.id);
}

/**
 * Run flextree layout and return positions as Map<id, {x, y}>.
 *
 * d3-flextree lays out top-to-bottom (x = breadth, y = depth).
 * Magam uses left-to-right, so we swap:
 *   - nodeSize: [height+spacing, width+spacing] (breadth = node height, depth = node width)
 *   - result: flextree.x → final y, flextree.y → final x
 */
export function runFlextreeLayout(
    nodes: Node[],
    edges: Edge[],
    spacing: number,
    direction: 'right' | 'left' | 'down' | 'up' = 'right',
): Map<string, { x: number; y: number }> {
    const rootDatum = buildHierarchy(nodes, edges);
    if (!rootDatum) return new Map();

    const verticalGap = Math.round(spacing * 0.3);

    const tree = flextree<HierarchyDatum>({
        nodeSize: (node) => [
            node.data.height + verticalGap,  // breadth (tighter vertical gap between siblings)
            node.data.width + spacing,        // depth (horizontal spacing between layers)
        ],
    });

    const root = hierarchy<HierarchyDatum>(rootDatum);
    const laid = tree(root);

    const positions = new Map<string, { x: number; y: number }>();
    laid.each((node) => {
        // flextree: x = breadth, y = depth (top-to-bottom)
        // Transform based on desired direction:
        let x: number, y: number;
        switch (direction) {
            case 'right': x = node.y;  y = node.x;  break; // depth→x, breadth→y (default)
            case 'left':  x = -node.y; y = node.x;  break; // mirror x
            case 'down':  x = node.x;  y = node.y;  break; // no swap
            case 'up':    x = node.x;  y = -node.y; break; // mirror y
        }
        positions.set(node.data.id, { x, y });
    });

    return positions;
}
