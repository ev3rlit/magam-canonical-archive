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
    direction?: LayoutDirection;
}

interface PlacementOptions {
    baseX: number;
    anchorCenterY: number;
    verticalGap: number;
    fanStep: number;
}

interface VerticalPlacementOptions {
    baseY: number;
    anchorCenterX: number;
    horizontalGap: number;
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
type NativeLayoutDirection = 'right' | 'down';

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
        const layout = layoutSubtree(rootId, graph, cache, spacing, placementFrames, 'right', true);
        subtreeLayouts.push(layout);
        layout.positions.forEach((_, nodeId) => coveredNodeIds.add(nodeId));
    }

    for (const node of graph.nodes) {
        if (coveredNodeIds.has(node.id)) {
            continue;
        }
        const layout = layoutSubtree(node.id, graph, cache, spacing, placementFrames, 'right', true);
        subtreeLayouts.push(layout);
        layout.positions.forEach((_, nodeId) => coveredNodeIds.add(nodeId));
    }

    const forestOutwardGap = Math.max(12, Math.round(sanitizeSpacing(spacing) * ROOT_CLUSTER_GAP_RATIO));
    const forestFanStep = getFanStep(subtreeLayouts, spacing, ROOT_CLUSTER_FANOUT_RATIO);
    const forestPlacements = subtreeLayouts.length > 1
        ? placeRightwardSiblingGroup(subtreeLayouts, {
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
    direction: LayoutDirection,
    isTopLevelRoot: boolean,
): SubtreeLayout {
    const cacheKey = getLayoutCacheKey(rootId, direction, isTopLevelRoot);
    const cached = cache.get(cacheKey);
    if (cached) {
        return cached;
    }

    if (direction === 'left' || direction === 'up') {
        const baseLayout = layoutSubtree(
            rootId,
            graph,
            cache,
            spacing,
            placementFrames,
            direction === 'left' ? 'right' : 'down',
            isTopLevelRoot,
        );
        const mirroredLayout = mirrorSubtreeLayout(baseLayout, direction);
        cache.set(cacheKey, mirroredLayout);
        return mirroredLayout;
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
        cache.set(cacheKey, emptyLayout);
        return emptyLayout;
    }

    const { width, height } = getNodeDimensions(node);
    const childIds = graph.childrenMap.get(rootId) ?? [];

    const positions = new Map<string, LayoutPoint>([[rootId, { x: 0, y: 0 }]]);
    const rects: LayoutRect[] = [{ id: rootId, x: 0, y: 0, width, height }];

    if (childIds.length > 0) {
        const useCardinalPlacement = isTopLevelRoot && childIds.length >= 4;
        const childEntries = useCardinalPlacement
            ? buildBalancedCardinalEntries(childIds, graph, cache, spacing, placementFrames)
            : childIds.map((childId, order) => ({
                layout: layoutSubtree(childId, graph, cache, spacing, placementFrames, direction, false),
                direction,
                order,
            }));
        const childLayouts = childEntries.map((entry) => entry.layout);
        const fanStep = getFanStep(childLayouts, spacing, FANOUT_RATIO);
        const placements = useCardinalPlacement
            ? placeCardinalGroup(childEntries, {
                parentWidth: width,
                parentHeight: height,
                outwardGap: getHorizontalGap(spacing),
                crossGap: getVerticalGap(spacing),
                spacing,
            })
            : placeDirectedSiblingGroup(
                childLayouts,
                direction,
                {
                    baseX: width + getHorizontalGap(spacing),
                    anchorCenterY: height / 2,
                    verticalGap: getVerticalGap(spacing),
                    fanStep,
                },
                {
                    baseY: height + getHorizontalGap(spacing),
                    anchorCenterX: width / 2,
                    horizontalGap: getVerticalGap(spacing),
                    fanStep,
                },
            );

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
                    useCardinalPlacement ? getHorizontalGap(spacing) : fanStep,
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

    cache.set(cacheKey, layout);
    return layout;
}

function getLayoutCacheKey(
    rootId: string,
    direction: LayoutDirection,
    isTopLevelRoot: boolean,
): string {
    return `${rootId}:${direction}:${isTopLevelRoot ? 'root' : 'subtree'}`;
}

function buildBalancedCardinalEntries(
    childIds: string[],
    graph: GraphIndex,
    cache: Map<string, SubtreeLayout>,
    spacing: number,
    placementFrames: SiblingPlacementFrame[],
): SectorEntry[] {
    const evaluatedChildren = childIds.map((childId, order) => ({
        childId,
        order,
        layout: layoutSubtree(childId, graph, cache, spacing, placementFrames, 'right', false),
    }));
    const directionAssignments = assignBalancedCardinalDirections(evaluatedChildren);

    return evaluatedChildren.map((entry) => ({
        layout: layoutSubtree(
            entry.childId,
            graph,
            cache,
            spacing,
            placementFrames,
            directionAssignments.get(entry.childId) ?? 'right',
            false,
        ),
        direction: directionAssignments.get(entry.childId) ?? 'right',
        order: entry.order,
    }));
}

function assignBalancedCardinalDirections(
    entries: Array<{ childId: string; order: number; layout: SubtreeLayout }>,
): Map<string, SectorDirection> {
    const directions: SectorDirection[] = ['up', 'right', 'down', 'left'];
    const directionCounts = new Map<SectorDirection, number>(
        directions.map((direction) => [direction, 0]),
    );
    const directionLoads = new Map<SectorDirection, number>(
        directions.map((direction) => [direction, 0]),
    );
    const assignments = new Map<string, SectorDirection>();
    const sortedEntries = [...entries].sort(
        (left, right) =>
            getLayoutWeight(right.layout) - getLayoutWeight(left.layout)
            || left.order - right.order,
    );

    for (const entry of sortedEntries) {
        const minimumCount = Math.min(...directions.map((direction) => directionCounts.get(direction) ?? 0));
        const eligibleDirections = directions.filter(
            (direction) => (directionCounts.get(direction) ?? 0) === minimumCount,
        );
        let selectedDirection = eligibleDirections[0];

        for (const direction of eligibleDirections.slice(1)) {
            const selectedLoad = directionLoads.get(selectedDirection) ?? 0;
            const candidateLoad = directionLoads.get(direction) ?? 0;
            if (candidateLoad < selectedLoad) {
                selectedDirection = direction;
            }
        }

        assignments.set(entry.childId, selectedDirection);
        directionCounts.set(selectedDirection, (directionCounts.get(selectedDirection) ?? 0) + 1);
        directionLoads.set(
            selectedDirection,
            (directionLoads.get(selectedDirection) ?? 0) + getLayoutWeight(entry.layout),
        );
    }

    return assignments;
}

function getLayoutWeight(layout: SubtreeLayout): number {
    return Math.max(1, layout.bounds.width * layout.bounds.height);
}

function placeCardinalGroup(
    entries: SectorEntry[],
    options: CardinalPlacementOptions,
): PlacedSubtree[] {
    if (entries.length === 0) {
        return [];
    }

    if (entries.length === 1) {
        return [{ layout: entries[0].layout, x: 0, y: 0, direction: entries[0].direction }];
    }

    const directions: SectorDirection[] = ['up', 'right', 'down', 'left'];
    const buckets = new Map<SectorDirection, SectorEntry[]>(
        directions.map((direction) => [direction, []]),
    );

    for (const entry of entries) {
        buckets.get(entry.direction)?.push(entry);
    }

    directions.forEach((direction) => {
        buckets.get(direction)?.sort((left, right) => left.order - right.order);
    });

    const initialUpPlacements = placeHorizontalSector(buckets.get('up') ?? [], 'up', options);
    const initialDownPlacements = placeHorizontalSector(buckets.get('down') ?? [], 'down', options);
    const centerBand = getPlacedRootBounds([...initialUpPlacements, ...initialDownPlacements]);
    const rightPlacements = shiftPlacedGroupXToClearBand(
        placeVerticalSector(buckets.get('right') ?? [], 'right', options),
        centerBand,
        'right',
        options.crossGap,
    );
    const leftPlacements = shiftPlacedGroupXToClearBand(
        placeVerticalSector(buckets.get('left') ?? [], 'left', options),
        centerBand,
        'left',
        options.crossGap,
    );
    const sidePlacements = [...rightPlacements, ...leftPlacements];

    const upPlacements = shiftPlacedGroupVerticallyToAvoidOverlaps(
        initialUpPlacements,
        sidePlacements,
        'up',
        options.crossGap,
    );

    const downPlacements = shiftPlacedGroupVerticallyToAvoidOverlaps(
        initialDownPlacements,
        sidePlacements,
        'down',
        options.crossGap,
    );
    const relaxedRightPlacements = relaxSidePlacementsTowardRoot(
        rightPlacements,
        [...upPlacements, ...downPlacements],
        'right',
        options.crossGap,
        options.parentWidth,
        options.parentHeight,
    );
    const relaxedLeftPlacements = relaxSidePlacementsTowardRoot(
        leftPlacements,
        [...upPlacements, ...downPlacements],
        'left',
        options.crossGap,
        options.parentWidth,
        options.parentHeight,
    );

    const placements = [
        ...relaxedRightPlacements,
        ...relaxedLeftPlacements,
        ...upPlacements,
        ...downPlacements,
    ];

    return placements
        .sort((left, right) => left.order - right.order)
        .map(({ order: _order, ...placement }) => placement);
}

function shiftPlacedGroupVerticallyToAvoidOverlaps(
    placements: Array<PlacedSubtree & { order: number }>,
    referencePlacements: Array<PlacedSubtree & { order: number }>,
    direction: 'up' | 'down',
    gap: number,
): Array<PlacedSubtree & { order: number }> {
    if (placements.length === 0 || referencePlacements.length === 0) {
        return placements;
    }

    const rootDeltaY = resolveVerticalClearanceDelta(
        getPlacedRootRects(placements),
        getPlacedRootRects(referencePlacements),
        direction,
        gap,
    );
    const rootShiftedPlacements = rootDeltaY === 0
        ? placements
        : placements.map((placement) => ({
            ...placement,
            y: placement.y + rootDeltaY,
        }));
    const overlapDeltaY = resolveVerticalOverlapDelta(
        rootShiftedPlacements.flatMap((placement) => shiftRects(placement.layout.rects, placement.x, placement.y)),
        referencePlacements.flatMap((placement) => shiftRects(placement.layout.rects, placement.x, placement.y)),
        direction,
        gap,
    );

    if (overlapDeltaY === 0) {
        return rootShiftedPlacements;
    }

    return rootShiftedPlacements.map((placement) => ({
        ...placement,
        y: placement.y + overlapDeltaY,
    }));
}

function shiftPlacedGroupXToClearBand(
    placements: Array<PlacedSubtree & { order: number }>,
    band: LayoutBounds | null,
    direction: 'left' | 'right',
    gap: number,
): Array<PlacedSubtree & { order: number }> {
    if (placements.length === 0 || !band) {
        return placements;
    }

    const rootBounds = getPlacedRootBounds(placements);
    if (!rootBounds) {
        return placements;
    }

    const deltaX = direction === 'left'
        ? Math.min(0, (band.minX - gap) - rootBounds.maxX)
        : Math.max(0, (band.maxX + gap) - rootBounds.minX);

    if (deltaX === 0) {
        return placements;
    }

    return placements.map((placement) => ({
        ...placement,
        x: placement.x + deltaX,
    }));
}

function relaxSidePlacementsTowardRoot(
    placements: Array<PlacedSubtree & { order: number }>,
    referencePlacements: Array<PlacedSubtree & { order: number }>,
    direction: 'left' | 'right',
    gap: number,
    parentWidth: number,
    parentHeight: number,
): Array<PlacedSubtree & { order: number }> {
    if (placements.length === 0) {
        return placements;
    }

    const referenceRects = [
        ...referencePlacements.flatMap((placement) => shiftRects(placement.layout.rects, placement.x, placement.y)),
        {
            id: '__parent_root__',
            x: 0,
            y: 0,
            width: parentWidth,
            height: parentHeight,
        } satisfies LayoutRect,
    ];

    return placements.map((placement) => {
        const candidateRects = shiftRects(placement.layout.rects, placement.x, placement.y);
        const deltaX = direction === 'right'
            ? resolvePullLeftRelaxationDelta(candidateRects, referenceRects, gap)
            : resolvePullRightRelaxationDelta(candidateRects, referenceRects, gap);

        if (deltaX === 0) {
            return placement;
        }

        return {
            ...placement,
            x: placement.x + deltaX,
        };
    });
}

function resolveVerticalClearanceDelta(
    candidateRects: LayoutRect[],
    referenceRects: LayoutRect[],
    direction: 'up' | 'down',
    gap: number,
): number {
    return direction === 'up'
        ? resolveUpwardClearanceDelta(candidateRects, referenceRects, gap)
        : resolveDownwardClearanceDelta(candidateRects, referenceRects, gap);
}

function resolveVerticalOverlapDelta(
    candidateRects: LayoutRect[],
    referenceRects: LayoutRect[],
    direction: 'up' | 'down',
    gap: number,
): number {
    return direction === 'up'
        ? resolveUpwardOverlapDelta(candidateRects, referenceRects, gap)
        : resolveDownwardOverlapDelta(candidateRects, referenceRects, gap);
}

function resolveHorizontalClearanceDelta(
    candidateRects: LayoutRect[],
    referenceRects: LayoutRect[],
    direction: 'left' | 'right',
    gap: number,
): number {
    return direction === 'left'
        ? resolveLeftwardClearanceDelta(candidateRects, referenceRects, gap)
        : resolveRightwardClearanceDelta(candidateRects, referenceRects, gap);
}

function resolvePullLeftRelaxationDelta(
    candidateRects: LayoutRect[],
    referenceRects: LayoutRect[],
    gap: number,
): number {
    let lowerBound = -Infinity;

    for (const candidateRect of candidateRects) {
        for (const reference of referenceRects) {
            if (!rangesOverlap(candidateRect.y, candidateRect.y + candidateRect.height, reference.y, reference.y + reference.height)) {
                continue;
            }

            const candidateLowerBound = (reference.x + reference.width + gap) - candidateRect.x;
            if (candidateLowerBound > lowerBound) {
                lowerBound = candidateLowerBound;
            }
        }
    }

    if (!Number.isFinite(lowerBound)) {
        return 0;
    }

    return Math.min(0, lowerBound);
}

function resolvePullRightRelaxationDelta(
    candidateRects: LayoutRect[],
    referenceRects: LayoutRect[],
    gap: number,
): number {
    let upperBound = Infinity;

    for (const candidateRect of candidateRects) {
        for (const reference of referenceRects) {
            if (!rangesOverlap(candidateRect.y, candidateRect.y + candidateRect.height, reference.y, reference.y + reference.height)) {
                continue;
            }

            const candidateUpperBound = (reference.x - gap) - (candidateRect.x + candidateRect.width);
            if (candidateUpperBound < upperBound) {
                upperBound = candidateUpperBound;
            }
        }
    }

    if (!Number.isFinite(upperBound)) {
        return 0;
    }

    return Math.max(0, upperBound);
}

function resolveLeftwardClearanceDelta(
    candidateRects: LayoutRect[],
    referenceRects: LayoutRect[],
    gap: number,
): number {
    let requiredDelta = 0;

    for (const candidateRect of candidateRects) {
        for (const reference of referenceRects) {
            if (!rangesOverlap(candidateRect.y, candidateRect.y + candidateRect.height, reference.y, reference.y + reference.height)) {
                continue;
            }

            const overlapDelta = (reference.x - gap) - (candidateRect.x + candidateRect.width);
            if (overlapDelta < requiredDelta) {
                requiredDelta = overlapDelta;
            }
        }
    }

    return requiredDelta;
}

function resolveRightwardClearanceDelta(
    candidateRects: LayoutRect[],
    referenceRects: LayoutRect[],
    gap: number,
): number {
    let requiredDelta = 0;

    for (const candidateRect of candidateRects) {
        for (const reference of referenceRects) {
            if (!rangesOverlap(candidateRect.y, candidateRect.y + candidateRect.height, reference.y, reference.y + reference.height)) {
                continue;
            }

            const overlapDelta = (reference.x + reference.width + gap) - candidateRect.x;
            if (overlapDelta > requiredDelta) {
                requiredDelta = overlapDelta;
            }
        }
    }

    return requiredDelta;
}

function resolveUpwardClearanceDelta(
    candidateRects: LayoutRect[],
    referenceRects: LayoutRect[],
    gap: number,
): number {
    let requiredDelta = 0;

    for (const candidate of candidateRects) {
        for (const reference of referenceRects) {
            if (!rangesOverlap(candidate.x, candidate.x + candidate.width, reference.x, reference.x + reference.width)) {
                continue;
            }

            const overlapDelta = (reference.y - gap) - (candidate.y + candidate.height);
            if (overlapDelta < requiredDelta) {
                requiredDelta = overlapDelta;
            }
        }
    }

    return requiredDelta;
}

function resolveDownwardClearanceDelta(
    candidateRects: LayoutRect[],
    referenceRects: LayoutRect[],
    gap: number,
): number {
    let requiredDelta = 0;

    for (const candidate of candidateRects) {
        for (const reference of referenceRects) {
            if (!rangesOverlap(candidate.x, candidate.x + candidate.width, reference.x, reference.x + reference.width)) {
                continue;
            }

            const overlapDelta = (reference.y + reference.height + gap) - candidate.y;
            if (overlapDelta > requiredDelta) {
                requiredDelta = overlapDelta;
            }
        }
    }

    return requiredDelta;
}

function resolveUpwardOverlapDelta(
    candidateRects: LayoutRect[],
    referenceRects: LayoutRect[],
    gap: number,
): number {
    let requiredDelta = 0;

    for (const candidate of candidateRects) {
        for (const reference of referenceRects) {
            if (!rangesOverlap(candidate.x, candidate.x + candidate.width, reference.x, reference.x + reference.width)) {
                continue;
            }

            if (candidate.y + candidate.height <= reference.y - gap || candidate.y >= reference.y + reference.height + gap) {
                continue;
            }

            const overlapDelta = (reference.y - gap) - (candidate.y + candidate.height);
            if (overlapDelta < requiredDelta) {
                requiredDelta = overlapDelta;
            }
        }
    }

    return requiredDelta;
}

function resolveDownwardOverlapDelta(
    candidateRects: LayoutRect[],
    referenceRects: LayoutRect[],
    gap: number,
): number {
    let requiredDelta = 0;

    for (const candidate of candidateRects) {
        for (const reference of referenceRects) {
            if (!rangesOverlap(candidate.x, candidate.x + candidate.width, reference.x, reference.x + reference.width)) {
                continue;
            }

            if (candidate.y + candidate.height <= reference.y - gap || candidate.y >= reference.y + reference.height + gap) {
                continue;
            }

            const overlapDelta = (reference.y + reference.height + gap) - candidate.y;
            if (overlapDelta > requiredDelta) {
                requiredDelta = overlapDelta;
            }
        }
    }

    return requiredDelta;
}

function getPlacedRootBounds(
    placements: Array<PlacedSubtree & { order: number }>,
): LayoutBounds | null {
    if (placements.length === 0) {
        return null;
    }

    return calculateBounds(getPlacedRootRects(placements));
}

function getPlacedRootRects(
    placements: Array<PlacedSubtree & { order: number }>,
): LayoutRect[] {
    return placements.map((placement) => {
        const rootRect = placement.layout.rects.find((rect) => rect.id === placement.layout.rootId);
        if (!rootRect) {
            return {
                id: placement.layout.rootId,
                x: placement.x,
                y: placement.y,
                width: placement.layout.rootWidth,
                height: placement.layout.rootHeight,
            } satisfies LayoutRect;
        }

        return {
            ...rootRect,
            x: rootRect.x + placement.x,
            y: rootRect.y + placement.y,
        };
    });
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
            direction,
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
            direction,
            order: entry.order,
        };
    });
}

function mirrorSubtreeLayout(
    layout: SubtreeLayout,
    direction: 'left' | 'up',
): SubtreeLayout {
    const rects = layout.rects.map((rect) => mirrorRect(rect, layout, direction));

    return {
        ...layout,
        positions: new Map(rects.map((rect) => [rect.id, { x: rect.x, y: rect.y }])),
        rects,
        bounds: calculateBounds(rects),
    };
}

function mirrorRect(
    rect: LayoutRect,
    layout: SubtreeLayout,
    direction: 'left' | 'up',
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
                x: rect.x,
                y: layout.rootHeight - rect.y - rect.height,
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
        directions: new Map(
            placements
                .filter((placement): placement is PlacedSubtree & { direction: LayoutDirection } => Boolean(placement.direction))
                .map((placement) => [placement.layout.rootId, placement.direction]),
        ),
        clusterWidth: bounds.width,
        clusterHeight: bounds.height,
        spreadFactor,
    };
}

function placeDirectedSiblingGroup(
    layouts: SubtreeLayout[],
    direction: NativeLayoutDirection,
    horizontalOptions: PlacementOptions,
    verticalOptions: VerticalPlacementOptions,
): PlacedSubtree[] {
    return direction === 'right'
        ? placeRightwardSiblingGroup(layouts, horizontalOptions)
        : placeDownwardSiblingGroup(layouts, verticalOptions);
}

function placeRightwardSiblingGroup(layouts: SubtreeLayout[], options: PlacementOptions): PlacedSubtree[] {
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

function placeDownwardSiblingGroup(layouts: SubtreeLayout[], options: VerticalPlacementOptions): PlacedSubtree[] {
    if (layouts.length === 0) {
        return [];
    }

    const placedRects: LayoutRect[] = [];
    const placements: PlacedSubtree[] = [];
    const centeredMidpoint = (layouts.length - 1) / 2;

    for (let index = 0; index < layouts.length; index += 1) {
        const layout = layouts[index];
        const centeredIndex = Math.abs(index - centeredMidpoint);
        const y = options.baseY + centeredIndex * options.fanStep;
        const candidateRects = shiftRects(layout.rects, 0, y);
        const x = placedRects.length === 0
            ? 0
            : computeContourHorizontalOffset(placedRects, candidateRects, options.horizontalGap);

        placements.push({ layout, x, y });
        placedRects.push(...shiftRects(layout.rects, x, y));
    }

    const packedBounds = calculateBounds(placedRects);
    const clusterShiftX = options.anchorCenterX - ((packedBounds.minX + packedBounds.maxX) / 2);

    return placements.map((placement) => ({
        ...placement,
        x: placement.x + clusterShiftX,
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

function computeContourHorizontalOffset(
    placedRects: LayoutRect[],
    candidateRects: LayoutRect[],
    gap: number,
): number {
    let requiredOffset = 0;

    for (const placed of placedRects) {
        for (const candidate of candidateRects) {
            if (!rangesOverlap(placed.y, placed.y + placed.height, candidate.y, candidate.y + candidate.height)) {
                continue;
            }

            requiredOffset = Math.max(
                requiredOffset,
                placed.x + placed.width + gap - candidate.x,
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
