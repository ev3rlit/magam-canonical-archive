import type { ReactNode } from 'react';

export type OverlaySlotKind =
  | 'toolbar'
  | 'selection-floating-menu'
  | 'pane-context-menu'
  | 'node-context-menu';

export type OverlayDismissReason =
  | 'outside-pointer'
  | 'escape-key'
  | 'selection-change'
  | 'viewport-teardown'
  | 'programmatic-close'
  | 'programmatic-replace';

export type OverlayPlacement = 'top-start' | 'top-center' | 'bottom-center';

export type OverlayAnchorDescriptor =
  | { type: 'pointer'; x: number; y: number }
  | { type: 'selection-bounds'; x: number; y: number; width: number; height: number }
  | { type: 'viewport-fixed'; x: number; y: number };

export type OverlayFocusPolicy = {
  openTarget?: 'first-actionable' | 'explicit-target' | 'none';
  openTargetId?: string;
  restoreTarget?: 'trigger' | 'selection-owner' | 'explicit-target' | 'none';
  restoreTargetId?: string;
};

export type OverlayViewport = {
  width: number;
  height: number;
};

export type OverlaySize = {
  width: number;
  height: number;
};

export type OverlayRenderArgs = {
  instanceId: string;
  close: (reason?: OverlayDismissReason) => void;
  isTopMost: boolean;
};

export type OverlayContribution = {
  slot: OverlaySlotKind;
  priority: number;
  dismissible: boolean;
  anchor: OverlayAnchorDescriptor;
  placement: OverlayPlacement;
  focusPolicy?: OverlayFocusPolicy;
  replaceKey?: string;
  estimatedSize: OverlaySize;
  triggerElement?: HTMLElement | null;
  selectionOwnerElement?: HTMLElement | null;
  onDismiss?: (reason: OverlayDismissReason) => void;
  render: (args: OverlayRenderArgs) => ReactNode;
};

export type OverlayInstanceState = OverlayContribution & {
  instanceId: string;
  openedAt: number;
  resolvedPosition: { x: number; y: number };
  measuredSize: OverlaySize;
};

export type OverlayHostState = {
  active: OverlayInstanceState[];
  lastDismissed?: {
    slot: OverlaySlotKind;
    reason: OverlayDismissReason;
    at: number;
  };
};

export type OverlayHostApi = {
  open: (contribution: OverlayContribution) => string;
  close: (instanceId: string, reason: OverlayDismissReason) => void;
  replace: (instanceId: string, contribution: OverlayContribution) => string;
  closeBySlot: (slot: OverlaySlotKind, reason: OverlayDismissReason) => void;
  getActive: () => OverlayInstanceState[];
};
