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
  previousFile: string | null;
  currentFile: string | null;
  currentViewport: FlowViewportLike;
  savedViewport: TabViewportState | null | undefined;
}): TabViewportState | null {
  if (
    input.hasRenderedGraph
    && input.previousFile
    && input.currentFile
    && input.previousFile === input.currentFile
  ) {
    return toTabViewportState(input.currentViewport);
  }

  return input.savedViewport ?? null;
}
