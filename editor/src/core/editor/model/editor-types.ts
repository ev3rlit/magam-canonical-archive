export type EditorTool = 'select' | 'pan' | 'frame';

export type EditorPanelId = 'outliner' | 'inspector';

export interface EditorViewportState {
  x: number;
  y: number;
  zoom: number;
}
