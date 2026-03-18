import type { CreatePayload } from '@/features/editing/commands';

export type CanvasEntrypointSurface =
  | 'canvas-toolbar'
  | 'selection-floating-menu'
  | 'pane-context-menu'
  | 'node-context-menu';

export type CanvasEntrypointCreateNodeType = Exclude<CreatePayload['nodeType'], 'image'>;

export type CanvasEntrypointCreateMode = CanvasEntrypointCreateNodeType | null;
