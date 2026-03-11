import { describe, expect, it } from 'bun:test';
import { runCompactLayout, runCompactLayoutDetailed } from './compactPlacement';
import {
    collectSubtreeNodeIds,
    countLayoutOverlaps,
    createContourCompressionFixture,
    createMixedSizeFixture,
    createMultiRootFixture,
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
});

function serializePositions(positions: Map<string, { x: number; y: number }>): Array<[string, { x: number; y: number }]> {
    return Array.from(positions.entries()).sort(([leftId], [rightId]) => leftId.localeCompare(rightId));
}
