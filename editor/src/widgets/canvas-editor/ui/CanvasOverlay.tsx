'use client';

import { useEditorStore } from '@/core/editor/model/editor-store';

export function CanvasOverlay() {
  const zoom = useEditorStore((state) => state.viewport.zoom);
  const setZoom = useEditorStore((state) => state.setZoom);

  return (
    <div className="canvas-overlay" data-testid="canvas-overlay">
      <div className="canvas-overlay__controls">
        <button className="canvas-overlay__button" onClick={() => setZoom(zoom - 0.1)} type="button">
          -
        </button>
        <span className="canvas-overlay__value">{Math.round(zoom * 100)}%</span>
        <button className="canvas-overlay__button" onClick={() => setZoom(zoom + 0.1)} type="button">
          +
        </button>
      </div>
    </div>
  );
}
