import {
  Download,
  FileText,
  Maximize,
  Square,
  Type,
} from 'lucide-react';
import type { ContextMenuItem } from '@/types/contextMenu';
export { nodeMenuItems } from '@/features/canvas-ui-entrypoints/node-context-menu';

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
