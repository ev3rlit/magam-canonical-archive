import {
  Bookmark,
  Circle,
  Diamond,
  Download,
  FileText,
  Image as ImageIcon,
  Maximize,
  Minus,
  Square,
  StickyNote,
  Ticket,
  Type,
  Workflow,
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
    type: 'submenu',
    id: 'create-mindmap',
    label: copy.createMindmap,
    icon: Workflow,
    when: canCreateFromPane,
    children: [
      {
        type: 'action',
        id: 'create-mindmap-rectangle',
        label: copy.createRectangle,
        icon: Square,
        handler: (ctx) => ctx.actions?.createMindMapRoot?.('rectangle', ctx.position),
        order: 1,
      },
      {
        type: 'action',
        id: 'create-mindmap-ellipse',
        label: copy.createEllipse,
        icon: Circle,
        handler: (ctx) => ctx.actions?.createMindMapRoot?.('ellipse', ctx.position),
        order: 2,
      },
      {
        type: 'action',
        id: 'create-mindmap-diamond',
        label: copy.createDiamond,
        icon: Diamond,
        handler: (ctx) => ctx.actions?.createMindMapRoot?.('diamond', ctx.position),
        order: 3,
      },
      {
        type: 'action',
        id: 'create-mindmap-text',
        label: copy.createText,
        icon: Type,
        handler: (ctx) => ctx.actions?.createMindMapRoot?.('text', ctx.position),
        order: 4,
      },
      {
        type: 'action',
        id: 'create-mindmap-markdown',
        label: copy.createMarkdown,
        icon: FileText,
        handler: (ctx) => ctx.actions?.createMindMapRoot?.('markdown', ctx.position),
        order: 5,
      },
      {
        type: 'action',
        id: 'create-mindmap-line',
        label: copy.createLine,
        icon: Minus,
        handler: (ctx) => ctx.actions?.createMindMapRoot?.('line', ctx.position),
        order: 6,
      },
      {
        type: 'action',
        id: 'create-mindmap-sticky',
        label: copy.createSticky,
        icon: StickyNote,
        handler: (ctx) => ctx.actions?.createMindMapRoot?.('sticky', ctx.position),
        order: 7,
      },
      {
        type: 'action',
        id: 'create-mindmap-image',
        label: copy.createImage,
        icon: ImageIcon,
        handler: (ctx) => ctx.actions?.createMindMapRoot?.('image', ctx.position),
        order: 8,
      },
      {
        type: 'action',
        id: 'create-mindmap-sticker',
        label: copy.createSticker,
        icon: Ticket,
        handler: (ctx) => ctx.actions?.createMindMapRoot?.('sticker', ctx.position),
        order: 9,
      },
      {
        type: 'action',
        id: 'create-mindmap-washi-tape',
        label: copy.createWashiTape,
        icon: Bookmark,
        handler: (ctx) => ctx.actions?.createMindMapRoot?.('washi-tape', ctx.position),
        order: 10,
      },
    ],
    order: 0,
  },
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
  {
    type: 'action',
    id: 'create-image',
    label: copy.createImage,
    icon: ImageIcon,
    when: canCreateFromPane,
    handler: (ctx) => ctx.actions?.createCanvasNode?.('image', ctx.position),
    order: 8,
  },
  {
    type: 'action',
    id: 'create-sticker',
    label: copy.createSticker,
    icon: Ticket,
    when: canCreateFromPane,
    handler: (ctx) => ctx.actions?.createCanvasNode?.('sticker', ctx.position),
    order: 9,
  },
  {
    type: 'action',
    id: 'create-washi-tape',
    label: copy.createWashiTape,
    icon: Bookmark,
    when: canCreateFromPane,
    handler: (ctx) => ctx.actions?.createCanvasNode?.('washi-tape', ctx.position),
    order: 10,
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
