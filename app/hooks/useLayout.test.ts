import { describe, expect, it } from 'bun:test';
import type { MindMapGroup } from '@/store/graph';
import {
  createMixedSizeFixture,
  createMultiRootFixture,
  createSiblingHeavyFixture,
  layoutBoundingBoxBaseline,
  measureVerticalSpan,
} from '@/utils/strategies/fixtures/compactPlacementFixtures';
import {
  calculateMindMapGroupLayout,
  DEFAULT_LAYOUT_SPACING,
  canStartLayout,
  resolveGroupLayoutSpacing,
  resolveLayoutSpacing,
} from './useLayout';

describe('useLayout re-entry guard helper', () => {
  it('returns true when no layout is running', () => {
    expect(canStartLayout(false)).toBe(true);
  });

  it('returns false when a layout is already running', () => {
    expect(canStartLayout(true)).toBe(false);
  });
});

describe('useLayout spacing resolution helpers', () => {
  it('falls back to spacing 50 when no override is provided', () => {
    expect(resolveLayoutSpacing(undefined)).toBe(DEFAULT_LAYOUT_SPACING);
    expect(resolveLayoutSpacing(Number.NaN)).toBe(DEFAULT_LAYOUT_SPACING);
  });

  it('keeps explicit graph-level spacing overrides', () => {
    expect(resolveLayoutSpacing(80)).toBe(80);
  });

  it('prefers group spacing and otherwise uses the graph-level spacing fallback', () => {
    expect(resolveGroupLayoutSpacing(undefined, 70)).toBe(70);
    expect(resolveGroupLayoutSpacing(90, 70)).toBe(90);
    expect(resolveGroupLayoutSpacing(undefined, undefined)).toBe(DEFAULT_LAYOUT_SPACING);
  });
});

describe('useLayout compact group integration helpers', () => {
  it('keeps mixed-size compact group layout deterministic across repeated runs', async () => {
    const fixture = createMixedSizeFixture();
    const group = createCompactGroup('mixed-size');

    const first = await calculateMindMapGroupLayout({
      group,
      nodes: fixture.nodes,
      edges: fixture.edges,
    });
    const second = await calculateMindMapGroupLayout({
      group,
      nodes: fixture.nodes,
      edges: fixture.edges,
    });

    expect(first?.spacing).toBe(DEFAULT_LAYOUT_SPACING);
    expect(serializePositions(first?.positions ?? new Map())).toEqual(
      serializePositions(second?.positions ?? new Map()),
    );
    expect(serializePlacementFrames(first?.placementFrames ?? [])).toEqual(
      serializePlacementFrames(second?.placementFrames ?? []),
    );
  });

  it('returns root-cluster placement metadata for multi-root compact groups', async () => {
    const fixture = createMultiRootFixture();
    const result = await calculateMindMapGroupLayout({
      group: createCompactGroup('multi-root'),
      nodes: fixture.nodes,
      edges: fixture.edges,
    });

    expect(result).not.toBeNull();
    expect(result?.placementFrames.some((frame) => frame.parentId === '__root_cluster__')).toBe(true);
    expect(
      result?.placementFrames.find((frame) => frame.parentId === '__root_cluster__')?.childOrder,
    ).toEqual(['root-a', 'root-b', 'root-c', 'root-d']);
  });

  it('keeps sibling-heavy compact layout tighter than bounding-box stacking at the hook integration layer', async () => {
    const fixture = createSiblingHeavyFixture();
    const result = await calculateMindMapGroupLayout({
      group: createCompactGroup('sibling-heavy'),
      nodes: fixture.nodes,
      edges: fixture.edges,
    });
    const baseline = layoutBoundingBoxBaseline(fixture.nodes, fixture.edges, fixture.spacing);
    const childIds = fixture.edges
      .filter((edge) => edge.source === 'root')
      .map((edge) => edge.target);

    expect(result).not.toBeNull();
    expect(measureVerticalSpan(fixture.nodes, result?.positions ?? new Map(), childIds)).toBeLessThan(
      measureVerticalSpan(fixture.nodes, baseline, childIds),
    );
    expect(
      result?.placementFrames.find((frame) => frame.parentId === 'root')?.spreadFactor ?? 0,
    ).toBeGreaterThan(0);
  });
});

function createCompactGroup(id: string, overrides?: Partial<MindMapGroup>): MindMapGroup {
  return {
    id,
    layoutType: 'compact',
    basePosition: { x: 0, y: 0 },
    ...overrides,
  };
}

function serializePositions(
  positions: Map<string, { x: number; y: number }>,
): Array<[string, { x: number; y: number }]> {
  return Array.from(positions.entries()).sort(([leftId], [rightId]) => leftId.localeCompare(rightId));
}

function serializePlacementFrames(
  frames: Array<{
    parentId: string;
    childOrder: string[];
    clusterWidth: number;
    clusterHeight: number;
    spreadFactor: number;
    directions: Map<string, 'right' | 'left' | 'up' | 'down'>;
    placements: Map<string, { x: number; y: number }>;
  }>,
) {
  return frames.map((frame) => ({
    parentId: frame.parentId,
    childOrder: [...frame.childOrder],
    clusterWidth: frame.clusterWidth,
    clusterHeight: frame.clusterHeight,
    spreadFactor: frame.spreadFactor,
    directions: Array.from(frame.directions.entries()).sort(([leftId], [rightId]) => leftId.localeCompare(rightId)),
    placements: serializePositions(frame.placements),
  }));
}
