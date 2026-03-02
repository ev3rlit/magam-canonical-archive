import { runFlextreeLayout } from './flextreeUtils';
import { findRootNode, collectDescendants, getNodeDimensions } from '../layoutUtils';
import type { LayoutStrategy, LayoutContext } from './types';

export class DepthHybridStrategy implements LayoutStrategy {
    async layoutGroup(context: LayoutContext): Promise<Map<string, { x: number; y: number }>> {
        const { nodes, edges, spacing } = context;
        const rootNode = findRootNode(nodes, edges);

        if (!rootNode) {
            return runFlextreeLayout(nodes, edges, spacing);
        }

        const l1ChildIds = edges
            .filter(e => e.source === rootNode.id)
            .map(e => e.target);

        if (l1ChildIds.length === 0) {
            return runFlextreeLayout(nodes, edges, spacing);
        }

        // Pass 1: layout each L1 child's subtree with flextree, collect bounding boxes
        const subtreeLayouts: Array<{
            childId: string;
            positions: Map<string, { x: number; y: number }>;
            bbox: { width: number; height: number };
        }> = [];

        for (const childId of l1ChildIds) {
            const subtreeNodeIds = collectDescendants([childId], edges);
            const subtreeNodes = nodes.filter(n => subtreeNodeIds.has(n.id));
            const subtreeEdges = edges.filter(
                e => subtreeNodeIds.has(e.source) && subtreeNodeIds.has(e.target),
            );

            const positions = runFlextreeLayout(subtreeNodes, subtreeEdges, spacing);

            // Compute bounding box from positions + node sizes
            let minX = Infinity, minY = Infinity;
            let maxX = -Infinity, maxY = -Infinity;
            positions.forEach((pos, id) => {
                const node = nodes.find(n => n.id === id);
                const { width, height } = node ? getNodeDimensions(node) : { width: 150, height: 50 };
                minX = Math.min(minX, pos.x);
                minY = Math.min(minY, pos.y);
                maxX = Math.max(maxX, pos.x + width);
                maxY = Math.max(maxY, pos.y + height);
            });

            subtreeLayouts.push({
                childId,
                positions,
                bbox: { width: maxX - minX, height: maxY - minY },
            });
        }

        // Pass 2: arrange bounding boxes in a grid
        const cols = Math.ceil(Math.sqrt(l1ChildIds.length));
        const cellWidth = Math.max(...subtreeLayouts.map(s => s.bbox.width)) + spacing;
        const cellHeight = Math.max(...subtreeLayouts.map(s => s.bbox.height)) + spacing;

        const rootDims = getNodeDimensions(rootNode);
        // Root placed left of the grid, vertically centered
        const gridTotalHeight = Math.ceil(l1ChildIds.length / cols) * cellHeight;
        const rootX = 0;
        const rootY = (gridTotalHeight - rootDims.height) / 2;

        const positions = new Map<string, { x: number; y: number }>();
        positions.set(rootNode.id, { x: rootX, y: rootY });

        const gridOffsetX = rootDims.width + spacing * 2;

        subtreeLayouts.forEach(({ positions: subPos }, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            const cellX = gridOffsetX + col * cellWidth;
            const cellY = row * cellHeight;

            // Find the subtree's top-left origin to normalize positions
            let originX = Infinity, originY = Infinity;
            subPos.forEach(pos => {
                originX = Math.min(originX, pos.x);
                originY = Math.min(originY, pos.y);
            });

            subPos.forEach((pos, id) => {
                positions.set(id, {
                    x: cellX + (pos.x - originX),
                    y: cellY + (pos.y - originY),
                });
            });
        });

        return positions;
    }
}
