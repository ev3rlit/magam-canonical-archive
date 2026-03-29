import { CanvasEditor } from '@/widgets/canvas-editor/ui/CanvasEditor';
import { InspectorPanel } from '@/widgets/inspector-panel/ui/InspectorPanel';
import { OutlinerPanel } from '@/widgets/outliner-panel/ui/OutlinerPanel';
import { TopToolbar } from '@/widgets/top-toolbar/ui/TopToolbar';

export function EditorShell() {
  return (
    <main className="editor-shell" data-testid="editor-shell">
      <TopToolbar />
      <div className="editor-shell__body">
        <OutlinerPanel />
        <CanvasEditor />
        <InspectorPanel />
      </div>
    </main>
  );
}
