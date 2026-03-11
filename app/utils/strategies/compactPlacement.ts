import type { Edge, Node } from 'reactflow';
import { getNodeDimensions } from '../layoutUtils';
import type {
    LayoutBounds,
    LayoutDirection,
    LayoutGroupResult,
    LayoutPoint,
    SiblingPlacementFrame,
} from './types';

interface LayoutRect extends LayoutPoint {
    id: string;
    width: number;
    height: number;
}

interface GraphIndex {
    nodes: Node[];
    nodeMap: Map<string, Node>;
    childrenMap: Map<string, string[]>;
    rootIds: string[];
}

interface SubtreeLayout {
    rootId: string;
    rootWidth: number;
    rootHeight: number;
    positions: Map<string, LayoutPoint>;
    rects: LayoutRect[];
    bounds: LayoutBounds;
}

interface PlacedSubtree {
    layout: SubtreeLayout;
    x: number;
    y: number;
}

interface PlacementOptions {
    baseX: number;
    anchorCenterY: number;
    verticalGap: number;
    fanStep: number;
}

interface CardinalPlacementOptions {
    parentWidth: number;
    parentHeight: number;
    outwardGap: number;
    crossGap: number;
    spacing: number;
}

type SectorDirection = 'right' | 'left' | 'up' | 'down';

interface SectorEntry {
    layout: SubtreeLayout;
    direction: SectorDirection;
    order: number;
}

const DEFAULT_SPACING = 60;
const MIN_HORIZONTAL_GAP = 28;
const MIN_VERTICAL_GAP = 14;
const CHILD_HORIZONTAL_GAP_RATIO = 0.9;
const CHILD_VERTICAL_GAP_RATIO = 0.28;
const ROOT_CLUSTER_GAP_RATIO = 0.3;
const FANOUT_RATIO = 0.4;
const ROOT_CLUSTER_FANOUT_RATIO = 0.95;
const ROOT_CLUSTER_FRAME_PARENT_ID = '__root_cluster__';

export function runCompactLayout(
    nodes: Node[],
    edges: Edge[],
    spacing: number,
    direction: LayoutDirection = 'right',
): Map<string, LayoutPoint> {
    return runCompactLayoutDetailed(nodes, edges, spacing, direction).positions;
}

export function runCompactLayoutDetailed(
    nodes: Node[],
    edges: Edge[],
    spacing: number,
    direction: LayoutDirection = 'right',
): LayoutGroupResult {
    const graph = buildGraphIndex(nodes, edges);
    if (graph.nodes.length === 0) {
        return {
            positions: new Map(),
            placementFrames: [],
        };
    }

    const cache = new Map<string, SubtreeLayout>();
    const subtreeLayouts: SubtreeLayout[] = [];
    const coveredNodeIds = new Set<string>();
    const placementFrames: SiblingPlacementFrame[] = [];

    for (const rootId of graph.rootIds) {
        const layout = layoutSubtree(rootId, graph, cache, spacing, placementFrames, true);
        subtreeLayouts.push(layout);
        layout.positions.forEach((_, nodeId) => coveredNodeIds.add(nodeId));
    }

    for (const node of graph.nodes) {
        if (coveredNodeIds.has(node.id)) {
            continue;
        }
        const layout = layoutSubtree(node.id, graph, cache, spacing, placementFrames, true);
        subtreeLayouts.push(layout);
        layout.positions.forEach((_, nodeId) => coveredNodeIds.add(nodeId));
    }

    const forestOutwardGap = Math.max(12, Math.round(sanitizeSpacing(spacing) * ROOT_CLUSTER_GAP_RATIO));
    const forestFanStep = getFanStep(subtreeLayouts, spacing, ROOT_CLUSTER_FANOUT_RATIO);
    const forestPlacements = subtreeLayouts.length > 1
        ? placeSiblingGroup(subtreeLayouts, {
            baseX: forestOutwardGap,
            anchorCenterY: 0,
            verticalGap: getVerticalGap(spacing),
            fanStep: forestFanStep,
        })
        : subtreeLayouts.map((layout) => ({ layout, x: 0, y: 0 }));

    placementFrames.push(
        createPlacementFrame(
            ROOT_CLUSTER_FRAME_PARENT_ID,
            forestPlacements,
            getSpreadFactor(subtreeLayouts, forestFanStep, spacing),
        ),
    );

    const positions = new Map<string, LayoutPoint>();
    const rects: LayoutRect[] = [];

    for (const placement of forestPlacements) {
        for (const [nodeId, point] of placement.layout.positions) {
            positions.set(nodeId, {
                x: point.x + placement.x,
                y: point.y + placement.y,
            });
        }

        rects.push(...shiftRects(placement.layout.rects, placement.x, placement.y));
    }

    return {
        positions: transformDirection(normalizeLayout(positions, rects), graph.nodeMap, direction),
        placementFrames,
    };
}

function buildGraphIndex(nodes: Node[], edges: Edge[]): GraphIndex {
    const nodeMap = new Map(nodes.map((node) => [node.id, node]));
    const nodeOrder = new Map(nodes.map((node, index) => [node.id, index]));
    const validEdges = edges.filter((edge) => nodeMap.has(edge.source) && nodeMap.has(edge.target));
    const incomingCount = new Map<string, number>();
    const childrenMap = new Map<string, string[]>();

    for (const node of nodes) {
        incomingCount.set(node.id, 0);
        childrenMap.set(node.id, []);
    }

    for (const edge of validEdges) {
        incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1);
        childrenMap.get(edge.source)?.push(edge.target);
    }

    for (const childIds of childrenMap.values()) {
        childIds.sort((leftId, rightId) => (nodeOrder.get(leftId) ?? 0) - (nodeOrder.get(rightId) ?? 0));
    }

    const rootIds = nodes
        .filter((node) => (incomingCount.get(node.id) ?? 0) === 0)
        .map((node) => node.id);

    if (rootIds.length === 0 && nodes.length > 0) {
        rootIds.push(nodes[0].id);
    }

    return {
        nodes,
        nodeMap,
        childrenMap,
        rootIds,
    };
}

function layoutSubtree(
    rootId: string,
    graph: GraphIndex,
    cache: Map<string, SubtreeLayout>,
    spacing: number,
    placementFrames: SiblingPlacementFrame[],
    isTopLevelRoot: boolean,
): SubtreeLayout {
    const cached = cache.get(rootId);
    if (cached) {
        return cached;
    }

    const node = graph.nodeMap.get(rootId);
    if (!node) {
        const emptyLayout: SubtreeLayout = {
            rootId,
            rootWidth: 0,
            rootHeight: 0,
            positions: new Map(),
            rects: [],
            bounds: emptyBounds(),
        };
        cache.set(rootId, emptyLayout);
        return emptyLayout;
    }

    const { width, height } = getNodeDimensions(node);
    const childIds = graph.childrenMap.get(rootId) ?? [];
    const childLayouts = childIds.map((childId) =>
        layoutSubtree(childId, graph, cache, spacing, placementFrames, false),
    );

    const positions = new Map<string, LayoutPoint>([[rootId, { x: 0, y: 0 }]]);
    const rects: LayoutRect[] = [{ id: rootId, x: 0, y: 0, width, height }];

    if (childLayouts.length > 0) {
        const fanStep = getFanStep(childLayouts, spacing, FANOUT_RATIO);
        const placements = isTopLevelRoot && childLayouts.length > 1
            ? placeCardinalGroup(childLayouts, {
                parentWidth: width,
                parentHeight: height,
                outwardGap: getHorizontalGap(spacing),
                crossGap: getVerticalGap(spacing),
                spacing,
            })
            : placeSiblingGroup(childLayouts, {
                baseX: width + getHorizontalGap(spacing),
                anchorCenterY: height / 2,
                verticalGap: getVerticalGap(spacing),
                fanStep,
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

        placementFrames.push(
            createPlacementFrame(
                rootId,
                placements,
                getSpreadFactor(
                    childLayouts,
                    isTopLevelRoot ? getHorizontalGap(spacing) : fanStep,
                    spacing,
                ),
            ),
        );
    }

    const layout: SubtreeLayout = {
        rootId,
        rootWidth: width,
        rootHeight: height,
        positions,
        rects,
        bounds: calculateBounds(rects),
    };

    cache.set(rootId, layout);
    return layout;
}

function placeCardinalGroup(
    layouts: SubtreeLayout[],
    options: CardinalPlacementOptions,
): PlacedSubtree[] {
    if (layouts.length === 0) {
        return [];
    }

    if (layouts.length === 1) {
        return [{ layout: layouts[0], x: 0, y: 0 }];
    }

    const directions: SectorDirection[] = ['right', 'left', 'up', 'down'];
    const buckets = new Map<SectorDirection, SectorEntry[]>(
        directions.map((direction) => [direction, []]),
    );
    const bucketLoad = new Map<SectorDirection, number>(
        directions.map((direction) => [direction, 0]),
    );

    const sortedLayouts = [...layouts]
        .map((layout, order) => ({ layout, order }))
        .sort(
            ({ layout: leftLayout }, { layout: rightLayout }) =>
                (rightLayout.bounds.width * rightLayout.bounds.height)
                - (leftLayout.bounds.width * leftLayout.bounds.height),
        );

    for (const entry of sortedLayouts) {
        let selectedDirection = directions[0];
        for (const direction of directions.slice(1)) {
            if ((bucketLoad.get(direction) ?? 0) < (bucketLoad.get(selectedDirection) ?? 0)) {
                selectedDirection = direction;
            }
        }

        buckets.get(selectedDirection)?.push({
            layout: orientSubtreeLayout(entry.layout, selectedDirection),
            direction: selectedDirection,
            order: entry.order,
        });
        bucketLoad.set(
            selectedDirection,
            (bucketLoad.get(selectedDirection) ?? 0) + (entry.layout.bounds.width * entry.layout.bounds.height),
        );
    }

    directions.forEach((direction) => {
        buckets.get(direction)?.sort((left, right) => left.order - right.order);
    });

    const placements = [
        ...placeVerticalSector(buckets.get('right') ?? [], 'right', options),
        ...placeVerticalSector(buckets.get('left') ?? [], 'left', options),
        ...placeHorizontalSector(buckets.get('up') ?? [], 'up', options),
        ...placeHorizontalSector(buckets.get('down') ?? [], 'down', options),
    ];

    return placements
        .sort((left, right) => left.order - right.order)
        .map(({ order: _order, ...placement }) => placement);
}

function placeVerticalSector(
    entries: SectorEntry[],
    direction: 'right' | 'left',
    options: CardinalPlacementOptions,
): Array<PlacedSubtree & { order: number }> {
    if (entries.length === 0) {
        return [];
    }

    const totalHeight = entries.reduce((sum, entry) => sum + entry.layout.bounds.height, 0)
        + (entries.length - 1) * options.crossGap;
    let cursor = (options.parentHeight / 2) - (totalHeight / 2);

    return entries.map((entry) => {
        const x = direction === 'right'
            ? options.parentWidth + options.outwardGap
            : -options.outwardGap - entry.layout.rootWidth;
        const y = cursor - entry.layout.bounds.minY;
        cursor += entry.layout.bounds.height + options.crossGap;
        return {
            layout: entry.layout,
            x,
            y,
            order: entry.order,
        };
    });
}

function placeHorizontalSector(
    entries: SectorEntry[],
    direction: 'up' | 'down',
    options: CardinalPlacementOptions,
): Array<PlacedSubtree & { order: number }> {
    if (entries.length === 0) {
        return [];
    }

    const totalWidth = entries.reduce((sum, entry) => sum + entry.layout.bounds.width, 0)
        + (entries.length - 1) * options.crossGap;
    let cursor = (options.parentWidth / 2) - (totalWidth / 2);

    return entries.map((entry) => {
        const x = cursor - entry.layout.bounds.minX;
        const y = direction === 'down'
            ? options.parentHeight + options.outwardGap
            : -options.outwardGap - entry.layout.rootHeight;
        cursor += entry.layout.bounds.width + options.crossGap;
        return {
            layout: entry.layout,
            x,
            y,
            order: entry.order,
        };
    });
}

function orientSubtreeLayout(
    layout: SubtreeLayout,
    direction: SectorDirection,
): SubtreeLayout {
    if (direction === 'right') {
        return layout;
    }

    const rects = layout.rects.map((rect) => orientRect(rect, layout, direction));

    return {
        ...layout,
        positions: new Map(rects.map((rect) => [rect.id, { x: rect.x, y: rect.y }])),
        rects,
        bounds: calculateBounds(rects),
    };
}

function orientRect(
    rect: LayoutRect,
    layout: SubtreeLayout,
    direction: Exclude<SectorDirection, 'right'>,
): LayoutRect {
    if (rect.id === layout.rootId) {
        return {
            ...rect,
            x: 0,
            y: 0,
        };
    }

    switch (direction) {
        case 'left':
            return {
                ...rect,
                x: layout.rootWidth - rect.x - rect.width,
                y: rect.y,
            };
        case 'up':
            return {
                ...rect,
                x: rect.y,
                y: layout.rootWidth - rect.x - rect.height,
            };
        case 'down':
            return {
                ...rect,
                x: rect.y,
                y: rect.x - layout.rootWidth + layout.rootHeight,
            };
        default:
            return rect;
    }
}

function createPlacementFrame(
    parentId: string,
    placements: PlacedSubtree[],
    spreadFactor: number,
): SiblingPlacementFrame {
    const shiftedRects = placements.flatMap((placement) =>
        shiftRects(placement.layout.rects, placement.x, placement.y),
    );
    const bounds = calculateBounds(shiftedRects);

    return {
        parentId,
        childOrder: placements.map((placement) => placement.layout.rootId),
        placements: new Map(
            placements.map((placement) => [
                placement.layout.rootId,
                { x: placement.x, y: placement.y } satisfies LayoutPoint,
            ]),
        ),
        clusterWidth: bounds.width,
        clusterHeight: bounds.height,
        spreadFactor,
    };
}

function placeSiblingGroup(layouts: SubtreeLayout[], options: PlacementOptions): PlacedSubtree[] {
    if (layouts.length === 0) {
        return [];
    }

    const placedRects: LayoutRect[] = [];
    const placements: PlacedSubtree[] = [];
    const centeredMidpoint = (layouts.length - 1) / 2;

    for (let index = 0; index < layouts.length; index += 1) {
        const layout = layouts[index];
        const centeredIndex = Math.abs(index - centeredMidpoint);
        const x = options.baseX + centeredIndex * options.fanStep;
        const candidateRects = shiftRects(layout.rects, x, 0);
        const y = placedRects.length === 0
            ? 0
            : computeContourVerticalOffset(placedRects, candidateRects, options.verticalGap);

        placements.push({ layout, x, y });
        placedRects.push(...shiftRects(layout.rects, x, y));
    }

    const packedBounds = calculateBounds(placedRects);
    const clusterShiftY = options.anchorCenterY - ((packedBounds.minY + packedBounds.maxY) / 2);

    return placements.map((placement) => ({
        ...placement,
        y: placement.y + clusterShiftY,
    }));
}

function computeContourVerticalOffset(
    placedRects: LayoutRect[],
    candidateRects: LayoutRect[],
    gap: number,
): number {
    let requiredOffset = 0;

    for (const placed of placedRects) {
        for (const candidate of candidateRects) {
            if (!rangesOverlap(placed.x, placed.x + placed.width, candidate.x, candidate.x + candidate.width)) {
                continue;
            }

            requiredOffset = Math.max(
                requiredOffset,
                placed.y + placed.height + gap - candidate.y,
            );
        }
    }

    return requiredOffset;
}

function normalizeLayout(
    positions: Map<string, LayoutPoint>,
    rects: LayoutRect[],
): Map<string, LayoutPoint> {
    if (positions.size === 0 || rects.length === 0) {
        return positions;
    }

    const bounds = calculateBounds(rects);
    const normalized = new Map<string, LayoutPoint>();

    for (const [nodeId, point] of positions) {
        normalized.set(nodeId, {
            x: point.x - bounds.minX,
            y: point.y - bounds.minY,
        });
    }

    return normalized;
}

function transformDirection(
    positions: Map<string, LayoutPoint>,
    nodeMap: Map<string, Node>,
    direction: LayoutDirection,
): Map<string, LayoutPoint> {
    if (direction === 'right' || positions.size === 0) {
        return positions;
    }

    const rects = Array.from(positions.entries())
        .map(([nodeId, point]) => {
            const node = nodeMap.get(nodeId);
            if (!node) {
                return null;
            }
            const { width, height } = getNodeDimensions(node);
            return {
                id: nodeId,
                x: point.x,
                y: point.y,
                width,
                height,
            } satisfies LayoutRect;
        })
        .filter((rect): rect is LayoutRect => rect !== null);

    const bounds = calculateBounds(rects);
    const transformed = new Map<string, LayoutPoint>();

    for (const [nodeId, point] of positions) {
        const node = nodeMap.get(nodeId);
        if (!node) {
            continue;
        }

        const { width } = getNodeDimensions(node);

        switch (direction) {
            case 'left':
                transformed.set(nodeId, {
                    x: bounds.width - (point.x + width),
                    y: point.y,
                });
                break;
            case 'down':
                transformed.set(nodeId, {
                    x: point.y,
                    y: point.x,
                });
                break;
            case 'up':
                transformed.set(nodeId, {
                    x: point.y,
                    y: bounds.width - (point.x + width),
                });
                break;
            default:
                transformed.set(nodeId, point);
                break;
        }
    }

    return transformed;
}

function shiftRects(rects: LayoutRect[], dx: number, dy: number): LayoutRect[] {
    return rects.map((rect) => ({
        ...rect,
        x: rect.x + dx,
        y: rect.y + dy,
    }));
}

function calculateBounds(rects: LayoutRect[]): LayoutBounds {
    if (rects.length === 0) {
        return emptyBounds();
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const rect of rects) {
        minX = Math.min(minX, rect.x);
        minY = Math.min(minY, rect.y);
        maxX = Math.max(maxX, rect.x + rect.width);
        maxY = Math.max(maxY, rect.y + rect.height);
    }

    return {
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX,
        height: maxY - minY,
    };
}

function getHorizontalGap(spacing: number): number {
    return Math.max(MIN_HORIZONTAL_GAP, Math.round(sanitizeSpacing(spacing) * CHILD_HORIZONTAL_GAP_RATIO));
}

function getVerticalGap(spacing: number): number {
    return Math.max(MIN_VERTICAL_GAP, Math.round(sanitizeSpacing(spacing) * CHILD_VERTICAL_GAP_RATIO));
}

function getFanStep(layouts: SubtreeLayout[], spacing: number, ratio: number): number {
    if (layouts.length <= 1) {
        return 0;
    }

    const averageRootWidth = layouts.reduce((sum, layout) => sum + layout.rootWidth, 0) / layouts.length;
    const averageBoundsHeight = layouts.reduce((sum, layout) => sum + layout.bounds.height, 0) / layouts.length;

    return Math.max(
        Math.round(sanitizeSpacing(spacing) * ratio),
        Math.round(averageRootWidth * 1.1),
        Math.round(averageBoundsHeight * 0.12),
    );
}

function getSpreadFactor(layouts: SubtreeLayout[], fanStep: number, spacing: number): number {
    if (layouts.length <= 1 || fanStep <= 0) {
        return 0;
    }

    const averageRootWidth = layouts.reduce((sum, layout) => sum + layout.rootWidth, 0) / layouts.length;
    const averageBoundsHeight = layouts.reduce((sum, layout) => sum + layout.bounds.height, 0) / layouts.length;
    const denominator = Math.max(
        1,
        averageRootWidth + (averageBoundsHeight * 0.25) + (sanitizeSpacing(spacing) * 0.5),
    );

    return Number(Math.max(0, Math.min(1, fanStep / denominator)).toFixed(4));
}

function sanitizeSpacing(spacing: number): number {
    return Number.isFinite(spacing) && spacing > 0 ? spacing : DEFAULT_SPACING;
}

function rangesOverlap(startA: number, endA: number, startB: number, endB: number): boolean {
    return startA < endB && startB < endA;
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
