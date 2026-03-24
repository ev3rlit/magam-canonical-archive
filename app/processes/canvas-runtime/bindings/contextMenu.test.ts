import { describe, expect, it, mock } from 'bun:test';
import type { ContextMenuContext } from '@/types/contextMenu';

const iconStub = () => null;

mock.module('lucide-react', () => ({
  Bookmark: iconStub,
  Circle: iconStub,
  Copy: iconStub,
  Diamond: iconStub,
  Download: iconStub,
  FileText: iconStub,
  Image: iconStub,
  Lock: iconStub,
  Maximize: iconStub,
  Minus: iconStub,
  MousePointerSquareDashed: iconStub,
  Pencil: iconStub,
  Plus: iconStub,
  Square: iconStub,
  StickyNote: iconStub,
  Ticket: iconStub,
  Trash2: iconStub,
  Type: iconStub,
  Workflow: iconStub,
}));

const {
  buildContextMenuAnchorId,
  resolveCanvasContextMenuSession,
  resolveContextMenuSurfaceKind,
} = await import('./contextMenu');

const paneContext: ContextMenuContext = {
  type: 'pane',
  position: { x: 40, y: 80 },
  selectedNodeIds: [],
  actions: {
    createCanvasNode: () => undefined,
    createMindMapRoot: () => undefined,
    openExportDialog: () => undefined,
    fitView: () => undefined,
  },
};

describe('contextMenu binding', () => {
  it('derives fixed anchor ids and surface kinds from the requested context', () => {
    expect(buildContextMenuAnchorId(paneContext)).toBe('context-menu:pane');
    expect(resolveContextMenuSurfaceKind(paneContext)).toBe('pane-context-menu');
    expect(resolveContextMenuSurfaceKind({
      ...paneContext,
      type: 'node',
      nodeId: 'node-1',
      selectedNodeIds: ['node-1'],
    })).toBe('node-context-menu');
  });

  it('resolves pane sessions through the fixed runtime slot contract', () => {
    const resolved = resolveCanvasContextMenuSession({
      context: paneContext,
    });

    expect(resolved.surfaceKind).toBe('pane-context-menu');
    expect(resolved.anchorId).toBe('context-menu:pane');
    expect(resolved.context).toMatchObject({
      type: 'pane',
      anchorId: 'context-menu:pane',
      surfaceKind: 'pane-context-menu',
    });
    expect(resolved.openSurface).toMatchObject({
      kind: 'pane-context-menu',
      anchorId: 'context-menu:pane',
      dismissOnSelectionChange: false,
      dismissOnViewportChange: true,
    });
    expect(resolved.items.map((item) => item.type === 'action' ? item.id : item.type)).toEqual([
      'submenu',
      'separator',
      'create-rectangle',
      'create-ellipse',
      'create-diamond',
      'create-text',
      'create-markdown',
      'create-line',
      'create-sticky',
      'create-image',
      'create-sticker',
      'create-washi-tape',
      'export-all',
      'fit-view',
    ]);
  });

  it('prefers runtime slot items when the fixed slot receives an override', () => {
    const resolved = resolveCanvasContextMenuSession({
      context: {
        ...paneContext,
        type: 'node',
        nodeId: 'node-1',
        selectedNodeIds: ['node-1'],
      },
      runtime: {
        slots: {
          nodeContextMenu: {
            items: [
              {
                type: 'action',
                id: 'runtime-action',
                label: 'Runtime action',
                order: 10,
                handler: () => undefined,
              },
            ],
          },
        },
      },
    });

    expect(resolved.items).toEqual([
      {
        type: 'action',
        id: 'runtime-action',
        label: 'Runtime action',
        order: 10,
        handler: expect.any(Function),
      },
    ]);
  });

  it('falls back to the existing registry when a fixed slot is intentionally empty', () => {
    const resolved = resolveCanvasContextMenuSession({
      context: {
        ...paneContext,
        type: 'node',
        nodeId: 'node-1',
        nodeFamily: 'mindmap-member',
        selectedNodeIds: ['node-1'],
      },
      runtime: {
        slots: {
          nodeContextMenu: {
            items: [],
          },
        },
      },
    });

    expect(resolved.items.map((item) => item.type === 'action' ? item.id : item.type)).toEqual([
      'copy-as-png',
      'export-selection',
      'rename-node',
      'select-group',
      'bring-to-front',
      'send-to-back',
      'duplicate-node',
      'delete-node',
      'lock-node',
    ]);
  });
});
