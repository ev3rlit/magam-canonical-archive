import { runElkLayout } from '../elkUtils';
import type { LayoutStrategy, LayoutContext } from './types';

export class TreeStrategy implements LayoutStrategy {
    async layoutGroup(context: LayoutContext): Promise<Map<string, { x: number; y: number }>> {
        return runElkLayout(context.nodes, context.edges, 'RIGHT', context.spacing);
    }
}
