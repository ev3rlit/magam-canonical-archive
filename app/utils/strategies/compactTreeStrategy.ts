import { runFlextreeLayout } from './flextreeUtils';
import type { LayoutStrategy, LayoutContext } from './types';

export class CompactTreeStrategy implements LayoutStrategy {
    async layoutGroup(context: LayoutContext): Promise<Map<string, { x: number; y: number }>> {
        return runFlextreeLayout(context.nodes, context.edges, context.spacing);
    }
}
