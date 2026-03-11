import { Node, Edge } from 'reactflow';

export type LayoutDirection = 'right' | 'left' | 'down' | 'up';

export interface LayoutPoint {
    x: number;
    y: number;
}

export interface LayoutBounds {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
}

export interface SiblingPlacementFrame {
    parentId: string;
    childOrder: string[];
    placements: Map<string, LayoutPoint>;
    clusterWidth: number;
    clusterHeight: number;
    spreadFactor: number;
}

export interface LayoutGroupResult {
    positions: Map<string, LayoutPoint>;
    placementFrames: SiblingPlacementFrame[];
}

export interface LayoutContext {
    nodes: Node[];
    edges: Edge[];
    spacing: number;
    density?: number;  // 0~1, quadrant-pack 밀도 제어
}

export interface LayoutStrategy {
    layoutGroup(context: LayoutContext): Promise<Map<string, LayoutPoint>>;
    layoutGroupDetailed?(context: LayoutContext): Promise<LayoutGroupResult>;
}
