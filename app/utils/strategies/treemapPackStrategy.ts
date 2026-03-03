import { hierarchy, treemap, treemapSquarify } from 'd3-hierarchy';
import { Delaunay } from 'd3-delaunay';
import { findRootNode, collectDescendants, getNodeDimensions } from '../layoutUtils';
import type { LayoutStrategy, LayoutContext } from './types';
import type { Node, Edge } from 'reactflow';

interface TmDatum {
    id: string;
    area?: number;
    children?: TmDatum[];
}

// ── Helpers ──────────────────────────────────────────────────────────

function polygonCentroid(polygon: number[][]): [number, number] {
    let cx = 0, cy = 0, area = 0;
    const n = polygon.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
        const xi = polygon[i][0], yi = polygon[i][1];
        const xj = polygon[j][0], yj = polygon[j][1];
        const cross = xi * yj - xj * yi;
        area += cross;
        cx += (xi + xj) * cross;
        cy += (yi + yj) * cross;
    }
    area /= 2;
    if (Math.abs(area) < 1e-10) {
        // Degenerate polygon, use simple average
        cx = polygon.reduce((s, p) => s + p[0], 0) / n;
        cy = polygon.reduce((s, p) => s + p[1], 0) / n;
        return [cx, cy];
    }
    const f = 1 / (6 * area);
    return [cx * f, cy * f];
}

function polygonBBox(polygon: number[][]): { x: number; y: number; w: number; h: number } {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [px, py] of polygon) {
        if (px < minX) minX = px;
        if (py < minY) minY = py;
        if (px > maxX) maxX = px;
        if (py > maxY) maxY = py;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/**
 * Weighted Voronoi subdivision using Lloyd's relaxation.
 * Returns centroid + bounding box per item.
 */
function voronoiSubdivide(
    items: { id: string; weight: number }[],
    bounds: { x0: number; y0: number; x1: number; y1: number },
    iterations: number = 30,
): { id: string; cx: number; cy: number; bbox: { x: number; y: number; w: number; h: number } }[] {
    const n = items.length;
    if (n === 0) return [];

    const bw = bounds.x1 - bounds.x0;
    const bh = bounds.y1 - bounds.y0;

    // Initialize points spread across bounds
    const points = new Float64Array(n * 2);
    for (let i = 0; i < n; i++) {
        // Spread along a grid-ish pattern inside bounds
        const col = i % Math.ceil(Math.sqrt(n));
        const row = Math.floor(i / Math.ceil(Math.sqrt(n)));
        const cols = Math.ceil(Math.sqrt(n));
        const rows = Math.ceil(n / cols);
        points[i * 2] = bounds.x0 + (col + 0.5) * bw / cols;
        points[i * 2 + 1] = bounds.y0 + (row + 0.5) * bh / rows;
    }

    // Lloyd's relaxation
    for (let iter = 0; iter < iterations; iter++) {
        const delaunay = new Delaunay(points);
        const voronoi = delaunay.voronoi([bounds.x0, bounds.y0, bounds.x1, bounds.y1]);

        for (let i = 0; i < n; i++) {
            const cell = voronoi.cellPolygon(i);
            if (!cell) continue;
            const [cx, cy] = polygonCentroid(cell);
            // Weighted: heavier items pull centroid less (stay more centered)
            const alpha = 0.8;
            points[i * 2] = points[i * 2] + alpha * (cx - points[i * 2]);
            points[i * 2 + 1] = points[i * 2 + 1] + alpha * (cy - points[i * 2 + 1]);
        }
    }

    // Final Voronoi for results
    const delaunay = new Delaunay(points);
    const voronoi = delaunay.voronoi([bounds.x0, bounds.y0, bounds.x1, bounds.y1]);

    const results: { id: string; cx: number; cy: number; bbox: { x: number; y: number; w: number; h: number } }[] = [];
    for (let i = 0; i < n; i++) {
        const cell = voronoi.cellPolygon(i);
        if (!cell) {
            results.push({ id: items[i].id, cx: points[i * 2], cy: points[i * 2 + 1], bbox: { x: points[i * 2], y: points[i * 2 + 1], w: 0, h: 0 } });
            continue;
        }
        const [cx, cy] = polygonCentroid(cell);
        results.push({ id: items[i].id, cx, cy, bbox: polygonBBox(cell) });
    }
    return results;
}

// ── MaxRects Bin Packing (BSSF - Best Short Side Fit) ──

interface Rect { x: number; y: number; w: number; h: number }

function maxRectsPack(
    items: { id: string; w: number; h: number }[],
    binW: number, binH: number,
    ox: number, oy: number,
    gap: number,
): Map<string, { x: number; y: number }> {
    const positions = new Map<string, { x: number; y: number }>();
    const freeRects: Rect[] = [{ x: 0, y: 0, w: binW, h: binH }];

    // Sort items by area descending for better packing
    const sorted = [...items].sort((a, b) => (b.w * b.h) - (a.w * a.h));

    for (const item of sorted) {
        const iw = item.w + gap;
        const ih = item.h + gap;

        let bestIdx = -1;
        let bestShortSide = Infinity;
        let bestLongSide = Infinity;

        // Find best-short-side-fit free rect
        for (let i = 0; i < freeRects.length; i++) {
            const r = freeRects[i];
            if (r.w >= iw && r.h >= ih) {
                const shortSide = Math.min(r.w - iw, r.h - ih);
                const longSide = Math.max(r.w - iw, r.h - ih);
                if (shortSide < bestShortSide || (shortSide === bestShortSide && longSide < bestLongSide)) {
                    bestShortSide = shortSide;
                    bestLongSide = longSide;
                    bestIdx = i;
                }
            }
        }

        if (bestIdx === -1) {
            // Doesn't fit — place at end (overflow)
            const maxY = freeRects.reduce((m, r) => Math.max(m, r.y + r.h), 0);
            positions.set(item.id, { x: ox, y: oy + maxY });
            freeRects.push({ x: 0, y: maxY, w: binW, h: ih });
            continue;
        }

        const r = freeRects[bestIdx];
        positions.set(item.id, { x: ox + r.x, y: oy + r.y });

        // Split: right remainder + bottom remainder
        const newRects: Rect[] = [];
        if (r.w - iw > 0) {
            newRects.push({ x: r.x + iw, y: r.y, w: r.w - iw, h: r.h });
        }
        if (r.h - ih > 0) {
            newRects.push({ x: r.x, y: r.y + ih, w: r.w, h: r.h - ih });
        }

        // Remove used rect, add new ones
        freeRects.splice(bestIdx, 1, ...newRects);

        // Prune contained rects
        pruneContainedRects(freeRects);
    }

    return positions;
}

function pruneContainedRects(rects: Rect[]): void {
    for (let i = rects.length - 1; i >= 0; i--) {
        for (let j = 0; j < rects.length; j++) {
            if (i === j) continue;
            const a = rects[i], b = rects[j];
            if (a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h) {
                rects.splice(i, 1);
                break;
            }
        }
    }
}

type Facing = 'right' | 'left' | 'down' | 'up';

function directionFromCellToRoot(
    cellCx: number, cellCy: number,
    containerCx: number, containerCy: number,
): Facing {
    const dx = cellCx - containerCx;
    const dy = cellCy - containerCy;
    if (Math.abs(dx) > Math.abs(dy)) {
        return dx > 0 ? 'left' : 'right'; // face toward root
    }
    return dy > 0 ? 'up' : 'down';
}

function placeL1InCell(
    cell: { x0: number; y0: number; x1: number; y1: number },
    nodeW: number, nodeH: number,
    facing: Facing, gap: number,
): { nodeX: number; nodeY: number; remainder: { x0: number; y0: number; x1: number; y1: number } } {
    const cx = (cell.x0 + cell.x1) / 2;
    const cy = (cell.y0 + cell.y1) / 2;

    let nodeX: number, nodeY: number;
    let remainder: { x0: number; y0: number; x1: number; y1: number };

    switch (facing) {
        case 'left': // cell is to the right of root → L1 on left edge
            nodeX = cell.x0 + gap;
            nodeY = cy - nodeH / 2;
            remainder = { x0: cell.x0 + nodeW + gap * 2, y0: cell.y0, x1: cell.x1, y1: cell.y1 };
            break;
        case 'right': // cell is to the left of root → L1 on right edge
            nodeX = cell.x1 - nodeW - gap;
            nodeY = cy - nodeH / 2;
            remainder = { x0: cell.x0, y0: cell.y0, x1: cell.x1 - nodeW - gap * 2, y1: cell.y1 };
            break;
        case 'up': // cell is below root → L1 on top edge
            nodeX = cx - nodeW / 2;
            nodeY = cell.y0 + gap;
            remainder = { x0: cell.x0, y0: cell.y0 + nodeH + gap * 2, x1: cell.x1, y1: cell.y1 };
            break;
        case 'down': // cell is above root → L1 on bottom edge
            nodeX = cx - nodeW / 2;
            nodeY = cell.y1 - nodeH - gap;
            remainder = { x0: cell.x0, y0: cell.y0, x1: cell.x1, y1: cell.y1 - nodeH - gap * 2 };
            break;
    }

    // Ensure remainder is valid
    if (remainder.x1 <= remainder.x0 || remainder.y1 <= remainder.y0) {
        remainder = { x0: cell.x0, y0: cell.y0, x1: cell.x1, y1: cell.y1 };
    }

    return { nodeX, nodeY, remainder };
}

// ── Strategy ─────────────────────────────────────────────────────────

/**
 * TreemapPackStrategy:
 *   Root at center (0,0).
 *   L1 → d3-treemap for proportional area allocation.
 *   L2 → Voronoi subdivision within each L1 cell.
 *   L3+ → MaxRects bin packing within each L2 region.
 */
export class TreemapPackStrategy implements LayoutStrategy {
    async layoutGroup(context: LayoutContext): Promise<Map<string, { x: number; y: number }>> {
        const { nodes, edges, spacing } = context;
        const rootNode = findRootNode(nodes, edges);
        if (!rootNode) return this.fallbackPack(nodes, edges, spacing);

        const l1ChildIds = edges
            .filter(e => e.source === rootNode.id)
            .map(e => e.target);

        if (l1ChildIds.length < 2) return this.fallbackPack(nodes, edges, spacing);

        const nodeMap = new Map(nodes.map(n => [n.id, n]));
        const childrenMap = new Map<string, string[]>();
        edges.forEach(e => {
            if (!childrenMap.has(e.source)) childrenMap.set(e.source, []);
            childrenMap.get(e.source)!.push(e.target);
        });

        // Gather subtree info for each L1 child
        const subtrees = l1ChildIds.map(childId => {
            const allIds = collectDescendants([childId], edges);
            const subtreeNodes = nodes.filter(n => allIds.has(n.id));
            const totalArea = subtreeNodes.reduce((sum, n) => {
                const { width, height } = getNodeDimensions(n);
                return sum + width * height;
            }, 0);
            const l2Ids = childrenMap.get(childId) || [];
            return { childId, allIds, subtreeNodes, totalArea, l2Ids };
        });

        // Container size based on total node area
        const totalNodeArea = subtrees.reduce((sum, s) => sum + s.totalArea, 0);
        const containerArea = totalNodeArea * 3;
        const containerSide = Math.sqrt(containerArea);

        // d3-treemap: divide container among L1 children
        const tmData: TmDatum = {
            id: 'root',
            children: subtrees.map(s => ({ id: s.childId, area: s.totalArea })),
        };
        const tmRoot = hierarchy<TmDatum>(tmData).sum(d => d.area ?? 0);
        const tmLayout = treemap<TmDatum>()
            .size([containerSide, containerSide])
            .padding(spacing)
            .tile(treemapSquarify);
        const laid = tmLayout(tmRoot);

        const containerCx = containerSide / 2;
        const containerCy = containerSide / 2;

        const positions = new Map<string, { x: number; y: number }>();

        // Layout each L1 cell
        laid.children?.forEach(cell => {
            const subtree = subtrees.find(s => s.childId === cell.data.id)!;
            const l1Node = nodeMap.get(subtree.childId)!;
            const { width: l1W, height: l1H } = getNodeDimensions(l1Node);

            const cellCx = (cell.x0 + cell.x1) / 2;
            const cellCy = (cell.y0 + cell.y1) / 2;

            // Facing: direction from cell toward root (container center)
            const facing = directionFromCellToRoot(cellCx, cellCy, containerCx, containerCy);

            // Place L1 node on inner edge of cell
            const { nodeX, nodeY, remainder } = placeL1InCell(
                { x0: cell.x0, y0: cell.y0, x1: cell.x1, y1: cell.y1 },
                l1W, l1H, facing, spacing,
            );
            positions.set(subtree.childId, { x: nodeX, y: nodeY });

            // L2 children
            const l2Ids = subtree.l2Ids;
            if (l2Ids.length === 0) return;

            const remainderW = remainder.x1 - remainder.x0;
            const remainderH = remainder.y1 - remainder.y0;

            if (remainderW < spacing || remainderH < spacing) {
                // Not enough space, just stack L2+ below L1
                this.packDescendantsFlat(
                    l2Ids, childrenMap, nodeMap,
                    cell.x0, cell.y0 + l1H + spacing,
                    cell.x1 - cell.x0, cell.y1 - cell.y0 - l1H - spacing,
                    spacing, positions,
                );
                return;
            }

            if (l2Ids.length <= 1) {
                // Single L2: skip voronoi, place directly + maxrects for L3+
                const l2Id = l2Ids[0];
                const l2Node = nodeMap.get(l2Id);
                if (!l2Node) return;
                const { height: l2H } = getNodeDimensions(l2Node);
                positions.set(l2Id, { x: remainder.x0 + spacing, y: remainder.y0 + spacing });

                const l3Ids = childrenMap.get(l2Id) || [];
                if (l3Ids.length > 0) {
                    this.packDescendantsFlat(
                        l3Ids, childrenMap, nodeMap,
                        remainder.x0 + spacing, remainder.y0 + l2H + spacing * 2,
                        remainderW - spacing * 2, remainderH - l2H - spacing * 3,
                        spacing, positions,
                    );
                }
                return;
            }

            // Voronoi subdivision for L2 children
            const l2Items = l2Ids.map(id => {
                const desc = collectDescendants([id], edges);
                const weight = [...desc].reduce((sum, did) => {
                    const dn = nodeMap.get(did);
                    if (!dn) return sum;
                    const { width, height } = getNodeDimensions(dn);
                    return sum + width * height;
                }, 0);
                return { id, weight };
            });

            const voronoiResults = voronoiSubdivide(
                l2Items,
                { x0: remainder.x0, y0: remainder.y0, x1: remainder.x1, y1: remainder.y1 },
                30,
            );

            // Place L2 nodes at voronoi centroids, then L3+ via maxrects in voronoi bbox
            for (const vr of voronoiResults) {
                const l2Node = nodeMap.get(vr.id);
                if (!l2Node) continue;
                const { width: l2W, height: l2H } = getNodeDimensions(l2Node);
                positions.set(vr.id, { x: vr.cx - l2W / 2, y: vr.cy - l2H / 2 });

                const l3Ids = childrenMap.get(vr.id) || [];
                if (l3Ids.length === 0) continue;

                // Pack L3+ within voronoi cell's bounding box, below L2
                const packOx = vr.bbox.x + spacing / 2;
                const packOy = vr.cy + l2H / 2 + spacing;
                const packW = Math.max(vr.bbox.w - spacing, l2W);
                const packH = Math.max(vr.bbox.y + vr.bbox.h - packOy - spacing / 2, l2H);

                this.packDescendantsFlat(
                    l3Ids, childrenMap, nodeMap,
                    packOx, packOy, packW, packH,
                    spacing, positions,
                );
            }
        });

        // Offset all positions so root is at (0,0)
        const rootDims = getNodeDimensions(rootNode);
        positions.set(rootNode.id, { x: containerCx - rootDims.width / 2, y: containerCy - rootDims.height / 2 });

        const rootPos = positions.get(rootNode.id)!;
        const offsetX = -rootPos.x;
        const offsetY = -rootPos.y;

        const result = new Map<string, { x: number; y: number }>();
        positions.forEach((pos, id) => {
            result.set(id, { x: pos.x + offsetX, y: pos.y + offsetY });
        });

        return result;
    }

    /**
     * Pack descendant nodes into a rectangular region using MaxRects.
     * Recursively includes all children at all depths.
     */
    private packDescendantsFlat(
        rootIds: string[],
        childrenMap: Map<string, string[]>,
        nodeMap: Map<string, Node>,
        ox: number, oy: number,
        w: number, h: number,
        gap: number,
        positions: Map<string, { x: number; y: number }>,
    ): void {
        // Collect all descendant nodes from rootIds (inclusive)
        const allIds: string[] = [];
        const queue = [...rootIds];
        const visited = new Set<string>();
        while (queue.length > 0) {
            const id = queue.shift()!;
            if (visited.has(id)) continue;
            visited.add(id);
            allIds.push(id);
            const children = childrenMap.get(id) || [];
            queue.push(...children);
        }

        const items = allIds
            .map(id => {
                const n = nodeMap.get(id);
                if (!n) return null;
                const { width, height } = getNodeDimensions(n);
                return { id, w: width, h: height };
            })
            .filter((x): x is { id: string; w: number; h: number } => x !== null);

        if (items.length === 0) return;

        const packed = maxRectsPack(items, Math.max(w, 1), Math.max(h, 1), ox, oy, gap);
        packed.forEach((pos, id) => positions.set(id, pos));
    }

    /**
     * Fallback: root at (0,0), remaining nodes packed to the right via MaxRects.
     */
    private fallbackPack(
        nodes: Node[], edges: Edge[], spacing: number,
    ): Map<string, { x: number; y: number }> {
        const rootNode = findRootNode(nodes, edges);
        const positions = new Map<string, { x: number; y: number }>();

        if (!rootNode) {
            // No root: pack all nodes
            const items = nodes.map(n => {
                const { width, height } = getNodeDimensions(n);
                return { id: n.id, w: width, h: height };
            });
            const totalArea = items.reduce((s, i) => s + i.w * i.h, 0);
            const side = Math.sqrt(totalArea * 2);
            return maxRectsPack(items, side, side, 0, 0, spacing);
        }

        const { width: rw } = getNodeDimensions(rootNode);
        positions.set(rootNode.id, { x: 0, y: 0 });

        const rest = nodes.filter(n => n.id !== rootNode.id);
        if (rest.length === 0) return positions;

        const items = rest.map(n => {
            const { width, height } = getNodeDimensions(n);
            return { id: n.id, w: width, h: height };
        });
        const totalArea = items.reduce((s, i) => s + i.w * i.h, 0);
        const side = Math.sqrt(totalArea * 2);
        const packed = maxRectsPack(items, side, side, rw + spacing * 2, 0, spacing);
        packed.forEach((pos, id) => positions.set(id, pos));

        return positions;
    }
}
