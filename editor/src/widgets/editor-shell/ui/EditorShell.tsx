'use client';

import type { CSSProperties } from 'react';
import { useEditorStore } from '@/core/editor/model/editor-store';
import { CanvasEditor } from '@/widgets/canvas-editor/ui/CanvasEditor';
import { QuickExplorerPanel } from '@/widgets/explorer-library/ui/ExplorerLibrarySurface';
import { InspectorPanel } from '@/widgets/inspector-panel/ui/InspectorPanel';
import { OutlinerPanel } from '@/widgets/outliner-panel/ui/OutlinerPanel';
import { TopToolbar } from '@/widgets/top-toolbar/ui/TopToolbar';

export function EditorShell() {
  const panels = useEditorStore((state) => state.panels);
  const shellStyle = {
    '--shell-left-width': panels.open.outliner ? '320px' : '52px',
    '--shell-right-width': panels.open.inspector ? '360px' : '52px',
    '--shell-bottom-height': panels.open.quickExplorer ? '320px' : '54px',
  } as CSSProperties;

  return (
    <main className="editor-shell" data-testid="editor-shell" style={shellStyle}>
      <TopToolbar />
      <div className="editor-shell__body">
        <OutlinerPanel />
        <CanvasEditor />
        <InspectorPanel />
        <QuickExplorerPanel />
      </div>
    </main>
  );
}
