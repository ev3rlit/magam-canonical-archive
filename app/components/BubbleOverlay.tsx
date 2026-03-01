'use client';

import React from 'react';
import { useViewport } from 'reactflow';
import { useBubbleState } from '@/contexts/BubbleContext';
import { useZoom } from '@/contexts/ZoomContext';
import { useGraphStore } from '@/store/graph';
import { resolveFontFamilyCssValue } from '@/utils/fontHierarchy';

/**
 * Renders all bubbles in a single overlay layer above all nodes.
 * This ensures bubbles are never covered by other nodes.
 */
export function BubbleOverlay() {
    const bubbles = useBubbleState();
    const { zoom, isBubbleMode } = useZoom();
    const viewport = useViewport();
    const globalFontFamily = useGraphStore((state) => state.globalFontFamily);
    const canvasFontFamily = useGraphStore((state) => state.canvasFontFamily);
    const resolvedFontFamily = resolveFontFamilyCssValue({
        canvasFontFamily,
        globalFontFamily,
    });

    // Only show when in bubble mode
    if (!isBubbleMode) return null;

    const bubblesArray = Array.from(bubbles.values());
    if (bubblesArray.length === 0) return null;

    return (
        <div
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 1000, // Above all nodes
                overflow: 'visible',
                fontFamily: resolvedFontFamily,
            }}
        >
            {bubblesArray.map((bubble) => {
                // Transform flow coordinates to screen coordinates
                const screenX = bubble.x * zoom + viewport.x;
                const screenY = bubble.y * zoom + viewport.y;

                return (
                    <div
                        key={bubble.nodeId}
                        className="bubble-label"
                        style={{
                            position: 'absolute',
                            left: screenX,
                            top: screenY,
                            transform: 'translate(-50%, -50%)',
                            pointerEvents: 'none',
                        }}
                    >
                        {bubble.text}
                    </div>
                );
            })}
        </div>
    );
}
