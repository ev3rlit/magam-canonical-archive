import type { Node } from 'reactflow';
import { findRootNode, collectDescendants, getNodeDimensions } from '../layoutUtils';
import { runFlextreeLayout } from './flextreeUtils';
import type { LayoutStrategy, LayoutContext } from './types';

/**
 * QuadrantPackStrategy:
 *   Root at center (0,0). L1 subtrees individually laid out via flextree,
 *   then distributed across 4 quadrants (TR/TL/BR/BL) using greedy area
 *   balancing. Each quadrant stacks outward from root edges, creating a
 *   diamond shape. Left-side subtrees get mirrored X for directional inheritance.
 */
export class QuadrantPackStrategy implements LayoutStrategy {
    async layoutGroup(context: LayoutContext): Promise<Map<string, { x: number; y: number }>> {
        const { nodes, edges, spacing, density: rawDensity } = context;
        const density = rawDensity ?? 0.5;
        const maxGap = spacing * 2;
        const minGap = spacing * 0.1;
        const effectiveGap = maxGap - density * (maxGap - minGap);
        const innerSpacing = spacing * (1 - density * 0.9);
        console.log(`[QuadrantPack] density=${density}, spacing=${spacing}, effectiveGap=${effectiveGap.toFixed(1)}, innerSpacing=${innerSpacing.toFixed(1)}`);
        const rootNode = findRootNode(nodes, edges);
        if (!rootNode) return runFlextreeLayout(nodes, edges, spacing);

        const l1ChildIds = edges
            .filter(e => e.source === rootNode.id)
            .map(e => e.target);

        if (l1ChildIds.length < 2) return runFlextreeLayout(nodes, edges, spacing);

        // 1. Layout each L1 subtree individually and compute bbox + area
        const subtrees = l1ChildIds.map(childId => {
            const descIds = collectDescendants([childId], edges);
            const subtreeNodeIds = new Set(descIds);
            subtreeNodeIds.add(rootNode.id);

            const subtreeNodes = nodes.filter(n => subtreeNodeIds.has(n.id));
            const subtreeEdges = edges.filter(
                e => subtreeNodeIds.has(e.source) && subtreeNodeIds.has(e.target),
            );

            const pos = runFlextreeLayout(subtreeNodes, subtreeEdges, innerSpacing);
            const rootPos = pos.get(rootNode.id) || { x: 0, y: 0 };

            // Compute bbox relative to root
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            pos.forEach((p, id) => {
                if (id === rootNode.id) return;
                const node = nodes.find(n => n.id === id);
                if (!node) return;
                const { width, height } = getNodeDimensions(node);
                const rx = p.x - rootPos.x;
                const ry = p.y - rootPos.y;
                minX = Math.min(minX, rx);
                maxX = Math.max(maxX, rx + width);
                minY = Math.min(minY, ry);
                maxY = Math.max(maxY, ry + height);
            });

            return {
                childId,
                positions: pos,
                rootPos,
                bbox: { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY },
                area: (maxX - minX) * (maxY - minY),
            };
        });

        // 2. Greedy area balancing: assign to 4 quadrants (TR=0, TL=1, BR=2, BL=3)
        const sorted = [...subtrees].sort((a, b) => b.area - a.area);
        const qAreas = [0, 0, 0, 0];
        const quadrants: (typeof subtrees)[] = [[], [], [], []];

        for (const st of sorted) {
            let minIdx = 0;
            for (let i = 1; i < 4; i++) {
                if (qAreas[i] < qAreas[minIdx]) minIdx = i;
            }
            quadrants[minIdx].push(st);
            qAreas[minIdx] += st.area;
        }

        // Sort within each quadrant: largest closest to root
        for (const q of quadrants) {
            q.sort((a, b) => b.area - a.area);
        }

        const rootDims = getNodeDimensions(rootNode);

        const positions = new Map<string, { x: number; y: number }>();
        positions.set(rootNode.id, { x: 0, y: 0 });

        // 3. Place each quadrant — stacking outward from root edges
        placeQuadrant(quadrants[0], 1, -1, rootDims, effectiveGap, effectiveGap, nodes, rootNode.id, positions); // TR
        placeQuadrant(quadrants[1], -1, -1, rootDims, effectiveGap, effectiveGap, nodes, rootNode.id, positions); // TL
        placeQuadrant(quadrants[2], 1, 1, rootDims, effectiveGap, effectiveGap, nodes, rootNode.id, positions);  // BR
        placeQuadrant(quadrants[3], -1, 1, rootDims, effectiveGap, effectiveGap, nodes, rootNode.id, positions); // BL

        return positions;
    }
}

function placeQuadrant(
    subtrees: Array<{
        childId: string;
        positions: Map<string, { x: number; y: number }>;
        rootPos: { x: number; y: number };
        bbox: { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number };
        area: number;
    }>,
    xSign: 1 | -1,
    yDir: 1 | -1,   // -1 = stack upward (top), 1 = stack downward (bottom)
    rootDims: { width: number; height: number },
    gap: number,
    verticalGap: number,
    allNodes: Node[],
    rootId: string,
    positions: Map<string, { x: number; y: number }>,
) {
    if (subtrees.length === 0) return;

    // Start at root edge + gap, then stack outward
    let stackY = yDir === -1 ? -gap : rootDims.height + gap;

    for (const st of subtrees) {
        // Calculate where this subtree's bbox top-left goes
        const subtreeStartY = yDir === -1
            ? stackY - st.bbox.height   // upward: bottom edge at stackY
            : stackY;                    // downward: top edge at stackY

        st.positions.forEach((p, id) => {
            if (id === rootId) return;
            const node = allNodes.find(n => n.id === id);
            if (!node) return;
            const { width } = getNodeDimensions(node);

            const relX = p.x - st.rootPos.x - st.bbox.minX;
            const relY = p.y - st.rootPos.y - st.bbox.minY;

            let finalX: number;
            if (xSign === 1) {
                finalX = rootDims.width + gap + relX;
            } else {
                finalX = -gap - relX - width;
            }

            positions.set(id, { x: finalX, y: subtreeStartY + relY });
        });

        // Advance stackY outward
        if (yDir === -1) {
            stackY = subtreeStartY - verticalGap;
        } else {
            stackY = subtreeStartY + st.bbox.height + verticalGap;
        }
    }
}
