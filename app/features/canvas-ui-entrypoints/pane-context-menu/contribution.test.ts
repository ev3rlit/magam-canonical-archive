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

const { createPaneContextMenuSlot } = await import('@/processes/canvas-runtime/builtin-slots/paneContextMenu');
const { buildPaneMenuContext } = await import('./buildPaneMenuContext');
const paneContextMenuContribution = (await import('./contribution')).default;

describe('pane context menu contribution', () => {
  it('exports pane items through the fixed slot contract', () => {
    const slot = createPaneContextMenuSlot(paneContextMenuContribution);

    expect(slot).toMatchObject({
      slotId: 'pane-context-menu',
      overlaySlot: 'pane-context-menu',
      surfaceId: 'pane-context-menu',
      contributionPath: 'app/features/canvas-ui-entrypoints/pane-context-menu/contribution.ts',
    });
    expect(slot.items).toEqual(paneContextMenuContribution.paneMenuItems);
  });

  it('builds an empty-surface pane context without node-specific metadata', () => {
    const context = buildPaneMenuContext({
      position: { x: 12, y: 24 },
      selectedNodeIds: [],
      canCreateNode: false,
      actions: {
        createCanvasNode: () => undefined,
        createMindMapRoot: () => undefined,
        openExportDialog: () => undefined,
        fitView: () => undefined,
      },
    });

    expect(context).toMatchObject({
      type: 'pane',
      position: { x: 12, y: 24 },
      selectedNodeIds: [],
      actions: {
        openExportDialog: expect.any(Function),
        fitView: expect.any(Function),
      },
    });
    expect(context.nodeId).toBeUndefined();
    expect(context.nodeFamily).toBeUndefined();
    expect(context.actions?.createCanvasNode).toBeUndefined();
  });
});
