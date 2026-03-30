'use client';

import { WidgetBase } from '@/shared/ui/WidgetBase';
import { CanvasOverlay } from '@/widgets/canvas-editor/ui/CanvasOverlay';
import { CanvasSelectionLayer } from '@/widgets/canvas-editor/ui/CanvasSelectionLayer';
import { CanvasViewport } from '@/widgets/canvas-editor/ui/CanvasViewport';
import { FloatingToolMenu } from '@/widgets/canvas-editor/ui/FloatingToolMenu';

export function CanvasEditor() {
  return (
    <WidgetBase
      bodyClassName="widget-shell__body--canvas"
      chrome="canvas"
      entryDelayMs={170}
      panelClassName="widget-shell__panel--canvas"
      side="center"
      title="Viewport"
      titleClassName="widget-shell__title--canvas"
    >
      <section className="canvas-editor" data-testid="canvas-editor">
        <div className="canvas-editor__stage">
          <FloatingToolMenu />
          <CanvasViewport />
          <CanvasSelectionLayer />
          <CanvasOverlay />
        </div>
      </section>
    </WidgetBase>
  );
}
