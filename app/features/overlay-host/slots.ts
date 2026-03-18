import { OVERLAY_SLOT_DEFAULTS } from './layers';
import type {
  OverlayAnchorDescriptor,
  OverlayContribution,
  OverlaySlotKind,
  OverlayViewport,
} from './types';

export function createSlotContribution(
  slot: OverlaySlotKind,
  input: Omit<Partial<OverlayContribution>, 'slot' | 'priority' | 'dismissible' | 'placement' | 'estimatedSize'> & {
    anchor: OverlayAnchorDescriptor;
    render: OverlayContribution['render'];
  },
): OverlayContribution {
  const defaults = OVERLAY_SLOT_DEFAULTS[slot];
  return {
    slot,
    priority: defaults.priority,
    dismissible: defaults.dismissible,
    placement: defaults.placement,
    estimatedSize: defaults.estimatedSize,
    focusPolicy: input.focusPolicy,
    replaceKey: input.replaceKey,
    anchor: input.anchor,
    triggerElement: input.triggerElement,
    selectionOwnerElement: input.selectionOwnerElement,
    onDismiss: input.onDismiss,
    render: input.render,
  };
}

export function resolveToolbarAnchor(viewport: OverlayViewport): OverlayAnchorDescriptor {
  return {
    type: 'viewport-fixed',
    x: viewport.width / 2,
    y: viewport.height - 32,
  };
}

export function updateSelectionFloatingAnchor(
  contribution: OverlayContribution,
  anchor: Extract<OverlayAnchorDescriptor, { type: 'selection-bounds' }>,
): OverlayContribution {
  return {
    ...contribution,
    anchor,
  };
}
