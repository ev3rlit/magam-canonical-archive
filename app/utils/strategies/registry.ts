import type { LayoutStrategy } from './types';
import { TreeStrategy } from './treeStrategy';
import { BidirectionalStrategy } from './bidirectionalStrategy';
import { CompactTreeStrategy } from './compactTreeStrategy';
import { BidirectionalCompactStrategy } from './bidirectionalCompactStrategy';
import { DepthHybridStrategy } from './depthHybridStrategy';

const strategies = {
    tree: new TreeStrategy(),
    bidirectional: new BidirectionalStrategy(),
    compact: new CompactTreeStrategy(),
    'compact-bidir': new BidirectionalCompactStrategy(),
    'depth-hybrid': new DepthHybridStrategy(),
} as const;

export function getLayoutStrategy(layoutType: string): LayoutStrategy {
    return (strategies as Record<string, LayoutStrategy>)[layoutType] ?? strategies.tree;
}
