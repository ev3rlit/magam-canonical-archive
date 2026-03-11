import type { LayoutStrategy } from './types';
import { TreeStrategy } from './treeStrategy';
import { BidirectionalStrategy } from './bidirectionalStrategy';
import { CompactTreeStrategy } from './compactTreeStrategy';
import { BidirectionalCompactStrategy } from './bidirectionalCompactStrategy';
import { DepthHybridStrategy } from './depthHybridStrategy';
import { TreemapPackStrategy } from './treemapPackStrategy';
import { QuadrantPackStrategy } from './quadrantPackStrategy';
import { VoronoiPackStrategy } from './voronoiPackStrategy';

const strategies = {
    tree: new TreeStrategy(),
    bidirectional: new BidirectionalStrategy(),
    compact: new CompactTreeStrategy(),
    'compact-bidir': new BidirectionalCompactStrategy(),
    'depth-hybrid': new DepthHybridStrategy(),
    'treemap-pack': new TreemapPackStrategy(),
    'quadrant-pack': new QuadrantPackStrategy(),
    'voronoi-pack': new VoronoiPackStrategy(),
} as const;

export function getLayoutStrategy(layoutType: string): LayoutStrategy {
    return (strategies as Record<string, LayoutStrategy>)[layoutType] ?? strategies.compact;
}
