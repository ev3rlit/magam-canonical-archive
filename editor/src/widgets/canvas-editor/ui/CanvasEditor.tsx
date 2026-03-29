import { CanvasOverlay } from '@/widgets/canvas-editor/ui/CanvasOverlay';
import { CanvasSelectionLayer } from '@/widgets/canvas-editor/ui/CanvasSelectionLayer';
import { CanvasViewport } from '@/widgets/canvas-editor/ui/CanvasViewport';

export function CanvasEditor() {
  return (
    <section className="canvas-editor" data-testid="canvas-editor">
      <div className="canvas-editor__header">
        <div>
          <p className="editor-panel__title">Canvas Editor</p>
          <strong>Single workspace, single database file</strong>
        </div>
        <span className="placeholder-card__copy">Canvas-first MVP shell</span>
      </div>
      <div className="canvas-editor__stage">
        <CanvasViewport />
        <CanvasSelectionLayer />
        <CanvasOverlay />
      </div>
    </section>
  );
}
