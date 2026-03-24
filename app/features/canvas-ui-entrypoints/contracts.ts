export type CanvasEntrypointSurface =
  | 'canvas-toolbar'
  | 'selection-floating-menu'
  | 'pane-context-menu'
  | 'node-context-menu';

export type CanvasEntrypointCreateNodeType =
  | 'rectangle'
  | 'ellipse'
  | 'diamond'
  | 'text'
  | 'markdown'
  | 'line'
  | 'sticky'
  | 'image'
  | 'sticker'
  | 'washi-tape';

export type CanvasEntrypointCreateMode = CanvasEntrypointCreateNodeType | 'mindmap' | null;
