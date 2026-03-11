import { runCompactLayout, runCompactLayoutDetailed } from './compactPlacement';
import type { LayoutContext, LayoutGroupResult, LayoutStrategy } from './types';

export async function layoutCompactGroupDetailed(context: LayoutContext): Promise<LayoutGroupResult> {
    return runCompactLayoutDetailed(context.nodes, context.edges, context.spacing);
}

export class CompactTreeStrategy implements LayoutStrategy {
    async layoutGroup(context: LayoutContext): Promise<Map<string, { x: number; y: number }>> {
        return runCompactLayout(context.nodes, context.edges, context.spacing);
    }

    async layoutGroupDetailed(context: LayoutContext): Promise<LayoutGroupResult> {
        return layoutCompactGroupDetailed(context);
    }
}
