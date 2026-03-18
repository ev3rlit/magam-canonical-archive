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
import { buildNodeContextMenuModel } from './buildNodeContextMenuModel';
import type { NodeContextMenuActionId, NodeContextSnapshot } from './types';

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

function resolveActionState(ctx: ContextMenuContext, actionId: NodeContextMenuActionId) {
  const snapshot = getNodeContextSnapshot(ctx);
  if (!snapshot) {
    return { visibility: 'hidden' } as const;
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
    label: 'PNG로 복사',
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
    label: '선택 항목 내보내기',
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
    label: 'ID 변경',
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
    label: '자식 추가',
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
    label: '형제 추가',
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
    label: '그룹 선택',
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
    id: 'duplicate-node',
    label: '복제',
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
    label: '삭제',
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
    label: '잠금 토글',
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
