import type { LayoutStrategy } from './types';
import { TreeStrategy } from './treeStrategy';
import { BidirectionalStrategy } from './bidirectionalStrategy';

const strategies = {
    tree: new TreeStrategy(),
    bidirectional: new BidirectionalStrategy(),
} as const;

export function getLayoutStrategy(layoutType: string): LayoutStrategy {
    return (strategies as Record<string, LayoutStrategy>)[layoutType] ?? strategies.tree;
}
