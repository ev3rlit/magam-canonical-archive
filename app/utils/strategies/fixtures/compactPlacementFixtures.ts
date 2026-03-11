import type { Edge, Node } from 'reactflow';
import { getNodeDimensions } from '../../layoutUtils';
import type { LayoutBounds, LayoutPoint } from '../types';

interface FixtureGraph {
    nodes: Node[];
    edges: Edge[];
    spacing: number;
}

interface FixtureRect extends LayoutPoint {
    id: string;
    width: number;
    height: number;
}

interface BaselineSubtree {
    positions: Map<string, LayoutPoint>;
    rects: FixtureRect[];
    bounds: LayoutBounds;
}

const DEFAULT_SPACING = 60;
const BASE_HORIZONTAL_GAP_RATIO = 0.9;
const BASE_VERTICAL_GAP_RATIO = 0.28;

export function createMixedSizeFixture(): FixtureGraph {
    const nodes = [
        createNode('root', 180, 64),
        createNode('topic-a', 120, 44),
        createNode('topic-b', 168, 56),
        createNode('topic-c', 132, 48),
        createNode('topic-a-note', 104, 36),
        createNode('topic-a-image', 176, 92),
        createNode('topic-b-note', 112, 40),
        createNode('topic-c-note', 108, 36),
        createNode('topic-c-code', 220, 108),
    ];

    const edges = [
        createEdge('root', 'topic-a'),
        createEdge('root', 'topic-b'),
        createEdge('root', 'topic-c'),
        createEdge('topic-a', 'topic-a-note'),
        createEdge('topic-a', 'topic-a-image'),
        createEdge('topic-b', 'topic-b-note'),
        createEdge('topic-c', 'topic-c-note'),
        createEdge('topic-c', 'topic-c-code'),
    ];

    return { nodes, edges, spacing: DEFAULT_SPACING };
}

export function createMultiRootFixture(): FixtureGraph {
    const nodes = [
        createNode('root-a', 112, 48),
        createNode('root-b', 112, 48),
        createNode('root-c', 112, 48),
        createNode('root-d', 112, 48),
        createNode('a-note', 104, 36),
        createNode('b-topic', 120, 40),
        createNode('b-leaf', 92, 34),
        createNode('c-topic', 120, 40),
        createNode('d-note', 104, 36),
    ];

    const edges = [
        createEdge('root-a', 'a-note'),
        createEdge('root-b', 'b-topic'),
        createEdge('b-topic', 'b-leaf'),
        createEdge('root-c', 'c-topic'),
        createEdge('root-d', 'd-note'),
    ];

    return { nodes, edges, spacing: DEFAULT_SPACING };
}

export function createSiblingHeavyFixture(): FixtureGraph {
    const nodes: Node[] = [createNode('root', 152, 56)];
    const edges: Edge[] = [];

    for (let index = 1; index <= 8; index += 1) {
        const childId = `child-${index}`;
        const leafId = `leaf-${index}`;
        nodes.push(createNode(childId, 112, 44));
        nodes.push(createNode(leafId, 92, 34));
        edges.push(createEdge('root', childId));
        edges.push(createEdge(childId, leafId));
    }

    return { nodes, edges, spacing: DEFAULT_SPACING };
}

export function createContourCompressionFixture(): FixtureGraph {
    const nodes = [
        createNode('root', 160, 56),
        createNode('deep', 120, 44),
        createNode('shallow', 116, 42),
        createNode('deep-a', 104, 36),
        createNode('deep-b', 104, 36),
        createNode('deep-c', 104, 36),
        createNode('deep-a-leaf', 92, 32),
        createNode('deep-b-leaf', 92, 32),
        createNode('deep-c-leaf', 92, 32),
        createNode('shallow-leaf', 96, 34),
    ];

    const edges = [
        createEdge('root', 'deep'),
        createEdge('root', 'shallow'),
        createEdge('deep', 'deep-a'),
        createEdge('deep', 'deep-b'),
        createEdge('deep', 'deep-c'),
        createEdge('deep-a', 'deep-a-leaf'),
        createEdge('deep-b', 'deep-b-leaf'),
        createEdge('deep-c', 'deep-c-leaf'),
        createEdge('shallow', 'shallow-leaf'),
    ];

    return { nodes, edges, spacing: DEFAULT_SPACING };
}

export function countLayoutOverlaps(nodes: Node[], positions: Map<string, LayoutPoint>): number {
    const rects = getRects(nodes, positions);
    let overlaps = 0;

    for (let leftIndex = 0; leftIndex < rects.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < rects.length; rightIndex += 1) {
            if (rectsOverlap(rects[leftIndex], rects[rightIndex])) {
                overlaps += 1;
            }
        }
    }

    return overlaps;
}

export function getOccupiedBounds(
    nodes: Node[],
    positions: Map<string, LayoutPoint>,
    nodeIds?: Iterable<string>,
): LayoutBounds {
    const allowedIds = nodeIds ? new Set(nodeIds) : null;
    const rects = getRects(nodes, positions).filter((rect) => !allowedIds || allowedIds.has(rect.id));
    return calculateBounds(rects);
}

export function measureVerticalSpan(
    nodes: Node[],
    positions: Map<string, LayoutPoint>,
    nodeIds?: Iterable<string>,
): number {
    return getOccupiedBounds(nodes, positions, nodeIds).height;
}

export function collectSubtreeNodeIds(rootId: string, edges: Edge[]): string[] {
    const childrenMap = new Map<string, string[]>();
    edges.forEach((edge) => {
        if (!childrenMap.has(edge.source)) {
            childrenMap.set(edge.source, []);
        }
        childrenMap.get(edge.source)?.push(edge.target);
    });

    const seen = new Set<string>([rootId]);
    const queue = [rootId];

    while (queue.length > 0) {
        const current = queue.shift()!;
        const children = childrenMap.get(current) ?? [];

        for (const child of children) {
            if (seen.has(child)) {
                continue;
            }
            seen.add(child);
            queue.push(child);
        }
    }

    return Array.from(seen);
}

export function layoutBoundingBoxBaseline(
    nodes: Node[],
    edges: Edge[],
    spacing: number,
): Map<string, LayoutPoint> {
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const nodeOrder = new Map(nodes.map((node, index) => [node.id, index]));
    const childrenMap = new Map<string, string[]>();
    const incomingCount = new Map<string, number>();

    nodes.forEach((node) => {
        childrenMap.set(node.id, []);
        incomingCount.set(node.id, 0);
    });

    edges
        .filter((edge) => nodeMap.has(edge.source) && nodeMap.has(edge.target))
        .forEach((edge) => {
            childrenMap.get(edge.source)?.push(edge.target);
            incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1);
        });

    childrenMap.forEach((childIds) => {
        childIds.sort((leftId, rightId) => (nodeOrder.get(leftId) ?? 0) - (nodeOrder.get(rightId) ?? 0));
    });

    const rootIds = nodes
        .filter((node) => (incomingCount.get(node.id) ?? 0) === 0)
        .map((node) => node.id);

    const cache = new Map<string, BaselineSubtree>();

    function layoutSubtree(rootId: string): BaselineSubtree {
        const cached = cache.get(rootId);
        if (cached) {
            return cached;
        }

        const node = nodeMap.get(rootId);
        if (!node) {
            const empty: BaselineSubtree = {
                positions: new Map(),
                rects: [],
                bounds: emptyBounds(),
            };
            cache.set(rootId, empty);
            return empty;
        }

        const { width, height } = getNodeDimensions(node);
        const rects: FixtureRect[] = [{ id: rootId, x: 0, y: 0, width, height }];
        const positions = new Map<string, LayoutPoint>([[rootId, { x: 0, y: 0 }]]);
        const childIds = childrenMap.get(rootId) ?? [];
        const childLayouts = childIds.map((childId) => layoutSubtree(childId));

        if (childLayouts.length > 0) {
            const placements = placeByBounds(childLayouts, {
                baseX: width + getHorizontalGap(spacing),
                anchorCenterY: height / 2,
                verticalGap: getVerticalGap(spacing),
            });

            for (const placement of placements) {
                for (const [nodeId, point] of placement.layout.positions) {
                    positions.set(nodeId, {
                        x: point.x + placement.x,
                        y: point.y + placement.y,
                    });
                }
                rects.push(...shiftRects(placement.layout.rects, placement.x, placement.y));
            }
        }

        const layout = {
            positions,
            rects,
            bounds: calculateBounds(rects),
        };
        cache.set(rootId, layout);
        return layout;
    }

    const placements = placeByBounds(
        (rootIds.length > 0 ? rootIds : nodes.map((node) => node.id)).map((rootId) => layoutSubtree(rootId)),
        {
            baseX: Math.max(12, Math.round(sanitizeSpacing(spacing) * 0.3)),
            anchorCenterY: 0,
            verticalGap: getVerticalGap(spacing),
        },
    );

    const positions = new Map<string, LayoutPoint>();
    const rects: FixtureRect[] = [];

    for (const placement of placements) {
        for (const [nodeId, point] of placement.layout.positions) {
            positions.set(nodeId, {
                x: point.x + placement.x,
                y: point.y + placement.y,
            });
        }
        rects.push(...shiftRects(placement.layout.rects, placement.x, placement.y));
    }

    if (rects.length === 0) {
        return positions;
    }

    const bounds = calculateBounds(rects);
    return new Map(
        Array.from(positions.entries()).map(([nodeId, point]) => [
            nodeId,
            {
                x: point.x - bounds.minX,
                y: point.y - bounds.minY,
            },
        ]),
    );
}

function placeByBounds(
    layouts: BaselineSubtree[],
    options: { baseX: number; anchorCenterY: number; verticalGap: number },
): Array<{ layout: BaselineSubtree; x: number; y: number }> {
    const placements: Array<{ layout: BaselineSubtree; x: number; y: number }> = [];
    let cursorY = 0;

    for (const layout of layouts) {
        placements.push({
            layout,
            x: options.baseX,
            y: cursorY,
        });
        cursorY += layout.bounds.height + options.verticalGap;
    }

    const rects = placements.flatMap((placement) => shiftRects(placement.layout.rects, placement.x, placement.y));
    const bounds = calculateBounds(rects);
    const shiftY = options.anchorCenterY - ((bounds.minY + bounds.maxY) / 2);

    return placements.map((placement) => ({
        ...placement,
        y: placement.y + shiftY,
    }));
}

function getRects(nodes: Node[], positions: Map<string, LayoutPoint>): FixtureRect[] {
    return nodes.flatMap((node) => {
        const position = positions.get(node.id);
        if (!position) {
            return [];
        }

        const { width, height } = getNodeDimensions(node);
        return [{ id: node.id, x: position.x, y: position.y, width, height }];
    });
}

function shiftRects(rects: FixtureRect[], dx: number, dy: number): FixtureRect[] {
    return rects.map((rect) => ({
        ...rect,
        x: rect.x + dx,
        y: rect.y + dy,
    }));
}

function calculateBounds(rects: FixtureRect[]): LayoutBounds {
    if (rects.length === 0) {
        return emptyBounds();
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    rects.forEach((rect) => {
        minX = Math.min(minX, rect.x);
        minY = Math.min(minY, rect.y);
        maxX = Math.max(maxX, rect.x + rect.width);
        maxY = Math.max(maxY, rect.y + rect.height);
    });

    return {
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX,
        height: maxY - minY,
    };
}

function rectsOverlap(left: FixtureRect, right: FixtureRect): boolean {
    return left.x < right.x + right.width
        && right.x < left.x + left.width
        && left.y < right.y + right.height
        && right.y < left.y + left.height;
}

function createNode(id: string, width: number, height: number): Node {
    return {
        id,
        position: { x: 0, y: 0 },
        data: { width, height, groupId: 'fixture-group' },
    } as unknown as Node;
}

function createEdge(source: string, target: string): Edge {
    return {
        id: `${source}->${target}`,
        source,
        target,
    } as Edge;
}

function getHorizontalGap(spacing: number): number {
    return Math.max(28, Math.round(sanitizeSpacing(spacing) * BASE_HORIZONTAL_GAP_RATIO));
}

function getVerticalGap(spacing: number): number {
    return Math.max(14, Math.round(sanitizeSpacing(spacing) * BASE_VERTICAL_GAP_RATIO));
}

function sanitizeSpacing(spacing: number): number {
    return Number.isFinite(spacing) && spacing > 0 ? spacing : DEFAULT_SPACING;
}

function emptyBounds(): LayoutBounds {
    return {
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0,
        width: 0,
        height: 0,
    };
}
