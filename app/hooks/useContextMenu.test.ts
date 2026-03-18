import { describe, expect, it, mock } from 'bun:test';
import { sanitizeContextMenuItems, shouldDismissContextMenuForSelectionChange } from './useContextMenu.helpers';
import type { ContextMenuContext, ContextMenuItem } from '@/types/contextMenu';

const iconStub = () => null;

mock.module('lucide-react', () => ({
  Copy: iconStub,
  Download: iconStub,
  FileText: iconStub,
  Maximize: iconStub,
  MousePointerSquareDashed: iconStub,
  Pencil: iconStub,
  Plus: iconStub,
  Square: iconStub,
  Type: iconStub,
}));

const { resolveCanvasContextMenuSession } = await import('@/processes/canvas-runtime/bindings/contextMenu');

const paneContext: ContextMenuContext = {
  type: 'pane',
  position: { x: 40, y: 80 },
  selectedNodeIds: [],
  actions: {
    createCanvasNode: () => undefined,
    openExportDialog: () => undefined,
    fitView: () => undefined,
  },
};

describe('useContextMenu helpers', () => {
  it('resolves pane inventory through the context-menu binding', () => {
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
      'create-shape',
      'create-text',
      'create-markdown',
      'export-all',
      'fit-view',
    ]);
  });

  it('prefers runtime slot inventory when the binding receives one', () => {
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

    expect(resolved.surfaceKind).toBe('node-context-menu');
    expect(resolved.anchorId).toBe('context-menu:node:node-1');
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

  it('falls back to the existing registry when a runtime slot is empty', () => {
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
      'mindmap-add-child',
      'mindmap-add-sibling',
      'select-group',
    ]);
  });

  it('filters hidden items, sorts by order, and compacts separators', () => {
    const items: ContextMenuItem[] = [
      { type: 'separator' },
      {
        type: 'action',
        id: 'b',
        label: 'B',
        order: 20,
        handler: () => undefined,
      },
      {
        type: 'action',
        id: 'a',
        label: 'A',
        order: 10,
        handler: () => undefined,
      },
      {
        type: 'action',
        id: 'hidden',
        label: 'Hidden',
        order: 15,
        when: () => false,
        handler: () => undefined,
      },
      { type: 'separator' },
    ];

    expect(sanitizeContextMenuItems(items, paneContext)).toEqual([
      {
        type: 'action',
        id: 'a',
        label: 'A',
        order: 10,
        handler: expect.any(Function),
      },
      {
        type: 'action',
        id: 'b',
        label: 'B',
        order: 20,
        handler: expect.any(Function),
      },
    ]);
  });

  it('dismisses an open menu when selection context drifts', () => {
    expect(shouldDismissContextMenuForSelectionChange({
      instanceId: 'node-context-menu:1',
      context: {
        ...paneContext,
        type: 'node',
        nodeId: 'node-1',
        selectedNodeIds: ['node-1'],
      },
    }, ['node-2'])).toBe(true);

    expect(shouldDismissContextMenuForSelectionChange({
      instanceId: 'node-context-menu:1',
      context: {
        ...paneContext,
        type: 'node',
        nodeId: 'node-1',
        selectedNodeIds: ['node-1', 'node-2'],
      },
    }, ['node-2', 'node-1'])).toBe(false);
  });
});
