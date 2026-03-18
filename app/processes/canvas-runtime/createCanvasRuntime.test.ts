import { describe, expect, it, mock } from 'bun:test';
import type { ActionRoutingRegistryEntry } from '@/features/editing/actionRoutingBridge/types';

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

const { nodeMenuItems } = await import('@/config/contextMenuItems');
const { paneMenuItems } = await import('@/features/canvas-ui-entrypoints/pane-context-menu/paneMenuItems');
const { canvasRuntime, createCanvasRuntime } = await import('./createCanvasRuntime');

describe('createCanvasRuntime', () => {
  it('assembles the fixed built-in slots from the reserved contribution paths', () => {
    expect(canvasRuntime.slots.canvasToolbar).toMatchObject({
      slotId: 'canvas-toolbar',
      overlaySlot: 'toolbar',
      surfaceId: 'toolbar',
      contributionPath: 'app/features/canvas-ui-entrypoints/canvas-toolbar/contribution.ts',
    });
    expect(canvasRuntime.slots.selectionFloatingMenu).toMatchObject({
      slotId: 'selection-floating-menu',
      overlaySlot: 'selection-floating-menu',
      surfaceId: 'selection-floating-menu',
      contributionPath: 'app/features/canvas-ui-entrypoints/selection-floating-menu/contribution.ts',
    });
    expect(canvasRuntime.slots.paneContextMenu).toMatchObject({
      slotId: 'pane-context-menu',
      overlaySlot: 'pane-context-menu',
      surfaceId: 'pane-context-menu',
      contributionPath: 'app/features/canvas-ui-entrypoints/pane-context-menu/contribution.ts',
    });
    expect(canvasRuntime.slots.nodeContextMenu).toMatchObject({
      slotId: 'node-context-menu',
      overlaySlot: 'node-context-menu',
      surfaceId: 'node-context-menu',
      contributionPath: 'app/features/canvas-ui-entrypoints/node-context-menu/contribution.ts',
    });
  });

  it('preserves current pane/node menu inventories while leaving empty placeholders safe', () => {
    expect(canvasRuntime.slots.canvasToolbar.items).toEqual([]);
    expect(canvasRuntime.slots.selectionFloatingMenu.items).toEqual([]);
    expect(canvasRuntime.slots.paneContextMenu.items).toEqual(paneMenuItems);
    expect(canvasRuntime.slots.nodeContextMenu.items).toEqual(nodeMenuItems);
  });

  it('flattens slot-specific shortcuts and intents into one runtime object', () => {
    const intent: ActionRoutingRegistryEntry = {
      intentId: 'selection.style.update',
      supportedSurfaces: ['selection-floating-menu'],
      isEnabled: () => ({ ok: true, value: true }),
      normalizePayload: () => ({ ok: true, value: {} }),
      buildDispatch: () => ({
        ok: true,
        value: {
          intentId: 'selection.style.update',
          steps: [
            {
              kind: 'runtime-only-action',
              actionId: 'fit-view',
              payload: {},
            },
          ],
          rollbackSteps: [],
        },
      }),
    };

    const runtime = createCanvasRuntime({
      contributions: {
        canvasToolbar: {
          toolbarSections: [{ sectionId: 'main-tools', order: 10 }],
          shortcuts: [{
            shortcutId: 'toolbar.pointer',
            key: 'v',
            surfaceId: 'toolbar',
            intentId: 'tool.pointer',
          }],
        },
        selectionFloatingMenu: {
          selectionMenuItems: [{
            itemId: 'selection-style',
            intentId: 'selection.style.update',
            order: 20,
          }],
          intents: [intent],
        },
      },
    });

    expect(runtime.slots.canvasToolbar.items).toEqual([{ sectionId: 'main-tools', order: 10 }]);
    expect(runtime.slots.selectionFloatingMenu.items).toEqual([
      { itemId: 'selection-style', intentId: 'selection.style.update', order: 20 },
    ]);
    expect(runtime.shortcuts).toEqual([{
      shortcutId: 'toolbar.pointer',
      key: 'v',
      surfaceId: 'toolbar',
      intentId: 'tool.pointer',
    }]);
    expect(runtime.intents).toEqual([intent]);
  });

  it('treats empty placeholder contributions as safe no-op slots', () => {
    const runtime = createCanvasRuntime({
      contributions: {
        canvasToolbar: {},
        selectionFloatingMenu: {},
        paneContextMenu: {},
        nodeContextMenu: {},
      },
    });

    expect(runtime.slots.canvasToolbar.items).toEqual([]);
    expect(runtime.slots.selectionFloatingMenu.items).toEqual([]);
    expect(runtime.slots.paneContextMenu.items).toEqual([]);
    expect(runtime.slots.nodeContextMenu.items).toEqual([]);
    expect(runtime.shortcuts).toEqual([]);
    expect(runtime.intents).toEqual([]);
  });
});
