import { runElkLayout } from '../elkUtils';
import { findRootNode, collectDescendants, getYBounds } from '../layoutUtils';
import type { LayoutStrategy, LayoutContext } from './types';

export class BidirectionalStrategy implements LayoutStrategy {
    async layoutGroup(context: LayoutContext): Promise<Map<string, { x: number; y: number }>> {
        const { nodes, edges, spacing } = context;
        const rootNode = findRootNode(nodes, edges);

        if (!rootNode) {
            return runElkLayout(nodes, edges, 'RIGHT', spacing);
        }

        const rootChildren = edges
            .filter(e => e.source === rootNode.id)
            .map(e => e.target);

        if (rootChildren.length < 2) {
            return runElkLayout(nodes, edges, 'RIGHT', spacing);
        }

        const midpoint = Math.ceil(rootChildren.length / 2);
        const leftChildIds = rootChildren.slice(0, midpoint);
        const rightChildIds = rootChildren.slice(midpoint);

        const leftNodeIds = collectDescendants(leftChildIds, edges);
        const rightNodeIds = collectDescendants(rightChildIds, edges);
        leftNodeIds.add(rootNode.id);
        rightNodeIds.add(rootNode.id);

        const leftNodes = nodes.filter(n => leftNodeIds.has(n.id));
        const rightNodes = nodes.filter(n => rightNodeIds.has(n.id));
        const leftEdges = edges.filter(e => leftNodeIds.has(e.source) && leftNodeIds.has(e.target));
        const rightEdges = edges.filter(e => rightNodeIds.has(e.source) && rightNodeIds.has(e.target));

        const [leftPos, rightPos] = await Promise.all([
            runElkLayout(leftNodes, leftEdges, 'LEFT', spacing),
            runElkLayout(rightNodes, rightEdges, 'RIGHT', spacing),
        ]);

        const positions = new Map<string, { x: number; y: number }>();
        positions.set(rootNode.id, { x: 0, y: 0 });

        const leftRootPos = leftPos.get(rootNode.id);
        const rightRootPos = rightPos.get(rootNode.id);
        const leftYOffset = -getYBounds(leftPos, rootNode.id).center;
        const rightYOffset = -getYBounds(rightPos, rootNode.id).center;

        leftPos.forEach((p, id) => {
            if (id !== rootNode.id) {
                positions.set(id, {
                    x: p.x - (leftRootPos?.x || 0),
                    y: p.y + leftYOffset
                });
            }
        });

        rightPos.forEach((p, id) => {
            if (id !== rootNode.id) {
                positions.set(id, {
                    x: p.x - (rightRootPos?.x || 0),
                    y: p.y + rightYOffset
                });
            }
        });

        return positions;
    }
}
