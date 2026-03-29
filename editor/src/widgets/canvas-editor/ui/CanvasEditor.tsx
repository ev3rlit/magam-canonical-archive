'use client';

import { CanvasOverlay } from '@/widgets/canvas-editor/ui/CanvasOverlay';
import { CanvasSelectionLayer } from '@/widgets/canvas-editor/ui/CanvasSelectionLayer';
import { CanvasViewport } from '@/widgets/canvas-editor/ui/CanvasViewport';
import { FloatingToolMenu } from '@/widgets/canvas-editor/ui/FloatingToolMenu';

export function CanvasEditor() {
  return (
    <section className="canvas-editor" data-testid="canvas-editor">
      <div className="canvas-editor__stage">
        <FloatingToolMenu />
        <CanvasViewport />
        <CanvasSelectionLayer />
        <CanvasOverlay />
      </div>
    </section>
  );
}
