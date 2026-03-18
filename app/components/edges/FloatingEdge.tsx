import React, { useMemo } from 'react';
import { EdgeProps, useNodes, EdgeLabelRenderer } from 'reactflow';
import { getNodeCenter, getNodeIntersection, getFloatingEdgePath } from './utils';
import type { FontFamilyPreset } from '@magam/core';
import { useGraphStore } from '@/store/graph';
import { resolveFontFamilyCssValue } from '@/utils/fontHierarchy';

interface FloatingEdgeData {
    sourceType?: string;
    targetType?: string;
}

function resolveNodeShapeType(nodeData: unknown): string | undefined {
    if (!nodeData || typeof nodeData !== 'object') {
        return undefined;
    }

    const { type } = nodeData as { type?: unknown };
    return typeof type === 'string' ? type : undefined;
}

export default function FloatingEdge({
    id,
    source,
    target,
    markerEnd,
    style,
    label,
    labelStyle,
    labelBgStyle,
    data,
}: EdgeProps<FloatingEdgeData>) {
    const nodes = useNodes();
    const globalFontFamily = useGraphStore((state) => state.globalFontFamily);
    const canvasFontFamily = useGraphStore((state) => state.canvasFontFamily);
    const edgeFontFamily = labelStyle?.fontFamily as FontFamilyPreset | undefined;
    const resolvedLabelFontFamily = resolveFontFamilyCssValue({
        nodeFontFamily: edgeFontFamily,
        canvasFontFamily,
        globalFontFamily,
    });

    const { edgePath, labelX, labelY } = useMemo(() => {
        const sourceNode = nodes.find((n) => n.id === source);
        const targetNode = nodes.find((n) => n.id === target);

        if (!sourceNode || !targetNode) {
            return { edgePath: '', labelX: 0, labelY: 0 };
        }

        // Get center points
        const sourceCenter = getNodeCenter(sourceNode);
        const targetCenter = getNodeCenter(targetNode);

        // Get intersection points with node boundaries
        const sourceIntersection = getNodeIntersection(
            sourceNode,
            targetCenter,
            data?.sourceType ?? resolveNodeShapeType(sourceNode.data)
        );

        const targetIntersection = getNodeIntersection(
            targetNode,
            sourceCenter,
            data?.targetType ?? resolveNodeShapeType(targetNode.data)
        );

        // Generate path
        const path = getFloatingEdgePath(
            sourceIntersection.x,
            sourceIntersection.y,
            sourceIntersection.position,
            targetIntersection.x,
            targetIntersection.y,
            targetIntersection.position
        );

        // Label position at midpoint
        const midX = (sourceIntersection.x + targetIntersection.x) / 2;
        const midY = (sourceIntersection.y + targetIntersection.y) / 2;

        return { edgePath: path, labelX: midX, labelY: midY };
    }, [nodes, source, target, data]);

    if (!edgePath) {
        return null;
    }

    return (
        <>
            <path
                id={id}
                className="react-flow__edge-path"
                d={edgePath}
                markerEnd={markerEnd}
                style={style}
                fill="none"
            />

            {label && (
                <EdgeLabelRenderer>
                    <div
                        style={{
                            position: 'absolute',
                            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                            pointerEvents: 'all',
                            ...labelBgStyle,
                        }}
                        className="nodrag nopan px-2 py-1 rounded text-xs font-medium bg-white/90 backdrop-blur-sm shadow-sm"
                    >
                        <span style={{ ...labelStyle, fontFamily: resolvedLabelFontFamily }}>{label}</span>
                    </div>
                </EdgeLabelRenderer>
            )}
        </>
    );
}
