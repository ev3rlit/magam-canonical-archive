import { Node, Edge } from 'reactflow';

export interface LayoutContext {
    nodes: Node[];
    edges: Edge[];
    spacing: number;
}

export interface LayoutStrategy {
    layoutGroup(context: LayoutContext): Promise<Map<string, { x: number; y: number }>>;
}
