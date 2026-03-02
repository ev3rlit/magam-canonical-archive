import { Node, Edge } from 'reactflow';
// @ts-ignore
import ELK from 'elkjs/lib/elk.bundled';
import { ElkNode, ElkExtendedEdge } from 'elkjs/lib/elk-api';
import { getNodeDimensions } from './layoutUtils';

// Default options for ELK layout
export const DEFAULT_LAYOUT_OPTIONS = {
    'elk.algorithm': 'layered',
    'elk.direction': 'RIGHT',
    'elk.spacing.nodeNode': '20',
    'elk.layered.spacing.nodeNodeBetweenLayers': '40',
    // Preserve node/edge order as declared in the source code
    'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
};

/**
 * Run ELK layout on a subgraph
 * @returns Map of node IDs to their calculated positions
 */
export async function runElkLayout(
    nodes: Node[],
    edges: Edge[],
    direction: 'LEFT' | 'RIGHT' | 'UP' | 'DOWN',
    spacing: number,
    additionalOptions: Record<string, string> = {}
): Promise<Map<string, { x: number; y: number }>> {
    const elk = new ELK();

    const elkNodes: ElkNode[] = nodes.map(node => {
        const { width, height } = getNodeDimensions(node);
        return { id: node.id, width, height };
    });

    const elkEdges: ElkExtendedEdge[] = edges.map(edge => ({
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target],
    }));

    const layoutOptions = {
        ...DEFAULT_LAYOUT_OPTIONS,
        'elk.direction': direction,
        'elk.spacing.nodeNode': String(spacing),
        ...additionalOptions,
    };

    const graph: ElkNode = {
        id: 'root',
        layoutOptions,
        children: elkNodes,
        edges: elkEdges,
    };

    const layoutedGraph = await elk.layout(graph);

    const positions = new Map<string, { x: number; y: number }>();
    layoutedGraph.children?.forEach(n => {
        positions.set(n.id, { x: n.x!, y: n.y! });
    });

    return positions;
}
