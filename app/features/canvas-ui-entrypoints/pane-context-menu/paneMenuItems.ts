import {
  Circle,
  Diamond,
  Download,
  FileText,
  Maximize,
  Minus,
  Square,
  StickyNote,
  Type,
} from 'lucide-react';
import type { ContextMenuContext, ContextMenuItem } from '@/types/contextMenu';
import { getCanvasUiCopy } from '@/features/canvas-ui-entrypoints/copy';

const copy = getCanvasUiCopy().paneMenu;

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
    id: 'create-rectangle',
    label: copy.createRectangle,
    icon: Square,
    when: canCreateFromPane,
    handler: (ctx) => ctx.actions?.createCanvasNode?.('rectangle', ctx.position),
    order: 1,
  },
  {
    type: 'action',
    id: 'create-ellipse',
    label: copy.createEllipse,
    icon: Circle,
    when: canCreateFromPane,
    handler: (ctx) => ctx.actions?.createCanvasNode?.('ellipse', ctx.position),
    order: 2,
  },
  {
    type: 'action',
    id: 'create-diamond',
    label: copy.createDiamond,
    icon: Diamond,
    when: canCreateFromPane,
    handler: (ctx) => ctx.actions?.createCanvasNode?.('diamond', ctx.position),
    order: 3,
  },
  {
    type: 'action',
    id: 'create-text',
    label: copy.createText,
    icon: Type,
    when: canCreateFromPane,
    handler: (ctx) => ctx.actions?.createCanvasNode?.('text', ctx.position),
    order: 4,
  },
  {
    type: 'action',
    id: 'create-markdown',
    label: copy.createMarkdown,
    icon: FileText,
    when: canCreateFromPane,
    handler: (ctx) => ctx.actions?.createCanvasNode?.('markdown', ctx.position),
    order: 5,
  },
  {
    type: 'action',
    id: 'create-line',
    label: copy.createLine,
    icon: Minus,
    when: canCreateFromPane,
    handler: (ctx) => ctx.actions?.createCanvasNode?.('line', ctx.position),
    order: 6,
  },
  {
    type: 'action',
    id: 'create-sticky',
    label: copy.createSticky,
    icon: StickyNote,
    when: canCreateFromPane,
    handler: (ctx) => ctx.actions?.createCanvasNode?.('sticky', ctx.position),
    order: 7,
  },
  { type: 'separator' },
  {
    type: 'action',
    id: 'export-all',
    label: copy.exportAll,
    icon: Download,
    when: canExportFromPane,
    handler: (ctx) => ctx.actions?.openExportDialog?.('full'),
    order: 10,
  },
  {
    type: 'action',
    id: 'fit-view',
    label: copy.fitView,
    icon: Maximize,
    shortcut: 'Space',
    when: canFitViewFromPane,
    handler: (ctx) => ctx.actions?.fitView?.(),
    order: 20,
  },
];
