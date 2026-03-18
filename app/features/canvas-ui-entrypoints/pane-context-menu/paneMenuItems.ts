import {
  Download,
  FileText,
  Maximize,
  Square,
  Type,
} from 'lucide-react';
import type { ContextMenuContext, ContextMenuItem } from '@/types/contextMenu';

function canCreateFromPane(ctx: ContextMenuContext): boolean {
  return ctx.type === 'pane'
    && ctx.selectedNodeIds.length === 0
    && typeof ctx.actions?.createCanvasNode === 'function';
}

function canExportFromPane(ctx: ContextMenuContext): boolean {
  return ctx.type === 'pane'
    && typeof ctx.actions?.openExportDialog === 'function';
}

function canFitViewFromPane(ctx: ContextMenuContext): boolean {
  return ctx.type === 'pane'
    && typeof ctx.actions?.fitView === 'function';
}

export const paneMenuItems: ContextMenuItem[] = [
  {
    type: 'action',
    id: 'create-shape',
    label: '도형 생성',
    icon: Square,
    when: canCreateFromPane,
    handler: (ctx) => ctx.actions?.createCanvasNode?.('shape', ctx.position),
    order: 1,
  },
  {
    type: 'action',
    id: 'create-text',
    label: '텍스트 생성',
    icon: Type,
    when: canCreateFromPane,
    handler: (ctx) => ctx.actions?.createCanvasNode?.('text', ctx.position),
    order: 2,
  },
  {
    type: 'action',
    id: 'create-markdown',
    label: '마크다운 생성',
    icon: FileText,
    when: canCreateFromPane,
    handler: (ctx) => ctx.actions?.createCanvasNode?.('markdown', ctx.position),
    order: 3,
  },
  { type: 'separator' },
  {
    type: 'action',
    id: 'export-all',
    label: '전체 내보내기',
    icon: Download,
    when: canExportFromPane,
    handler: (ctx) => ctx.actions?.openExportDialog?.('full'),
    order: 10,
  },
  {
    type: 'action',
    id: 'fit-view',
    label: '화면에 맞추기',
    icon: Maximize,
    shortcut: 'Space',
    when: canFitViewFromPane,
    handler: (ctx) => ctx.actions?.fitView?.(),
    order: 20,
  },
];
