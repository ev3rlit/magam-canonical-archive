import { describe, expect, it, mock } from 'bun:test';
import { resolveNodeActionRoutingContext } from '@/components/editor/workspaceEditUtils';
import { sanitizeContextMenuItems } from '@/hooks/useContextMenu.helpers';
import { createNodeContextMenuSlot } from '@/processes/canvas-runtime/builtin-slots/nodeContextMenu';
import {
  mindmapBridgeNodeFixture,
  stickerBridgeNodeFixture,
} from '@/features/editing/__fixtures__/actionRoutingBridgeFixtures';
import type { ContextMenuContext } from '@/types/contextMenu';
import nodeContextMenuContribution from './contribution';

const iconStub = () => null;

mock.module('lucide-react', () => ({
  Copy: iconStub,
  Download: iconStub,
  FileText: iconStub,
  Lock: iconStub,
  Maximize: iconStub,
  MousePointerSquareDashed: iconStub,
  Pencil: iconStub,
  Plus: iconStub,
  Square: iconStub,
  Trash2: iconStub,
  Type: iconStub,
}));

function resolveDisabledState(ctx: ContextMenuContext, actionId: string): boolean {
  const action = nodeContextMenuContribution.nodeMenuItems.find(
    (item) => item.type === 'action' && item.id === actionId,
  );
  if (!action || action.type !== 'action') {
    return false;
  }

  return typeof action.disabled === 'function'
    ? action.disabled(ctx)
    : Boolean(action.disabled);
}

function makeNodeContext(input: {
  node: typeof stickerBridgeNodeFixture;
  currentFile: string | null;
  selectedNodeIds: string[];
}): ContextMenuContext {
  return {
    type: 'node',
    position: { x: 40, y: 80 },
    nodeId: input.node.id,
    nodeFamily: input.node.data?.editMeta?.family,
    nodeContext: resolveNodeActionRoutingContext(
      input.node,
      input.currentFile,
      input.selectedNodeIds,
    ),
    selectedNodeIds: input.selectedNodeIds,
  };
}

describe('nodeContextMenu contribution', () => {
  it('matches the reserved fixed-slot contract for canvas runtime', () => {
    const slot = createNodeContextMenuSlot(nodeContextMenuContribution);

    expect(slot).toMatchObject({
      slotId: 'node-context-menu',
      overlaySlot: 'node-context-menu',
      surfaceId: 'node-context-menu',
      contributionPath: 'app/features/canvas-ui-entrypoints/node-context-menu/contribution.ts',
      items: nodeContextMenuContribution.nodeMenuItems,
    });
  });

  it('keeps canvas nodes on the low-frequency inventory while hiding mindmap-only actions', () => {
    const context = makeNodeContext({
      node: stickerBridgeNodeFixture,
      currentFile: 'examples/bridge.tsx',
      selectedNodeIds: ['sticker-1'],
    });
    const items = sanitizeContextMenuItems(nodeContextMenuContribution.nodeMenuItems, context);

    expect(items.map((item) => item.type === 'action' ? item.id : item.type)).toEqual([
      'copy-as-png',
      'export-selection',
      'rename-node',
      'duplicate-node',
      'delete-node',
      'lock-node',
    ]);
    expect(resolveDisabledState(context, 'duplicate-node')).toBe(false);
  });

  it('exposes canonical mindmap actions while keeping structural actions enabled through the bridge', () => {
    const context = makeNodeContext({
      node: mindmapBridgeNodeFixture,
      currentFile: 'examples/mindmap.tsx',
      selectedNodeIds: ['mindmap.child-1'],
    });
    const items = sanitizeContextMenuItems(nodeContextMenuContribution.nodeMenuItems, context);

    expect(items.map((item) => item.type === 'action' ? item.id : item.type)).toEqual([
      'copy-as-png',
      'export-selection',
      'rename-node',
      'mindmap-add-child',
      'mindmap-add-sibling',
      'select-group',
      'duplicate-node',
      'delete-node',
      'lock-node',
    ]);
    expect(resolveDisabledState(context, 'mindmap-add-child')).toBe(false);
    expect(resolveDisabledState(context, 'select-group')).toBe(false);
  });
});
