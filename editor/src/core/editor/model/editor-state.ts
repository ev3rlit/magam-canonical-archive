import type { EditorPanelId, EditorTool, EditorViewportState } from './editor-types';

export interface EditorState {
  activeTool: EditorTool;
  openPanels: Record<EditorPanelId, boolean>;
  viewport: EditorViewportState;
}

export const initialEditorState: EditorState = {
  activeTool: 'select',
  openPanels: {
    outliner: true,
    inspector: true,
  },
  viewport: {
    x: 0,
    y: 0,
    zoom: 1,
  },
};
