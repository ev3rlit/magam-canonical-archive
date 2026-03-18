import type { ActionRoutingRegistryEntry, ActionRoutingSurfaceId } from '@/features/editing/actionRoutingBridge/types';
import type { OverlaySlotKind } from '@/features/overlay-host/types';
import type { ContextMenuItem } from '@/types/contextMenu';

export type CanvasRuntimeSlotId =
  | 'canvas-toolbar'
  | 'selection-floating-menu'
  | 'pane-context-menu'
  | 'node-context-menu';

export interface ToolbarSectionContribution {
  sectionId: string;
  label?: string;
  order?: number;
}

export interface SelectionMenuItemContribution {
  itemId: string;
  intentId: string;
  label?: string;
  order?: number;
}

export interface CanvasShortcutContribution {
  shortcutId: string;
  key: string;
  surfaceId: ActionRoutingSurfaceId;
  intentId: string;
  description?: string;
}

export type CanvasIntentContribution = ActionRoutingRegistryEntry;

export interface CanvasRuntimeContribution {
  toolbarSections?: ToolbarSectionContribution[];
  selectionMenuItems?: SelectionMenuItemContribution[];
  paneMenuItems?: ContextMenuItem[];
  nodeMenuItems?: ContextMenuItem[];
  shortcuts?: CanvasShortcutContribution[];
  intents?: CanvasIntentContribution[];
}

export interface CanvasRuntimeFixedSlot<TItem> {
  slotId: CanvasRuntimeSlotId;
  overlaySlot: OverlaySlotKind;
  surfaceId: ActionRoutingSurfaceId;
  contributionPath: string;
  items: readonly TItem[];
}

export type CanvasToolbarSlot = CanvasRuntimeFixedSlot<ToolbarSectionContribution>;
export type SelectionFloatingMenuSlot = CanvasRuntimeFixedSlot<SelectionMenuItemContribution>;
export type PaneContextMenuSlot = CanvasRuntimeFixedSlot<ContextMenuItem>;
export type NodeContextMenuSlot = CanvasRuntimeFixedSlot<ContextMenuItem>;

export interface CanvasRuntimeSlots {
  canvasToolbar: CanvasToolbarSlot;
  selectionFloatingMenu: SelectionFloatingMenuSlot;
  paneContextMenu: PaneContextMenuSlot;
  nodeContextMenu: NodeContextMenuSlot;
}

export interface CanvasRuntimeContributionSet {
  canvasToolbar: CanvasRuntimeContribution;
  selectionFloatingMenu: CanvasRuntimeContribution;
  paneContextMenu: CanvasRuntimeContribution;
  nodeContextMenu: CanvasRuntimeContribution;
}

export interface CanvasRuntime {
  slots: CanvasRuntimeSlots;
  shortcuts: readonly CanvasShortcutContribution[];
  intents: readonly CanvasIntentContribution[];
}

export interface GraphCanvasHostBindingContract {
  runtime: CanvasRuntime;
  toolbarSlot: CanvasToolbarSlot;
  selectionFloatingMenuSlot: SelectionFloatingMenuSlot;
}

export interface ToolbarPresenterBindingContract {
  runtime: CanvasRuntime;
  toolbarSlot: CanvasToolbarSlot;
}

export interface ContextMenuBindingContract {
  runtime: CanvasRuntime;
  paneContextMenuSlot: PaneContextMenuSlot;
  nodeContextMenuSlot: NodeContextMenuSlot;
}

export interface ActionDispatchBindingContract {
  runtime: CanvasRuntime;
  intents: readonly CanvasIntentContribution[];
  shortcuts: readonly CanvasShortcutContribution[];
}

export function createCanvasRuntimeFixedSlot<TItem>(input: {
  slotId: CanvasRuntimeSlotId;
  overlaySlot: OverlaySlotKind;
  surfaceId: ActionRoutingSurfaceId;
  contributionPath: string;
  items?: readonly TItem[] | null;
}): CanvasRuntimeFixedSlot<TItem> {
  return {
    slotId: input.slotId,
    overlaySlot: input.overlaySlot,
    surfaceId: input.surfaceId,
    contributionPath: input.contributionPath,
    items: [...(input.items ?? [])],
  };
}
