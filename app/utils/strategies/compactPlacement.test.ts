import { describe, expect, it } from 'bun:test';
import type { Node } from 'reactflow';
import { getNodeDimensions } from '../layoutUtils';
import { runCompactLayout, runCompactLayoutDetailed } from './compactPlacement';
import {
    collectSubtreeNodeIds,
    countLayoutOverlaps,
    createContourCompressionFixture,
    createMixedSizeFixture,
    createMultiRootFixture,
    createProjectStressFixture,
    createSiblingHeavyFixture,
    getOccupiedBounds,
    layoutBoundingBoxBaseline,
    measureVerticalSpan,
} from './fixtures/compactPlacementFixtures';

describe('runCompactLayout', () => {
    it('keeps compact layout deterministic for mixed-size trees', () => {
        const fixture = createMixedSizeFixture();

        const first = runCompactLayout(fixture.nodes, fixture.edges, fixture.spacing);
        const second = runCompactLayout(fixture.nodes, fixture.edges, fixture.spacing);

        expect(serializePositions(first)).toEqual(serializePositions(second));
        expect(first.size).toBe(fixture.nodes.length);
        expect(countLayoutOverlaps(fixture.nodes, first)).toBe(0);
    });

    it('lays out multiple roots as a compact forest without overlaps', () => {
        const fixture = createMultiRootFixture();
        const compact = runCompactLayout(fixture.nodes, fixture.edges, fixture.spacing);
        const baseline = layoutBoundingBoxBaseline(fixture.nodes, fixture.edges, fixture.spacing);

        expect(compact.size).toBe(fixture.nodes.length);
        expect(countLayoutOverlaps(fixture.nodes, compact)).toBe(0);
        expect(getOccupiedBounds(fixture.nodes, compact).height).toBeLessThan(
            getOccupiedBounds(fixture.nodes, baseline).height,
        );
    });

    it('reduces sibling vertical stretching with adaptive sibling placement', () => {
        const fixture = createSiblingHeavyFixture();
        const compact = runCompactLayout(fixture.nodes, fixture.edges, fixture.spacing);
        const baseline = layoutBoundingBoxBaseline(fixture.nodes, fixture.edges, fixture.spacing);
        const childIds = fixture.edges
            .filter((edge) => edge.source === 'root')
            .map((edge) => edge.target);

        expect(countLayoutOverlaps(fixture.nodes, compact)).toBe(0);
        expect(measureVerticalSpan(fixture.nodes, compact, childIds)).toBeLessThan(
            measureVerticalSpan(fixture.nodes, baseline, childIds),
        );
    });

    it('fans out sibling-heavy root branches across four directions for square-ish density', () => {
        const fixture = createSiblingHeavyFixture();
        const detailed = runCompactLayoutDetailed(fixture.nodes, fixture.edges, fixture.spacing);
        const rootFrame = detailed.placementFrames.find((frame) => frame.parentId === 'root');
        const placements = Array.from(rootFrame?.placements.values() ?? []);

        expect(rootFrame).toBeDefined();
        expect(placements.some((placement) => placement.x < 0)).toBe(true);
        expect(placements.some((placement) => placement.x > 0)).toBe(true);
        expect(placements.some((placement) => placement.y < 0)).toBe(true);
        expect(placements.some((placement) => placement.y > 0)).toBe(true);
    });

    it('balances top-level root branches across four directions within one branch of difference', () => {
        const fixture = createProjectStressFixture();
        const detailed = runCompactLayoutDetailed(fixture.nodes, fixture.edges, fixture.spacing);
        const rootFrame = detailed.placementFrames.find((frame) => frame.parentId === 'root');

        expect(rootFrame).toBeDefined();

        const sectorCounts = countRootSectors(rootFrame?.directions ?? new Map());
        const counts = Object.values(sectorCounts);

        expect(counts.every((count) => count > 0)).toBe(true);
        expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    });

    it('grows up and down sectors along their assigned direction instead of reusing rightward subtree growth', () => {
        const fixture = createSiblingHeavyFixture();
        const detailed = runCompactLayoutDetailed(fixture.nodes, fixture.edges, fixture.spacing);
        const rootFrame = detailed.placementFrames.find((frame) => frame.parentId === 'root');
        const upChildId = findChildInSector(rootFrame?.directions ?? new Map(), 'up');
        const downChildId = findChildInSector(rootFrame?.directions ?? new Map(), 'down');

        expect(upChildId).toBeDefined();
        expect(downChildId).toBeDefined();

        const upDescendantBounds = getOccupiedBounds(
            fixture.nodes,
            detailed.positions,
            collectSubtreeNodeIds(upChildId!, fixture.edges).filter((nodeId) => nodeId !== upChildId),
        );
        const downDescendantBounds = getOccupiedBounds(
            fixture.nodes,
            detailed.positions,
            collectSubtreeNodeIds(downChildId!, fixture.edges).filter((nodeId) => nodeId !== downChildId),
        );
        const upRect = getNodeRect(fixture.nodes, detailed.positions, upChildId!);
        const downRect = getNodeRect(fixture.nodes, detailed.positions, downChildId!);

        expect(upDescendantBounds.maxY).toBeLessThanOrEqual(upRect.y);
        expect(downDescendantBounds.minY).toBeGreaterThanOrEqual(downRect.y + downRect.height);
    });

    it('compresses deep and shallow sibling gaps using contour-aware packing', () => {
        const fixture = createContourCompressionFixture();
        const compact = runCompactLayout(fixture.nodes, fixture.edges, fixture.spacing);
        const baseline = layoutBoundingBoxBaseline(fixture.nodes, fixture.edges, fixture.spacing);
        const rootChildren = fixture.edges
            .filter((edge) => edge.source === 'root')
            .map((edge) => edge.target);
        const comparedIds = rootChildren.flatMap((rootChildId) => collectSubtreeNodeIds(rootChildId, fixture.edges));

        expect(countLayoutOverlaps(fixture.nodes, compact)).toBe(0);
        expect(getOccupiedBounds(fixture.nodes, compact, comparedIds).height).toBeLessThan(
            getOccupiedBounds(fixture.nodes, baseline, comparedIds).height,
        );
    });

    it('keeps project-scale dense compact layouts overlap-free under heavy four-direction fan-out', () => {
        const fixture = createProjectStressFixture();
        const compact = runCompactLayout(fixture.nodes, fixture.edges, fixture.spacing);
        const detailed = runCompactLayoutDetailed(fixture.nodes, fixture.edges, fixture.spacing);
        const rootFrame = detailed.placementFrames.find((frame) => frame.parentId === 'root');

        expect(compact.size).toBe(fixture.nodes.length);
        expect(countLayoutOverlaps(fixture.nodes, compact)).toBe(0);
        expect(rootFrame).toBeDefined();
        expect(rootFrame?.placements.size).toBeGreaterThan(8);
    });
});

function serializePositions(positions: Map<string, { x: number; y: number }>): Array<[string, { x: number; y: number }]> {
    return Array.from(positions.entries()).sort(([leftId], [rightId]) => leftId.localeCompare(rightId));
}

function countRootSectors(
    directions: Map<string, 'up' | 'right' | 'down' | 'left'>,
): Record<'up' | 'right' | 'down' | 'left', number> {
    const counts = { up: 0, right: 0, down: 0, left: 0 };
    for (const direction of directions.values()) {
        counts[direction] += 1;
    }
    return counts;
}

function findChildInSector(
    directions: Map<string, 'up' | 'right' | 'down' | 'left'>,
    sector: 'up' | 'right' | 'down' | 'left',
): string | null {
    for (const [childId, direction] of directions) {
        if (direction === sector) {
            return childId;
        }
    }
    return null;
}

function getNodeRect(
    nodes: Node[],
    positions: Map<string, { x: number; y: number }>,
    nodeId: string,
) {
    const node = nodes.find((candidate) => candidate.id === nodeId);
    if (!node) {
        throw new Error(`Missing node ${nodeId}`);
    }

    const point = positions.get(nodeId);
    if (!point) {
        throw new Error(`Missing position for ${nodeId}`);
    }

    const { width, height } = getNodeDimensions(node);
    return {
        x: point.x,
        y: point.y,
        width,
        height,
    };
}
