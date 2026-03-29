import type { TabViewportState } from '@/store/graph';

export interface FlowViewportLike {
  x: number;
  y: number;
  zoom: number;
}

export function toTabViewportState(viewport: FlowViewportLike): TabViewportState {
  return {
    x: viewport.x,
    y: viewport.y,
    zoom: viewport.zoom,
  };
}

export function resolveViewportToRestore(input: {
  hasRenderedGraph: boolean;
  previousCanvasId?: string | null;
  currentCanvasId?: string | null;
  currentViewport: FlowViewportLike;
  savedViewport: TabViewportState | null | undefined;
}): TabViewportState | null {
  const isSameDocument = (
    input.previousCanvasId
    && input.currentCanvasId
    && input.previousCanvasId === input.currentCanvasId
  );

  if (input.hasRenderedGraph && isSameDocument) {
    return toTabViewportState(input.currentViewport);
  }

  return input.savedViewport ?? null;
}
