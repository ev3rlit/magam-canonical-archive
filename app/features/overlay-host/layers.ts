import type { OverlayPlacement, OverlaySize, OverlaySlotKind } from './types';

export const OVERLAY_SAFE_MARGIN = 8;
export const OVERLAY_BASE_Z_INDEX = 150;

export const OVERLAY_SLOT_DEFAULTS: Record<
  OverlaySlotKind,
  {
    priority: number;
    dismissible: boolean;
    placement: OverlayPlacement;
    estimatedSize: OverlaySize;
  }
> = {
  toolbar: {
    priority: 10,
    dismissible: false,
    placement: 'top-center',
    estimatedSize: { width: 420, height: 64 },
  },
  'selection-floating-menu': {
    priority: 20,
    dismissible: true,
    placement: 'top-center',
    estimatedSize: { width: 320, height: 56 },
  },
  'pane-context-menu': {
    priority: 30,
    dismissible: true,
    placement: 'top-start',
    estimatedSize: { width: 200, height: 220 },
  },
  'node-context-menu': {
    priority: 40,
    dismissible: true,
    placement: 'top-start',
    estimatedSize: { width: 200, height: 240 },
  },
};

export function resolveOverlayZIndex(priority: number, order: number): number {
  return OVERLAY_BASE_Z_INDEX + priority + order;
}
