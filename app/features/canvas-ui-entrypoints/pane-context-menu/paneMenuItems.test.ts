import { describe, expect, it, mock } from 'bun:test';

const iconStub = () => null;

mock.module('lucide-react', () => ({
  Bookmark: iconStub,
  Circle: iconStub,
  Diamond: iconStub,
  Download: iconStub,
  FileText: iconStub,
  Image: iconStub,
  Maximize: iconStub,
  Minus: iconStub,
  Square: iconStub,
  StickyNote: iconStub,
  Ticket: iconStub,
  Type: iconStub,
  Workflow: iconStub,
}));

const { sanitizeContextMenuItems } = await import('@/hooks/useContextMenu.helpers');
const { buildPaneMenuContext } = await import('./buildPaneMenuContext');
const { paneMenuItems } = await import('./paneMenuItems');

function listVisibleItemIds(input: Parameters<typeof buildPaneMenuContext>[0]): string[] {
  return sanitizeContextMenuItems(
    paneMenuItems,
    buildPaneMenuContext(input),
  ).map((item) => item.type === 'action' ? item.id : item.type);
}

describe('paneMenuItems', () => {
  it('shows create actions only for an empty pane surface with create capability', () => {
    const baseActions = {
      createCanvasNode: () => undefined,
      createMindMapRoot: () => undefined,
      openExportDialog: () => undefined,
      fitView: () => undefined,
    };

    expect(listVisibleItemIds({
      position: { x: 40, y: 80 },
      selectedNodeIds: [],
      canCreateNode: true,
      actions: baseActions,
    })).toEqual([
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

    expect(listVisibleItemIds({
      position: { x: 40, y: 80 },
      selectedNodeIds: ['node-1'],
      canCreateNode: true,
      actions: baseActions,
    })).toEqual([
      'export-all',
      'fit-view',
    ]);

    expect(listVisibleItemIds({
      position: { x: 40, y: 80 },
      selectedNodeIds: [],
      canCreateNode: false,
      actions: baseActions,
    })).toEqual([
      'export-all',
      'fit-view',
    ]);
  });

  it('dispatches pane-owned handlers with the expected payloads', async () => {
    const createCalls: Array<[string, { x: number; y: number }]> = [];
    const exportCalls: string[] = [];
    let fitViewCalls = 0;

    const context = buildPaneMenuContext({
      position: { x: 10, y: 20 },
      selectedNodeIds: [],
      canCreateNode: true,
      actions: {
        createCanvasNode: (nodeType, position) => {
          createCalls.push([nodeType, position]);
        },
        createMindMapRoot: () => undefined,
        openExportDialog: (scope) => {
          exportCalls.push(scope);
        },
        fitView: () => {
          fitViewCalls += 1;
        },
      },
    });

    const actions = paneMenuItems.filter((item) => item.type === 'action');
    await actions.find((item) => item.id === 'create-rectangle')?.handler(context);
    await actions.find((item) => item.id === 'export-all')?.handler(context);
    await actions.find((item) => item.id === 'fit-view')?.handler(context);

    expect(createCalls).toEqual([['rectangle', { x: 10, y: 20 }]]);
    expect(exportCalls).toEqual(['full']);
    expect(fitViewCalls).toBe(1);
  });
});
