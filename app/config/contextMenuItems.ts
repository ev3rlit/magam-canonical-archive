import {
  Copy,
  Download,
  FileText,
  Maximize,
  MousePointerSquareDashed,
  Pencil,
  Plus,
  Square,
  Type,
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

export const paneMenuItems: ContextMenuItem[] = [
  {
    type: 'action',
    id: 'create-shape',
    label: '도형 생성',
    icon: Square,
    handler: (ctx) => {
      if (!ctx.actions?.createCanvasNode) {
        return;
      }

      return ctx.actions.createCanvasNode('shape', ctx.position);
    },
    order: 1,
  },
  {
    type: 'action',
    id: 'create-text',
    label: '텍스트 생성',
    icon: Type,
    handler: (ctx) => {
      if (!ctx.actions?.createCanvasNode) {
        return;
      }

      return ctx.actions.createCanvasNode('text', ctx.position);
    },
    order: 2,
  },
  {
    type: 'action',
    id: 'create-markdown',
    label: '마크다운 생성',
    icon: FileText,
    handler: (ctx) => {
      if (!ctx.actions?.createCanvasNode) {
        return;
      }

      return ctx.actions.createCanvasNode('markdown', ctx.position);
    },
    order: 3,
  },
  { type: 'separator' },
  {
    type: 'action',
    id: 'export-all',
    label: '전체 내보내기',
    icon: Download,
    handler: (ctx) => {
      if (!ctx.actions?.openExportDialog) {
        return;
      }

      ctx.actions.openExportDialog('full');
    },
    order: 10,
  },
  {
    type: 'action',
    id: 'fit-view',
    label: '화면에 맞추기',
    icon: Maximize,
    shortcut: 'Space',
    handler: (ctx) => {
      if (!ctx.actions?.fitView) {
        return;
      }

      ctx.actions.fitView();
    },
    order: 20,
  },
];
