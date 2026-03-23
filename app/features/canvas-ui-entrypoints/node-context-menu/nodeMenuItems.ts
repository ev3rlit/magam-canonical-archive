import {
  Copy,
  Download,
  Lock,
  MousePointerSquareDashed,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import type { ContextMenuContext, ContextMenuItem } from '@/types/contextMenu';
import { getCanvasUiCopy } from '@/features/canvas-ui-entrypoints/copy';
import { buildNodeContextMenuModel } from './buildNodeContextMenuModel';
import type { NodeContextMenuActionId, NodeContextMenuActionState, NodeContextSnapshot } from './types';

const copy = getCanvasUiCopy().nodeMenu;

function getNodeContextSnapshot(ctx: ContextMenuContext): NodeContextSnapshot | null {
  if (ctx.type !== 'node' || typeof ctx.nodeId !== 'string') {
    return null;
  }

  return {
    type: 'node',
    nodeId: ctx.nodeId,
    nodeFamily: ctx.nodeFamily,
    selectedNodeIds: ctx.selectedNodeIds,
    nodeContext: ctx.nodeContext,
  };
}

function resolveActionState(ctx: ContextMenuContext, actionId: NodeContextMenuActionId): NodeContextMenuActionState {
  const snapshot = getNodeContextSnapshot(ctx);
  if (!snapshot) {
    return { visibility: 'hidden' };
  }
  return buildNodeContextMenuModel(snapshot)[actionId];
}

function isVisible(actionId: NodeContextMenuActionId, ctx: ContextMenuContext): boolean {
  return resolveActionState(ctx, actionId).visibility !== 'hidden';
}

function isDisabled(actionId: NodeContextMenuActionId, ctx: ContextMenuContext): boolean {
  return resolveActionState(ctx, actionId).visibility === 'disabled';
}

function getDisabledReason(actionId: NodeContextMenuActionId, ctx: ContextMenuContext): string | undefined {
  return resolveActionState(ctx, actionId).disabledReason?.message;
}

export const nodeMenuItems: ContextMenuItem[] = [
  {
    type: 'action',
    id: 'copy-as-png',
    label: copy.copyAsPng,
    icon: Copy,
    shortcut: '⌘⇧C',
    when: (ctx) => isVisible('copy-as-png', ctx),
    disabled: (ctx) => isDisabled('copy-as-png', ctx),
    disabledReason: (ctx) => getDisabledReason('copy-as-png', ctx),
    handler: (ctx) => {
      if (!ctx.actions?.copyImageToClipboard) {
        return;
      }

      return ctx.actions.copyImageToClipboard(ctx.selectedNodeIds);
    },
    order: 1,
  },
  {
    type: 'action',
    id: 'export-selection',
    label: copy.exportSelection,
    icon: Download,
    when: (ctx) => isVisible('export-selection', ctx),
    disabled: (ctx) => isDisabled('export-selection', ctx),
    disabledReason: (ctx) => getDisabledReason('export-selection', ctx),
    handler: (ctx) => {
      if (!ctx.actions?.openExportDialog) {
        return;
      }

      ctx.actions.openExportDialog('selection', ctx.selectedNodeIds);
    },
    order: 2,
  },
  {
    type: 'action',
    id: 'rename-node',
    label: copy.renameNode,
    icon: Pencil,
    when: (ctx) => isVisible('rename-node', ctx),
    disabled: (ctx) => isDisabled('rename-node', ctx),
    disabledReason: (ctx) => getDisabledReason('rename-node', ctx),
    handler: (ctx) => {
      if (ctx.nodeId === undefined || !ctx.actions?.renameNode) {
        return;
      }

      return ctx.actions.renameNode(ctx.nodeId);
    },
    order: 10,
  },
  {
    type: 'action',
    id: 'mindmap-add-child',
    label: copy.addMindmapChild,
    icon: Plus,
    when: (ctx) => isVisible('mindmap-add-child', ctx),
    disabled: (ctx) => isDisabled('mindmap-add-child', ctx),
    disabledReason: (ctx) => getDisabledReason('mindmap-add-child', ctx),
    handler: (ctx) => {
      if (ctx.nodeId === undefined || !ctx.actions?.createMindMapChild) {
        return;
      }

      return ctx.actions.createMindMapChild(ctx.nodeId);
    },
    order: 20,
  },
  {
    type: 'action',
    id: 'mindmap-add-sibling',
    label: copy.addMindmapSibling,
    icon: Plus,
    when: (ctx) => isVisible('mindmap-add-sibling', ctx),
    disabled: (ctx) => isDisabled('mindmap-add-sibling', ctx),
    disabledReason: (ctx) => getDisabledReason('mindmap-add-sibling', ctx),
    handler: (ctx) => {
      if (ctx.nodeId === undefined || !ctx.actions?.createMindMapSibling) {
        return;
      }

      return ctx.actions.createMindMapSibling(ctx.nodeId);
    },
    order: 21,
  },
  {
    type: 'action',
    id: 'select-group',
    label: copy.selectGroup,
    icon: MousePointerSquareDashed,
    when: (ctx) => isVisible('select-group', ctx),
    disabled: (ctx) => isDisabled('select-group', ctx),
    disabledReason: (ctx) => getDisabledReason('select-group', ctx),
    handler: (ctx) => {
      if (ctx.nodeId === undefined || !ctx.actions?.selectNodeGroup) {
        return;
      }

      return ctx.actions.selectNodeGroup(ctx.nodeId);
    },
    order: 30,
  },
  {
    type: 'action',
    id: 'enter-group',
    label: copy.enterGroup,
    icon: MousePointerSquareDashed,
    when: (ctx) => isVisible('enter-group', ctx),
    disabled: (ctx) => isDisabled('enter-group', ctx),
    disabledReason: (ctx) => getDisabledReason('enter-group', ctx),
    handler: (ctx) => {
      if (ctx.nodeId === undefined || !ctx.actions?.enterNodeGroup) {
        return;
      }

      return ctx.actions.enterNodeGroup(ctx.nodeId);
    },
    order: 31,
  },
  {
    type: 'action',
    id: 'group-selection',
    label: copy.groupSelection,
    icon: Plus,
    when: (ctx) => isVisible('group-selection', ctx),
    disabled: (ctx) => isDisabled('group-selection', ctx),
    disabledReason: (ctx) => getDisabledReason('group-selection', ctx),
    handler: (ctx) => {
      if (ctx.nodeId === undefined || !ctx.actions?.groupSelection) {
        return;
      }

      return ctx.actions.groupSelection(ctx.nodeId);
    },
    order: 32,
  },
  {
    type: 'action',
    id: 'ungroup-selection',
    label: copy.ungroupSelection,
    icon: MousePointerSquareDashed,
    when: (ctx) => isVisible('ungroup-selection', ctx),
    disabled: (ctx) => isDisabled('ungroup-selection', ctx),
    disabledReason: (ctx) => getDisabledReason('ungroup-selection', ctx),
    handler: (ctx) => {
      if (ctx.nodeId === undefined || !ctx.actions?.ungroupSelection) {
        return;
      }

      return ctx.actions.ungroupSelection(ctx.nodeId);
    },
    order: 33,
  },
  {
    type: 'action',
    id: 'bring-to-front',
    label: copy.bringToFront,
    icon: Copy,
    when: (ctx) => isVisible('bring-to-front', ctx),
    disabled: (ctx) => isDisabled('bring-to-front', ctx),
    disabledReason: (ctx) => getDisabledReason('bring-to-front', ctx),
    handler: (ctx) => {
      if (ctx.nodeId === undefined || !ctx.actions?.bringSelectionToFront) {
        return;
      }

      return ctx.actions.bringSelectionToFront(ctx.nodeId);
    },
    order: 34,
  },
  {
    type: 'action',
    id: 'send-to-back',
    label: copy.sendToBack,
    icon: Download,
    when: (ctx) => isVisible('send-to-back', ctx),
    disabled: (ctx) => isDisabled('send-to-back', ctx),
    disabledReason: (ctx) => getDisabledReason('send-to-back', ctx),
    handler: (ctx) => {
      if (ctx.nodeId === undefined || !ctx.actions?.sendSelectionToBack) {
        return;
      }

      return ctx.actions.sendSelectionToBack(ctx.nodeId);
    },
    order: 35,
  },
  {
    type: 'action',
    id: 'duplicate-node',
    label: copy.duplicateNode,
    icon: Copy,
    when: (ctx) => isVisible('duplicate-node', ctx),
    disabled: (ctx) => isDisabled('duplicate-node', ctx),
    disabledReason: (ctx) => getDisabledReason('duplicate-node', ctx),
    handler: (ctx) => {
      if (ctx.nodeId === undefined || !ctx.actions?.duplicateNode) {
        return;
      }

      return ctx.actions.duplicateNode(ctx.nodeId);
    },
    order: 40,
  },
  {
    type: 'action',
    id: 'delete-node',
    label: copy.deleteNode,
    icon: Trash2,
    when: (ctx) => isVisible('delete-node', ctx),
    disabled: (ctx) => isDisabled('delete-node', ctx),
    disabledReason: (ctx) => getDisabledReason('delete-node', ctx),
    handler: (ctx) => {
      if (ctx.nodeId === undefined || !ctx.actions?.deleteNode) {
        return;
      }

      return ctx.actions.deleteNode(ctx.nodeId);
    },
    order: 41,
  },
  {
    type: 'action',
    id: 'lock-node',
    label: copy.toggleLock,
    icon: Lock,
    when: (ctx) => isVisible('lock-node', ctx),
    disabled: (ctx) => isDisabled('lock-node', ctx),
    disabledReason: (ctx) => getDisabledReason('lock-node', ctx),
    handler: (ctx) => {
      if (ctx.nodeId === undefined || !ctx.actions?.toggleNodeLock) {
        return;
      }

      return ctx.actions.toggleNodeLock(ctx.nodeId);
    },
    order: 42,
  },
];
