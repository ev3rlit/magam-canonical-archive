import { describe, expect, it, mock } from 'bun:test';

const iconStub = () => null;

mock.module('lucide-react', () => ({
  Download: iconStub,
  FileText: iconStub,
  Maximize: iconStub,
  Square: iconStub,
  Type: iconStub,
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
      openExportDialog: () => undefined,
      fitView: () => undefined,
    };

    expect(listVisibleItemIds({
      position: { x: 40, y: 80 },
      selectedNodeIds: [],
      canCreateNode: true,
      actions: baseActions,
    })).toEqual([
      'create-shape',
      'create-text',
      'create-markdown',
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
        openExportDialog: (scope) => {
          exportCalls.push(scope);
        },
        fitView: () => {
          fitViewCalls += 1;
        },
      },
    });

    const actions = paneMenuItems.filter((item) => item.type === 'action');
    await actions[0]?.handler(context);
    await actions[3]?.handler(context);
    await actions[4]?.handler(context);

    expect(createCalls).toEqual([['shape', { x: 10, y: 20 }]]);
    expect(exportCalls).toEqual(['full']);
    expect(fitViewCalls).toBe(1);
  });
});
