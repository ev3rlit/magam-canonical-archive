import React from 'react';
import { createSlotContribution } from './slots';
import type {
  OverlayContribution,
  OverlayDismissReason,
  OverlaySlotKind,
  OverlayViewport,
} from './types';

export function setTestViewportSize(viewport: OverlayViewport): void {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: viewport.width,
    writable: true,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: viewport.height,
    writable: true,
  });
}

export function createTestContribution(
    slot: OverlaySlotKind = 'pane-context-menu',
    input: Partial<OverlayContribution> = {},
): OverlayContribution {
    return createSlotContribution(slot, {
    anchor: input.anchor ?? { type: 'pointer', x: 40, y: 40 },
        focusPolicy: input.focusPolicy,
        replaceKey: input.replaceKey,
        triggerElement: input.triggerElement,
        selectionOwnerElement: input.selectionOwnerElement,
        onDismiss: input.onDismiss,
        render: input.render ?? (() => React.createElement(
            'button',
            {
                type: 'button',
                'data-overlay-actionable': 'true',
            },
            'Overlay action',
        )),
    });
}

export function createDismissTracker(): {
  reasons: OverlayDismissReason[];
  onDismiss: (reason: OverlayDismissReason) => void;
} {
  const reasons: OverlayDismissReason[] = [];
  return {
    reasons,
    onDismiss: (reason) => {
      reasons.push(reason);
    },
  };
}
