import {
  Copy,
  Download,
  MousePointerSquareDashed,
  Pencil,
  Plus,
} from 'lucide-react';
import type { ContextMenuItem } from '@/types/contextMenu';

export const nodeMenuItems: ContextMenuItem[] = [
  {
    type: 'action',
    id: 'copy-as-png',
    label: 'PNG로 복사',
    icon: Copy,
    shortcut: '⌘⇧C',
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
    when: (ctx) => ctx.selectedNodeIds.length > 0,
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
    when: (ctx) => ctx.nodeId !== undefined,
    handler: (ctx) => {
      if (ctx.nodeId === undefined || !ctx.actions?.renameNode) {
        return;
      }

      return ctx.actions.renameNode(ctx.nodeId);
    },
    order: 3,
  },
  {
    type: 'action',
    id: 'mindmap-add-child',
    label: '자식 추가',
    icon: Plus,
    when: (ctx) => ctx.nodeId !== undefined && ctx.nodeFamily === 'mindmap-member',
    handler: (ctx) => {
      if (ctx.nodeId === undefined || !ctx.actions?.createMindMapChild) {
        return;
      }

      return ctx.actions.createMindMapChild(ctx.nodeId);
    },
    order: 4,
  },
  {
    type: 'action',
    id: 'mindmap-add-sibling',
    label: '형제 추가',
    icon: Plus,
    when: (ctx) => ctx.nodeId !== undefined && ctx.nodeFamily === 'mindmap-member',
    handler: (ctx) => {
      if (ctx.nodeId === undefined || !ctx.actions?.createMindMapSibling) {
        return;
      }

      return ctx.actions.createMindMapSibling(ctx.nodeId);
    },
    order: 5,
  },
  { type: 'separator' },
  {
    type: 'action',
    id: 'select-group',
    label: '그룹 선택',
    icon: MousePointerSquareDashed,
    when: (ctx) => ctx.nodeId !== undefined,
    handler: (ctx) => {
      if (ctx.nodeId === undefined || !ctx.actions?.selectMindMapGroupByNodeId) {
        return;
      }

      ctx.actions.selectMindMapGroupByNodeId(ctx.nodeId);
    },
    order: 10,
  },
];
