'use client';

import { getEffectiveBounds, getSelectionBounds, marqueeToBounds, screenBoundsFromWorld } from '@/core/editor/model/editor-geometry';
import { useEditorStore } from '@/core/editor/model/editor-store';

export function CanvasSelectionLayer() {
  const objects = useEditorStore((state) => state.scene.objects);
  const marquee = useEditorStore((state) => state.scene.marquee);
  const selection = useEditorStore((state) => state.selection);
  const viewport = useEditorStore((state) => state.viewport);

  const primaryObject = objects.find((object) => object.id === selection.primaryId) ?? null;
  const selectionBounds = getSelectionBounds(selection, objects);
  const singleBounds = primaryObject ? getEffectiveBounds(primaryObject, objects) : null;

  const toLayerStyle = (bounds: { x: number; y: number; width: number; height: number }) => ({
    left: bounds.x,
    top: bounds.y,
    width: bounds.width,
    height: bounds.height,
  });

  return (
    <div className="canvas-selection-layer" data-testid="canvas-selection-layer">
      {selection.ids.length === 1 && singleBounds ? (
        <div
          className="selection-outline"
          style={toLayerStyle(screenBoundsFromWorld(singleBounds, viewport))}
        />
      ) : null}
      {selection.ids.length > 1 && selectionBounds ? (
        <div
          className="selection-outline selection-outline--multi"
          style={toLayerStyle(screenBoundsFromWorld(selectionBounds, viewport))}
        >
          <span className="selection-outline__label">{selection.ids.length} selected</span>
        </div>
      ) : null}
      {marquee ? (
        <div
          className="selection-marquee"
          style={toLayerStyle(screenBoundsFromWorld(marqueeToBounds(marquee), viewport))}
        />
      ) : null}
    </div>
  );
}
