import { describe, expect, it } from 'bun:test';
import { resolveNodeActionRoutingContext } from '@/components/editor/workspaceEditUtils';
import {
  mindmapBridgeNodeFixture,
  stickerBridgeNodeFixture,
} from '@/features/editing/__fixtures__/actionRoutingBridgeFixtures';
import { makeCanonicalNode } from '@/features/editing/actionRoutingBridge/testUtils';
import { buildNodeContextMenuModel } from './buildNodeContextMenuModel';
import type { NodeContextSnapshot } from './types';

function makeSnapshot(input: {
  node: Parameters<typeof resolveNodeActionRoutingContext>[0];
  currentFile: string | null;
  selectedNodeIds: string[];
  nodeFamily?: string;
}): NodeContextSnapshot {
  return {
    type: 'node',
    nodeId: input.node.id,
    nodeFamily: input.nodeFamily,
    selectedNodeIds: input.selectedNodeIds,
    nodeContext: resolveNodeActionRoutingContext(
      input.node,
      input.currentFile,
      input.selectedNodeIds,
    ),
  };
}

describe('buildNodeContextMenuModel', () => {
  it('hides structural mindmap actions for canonical canvas nodes', () => {
    const model = buildNodeContextMenuModel(makeSnapshot({
      node: stickerBridgeNodeFixture,
      currentFile: 'examples/bridge.tsx',
      selectedNodeIds: ['sticker-1'],
    }));

    expect(model['rename-node'].visibility).toBe('enabled');
    expect(model['mindmap-add-child'].visibility).toBe('hidden');
    expect(model['mindmap-add-sibling'].visibility).toBe('hidden');
    expect(model['select-group'].visibility).toBe('hidden');
    expect(model['duplicate-node'].visibility).toBe('enabled');
    expect(model['delete-node'].visibility).toBe('enabled');
    expect(model['lock-node'].visibility).toBe('enabled');
  });

  it('keeps structural actions in the node context menu for mutable single-node selections', () => {
    const model = buildNodeContextMenuModel(makeSnapshot({
      node: stickerBridgeNodeFixture,
      currentFile: 'examples/bridge.tsx',
      selectedNodeIds: ['sticker-1'],
    }));

    expect(model['duplicate-node'].visibility).toBe('enabled');
    expect(model['delete-node'].visibility).toBe('enabled');
    expect(model['lock-node'].visibility).toBe('enabled');
  });

  it('enables child and sibling create when canonical relation context marks a mindmap member', () => {
    const model = buildNodeContextMenuModel(makeSnapshot({
      node: mindmapBridgeNodeFixture,
      currentFile: 'examples/mindmap.tsx',
      selectedNodeIds: ['mindmap.child-1'],
    }));

    expect(model['mindmap-add-child'].visibility).toBe('enabled');
    expect(model['mindmap-add-sibling'].visibility).toBe('enabled');
    expect(model['select-group'].visibility).toBe('enabled');
    expect(model['duplicate-node'].visibility).toBe('enabled');
    expect(model['delete-node'].visibility).toBe('enabled');
    expect(model['lock-node'].visibility).toBe('enabled');
  });

  it('disables mutable single-node actions when the selection is not singular', () => {
    const model = buildNodeContextMenuModel(makeSnapshot({
      node: mindmapBridgeNodeFixture,
      currentFile: 'examples/mindmap.tsx',
      selectedNodeIds: ['mindmap.child-1', 'mindmap.child-2'],
    }));

    expect(model['rename-node']).toMatchObject({
      visibility: 'disabled',
      disabledReason: {
        code: 'SELECTION_NOT_SINGULAR',
      },
    });
    expect(model['mindmap-add-child']).toMatchObject({
      visibility: 'disabled',
      disabledReason: {
        code: 'SELECTION_NOT_SINGULAR',
      },
    });
    expect(model['duplicate-node']).toMatchObject({
      visibility: 'disabled',
      disabledReason: {
        code: 'SELECTION_NOT_SINGULAR',
      },
    });
    expect(model['delete-node']).toMatchObject({
      visibility: 'disabled',
      disabledReason: {
        code: 'SELECTION_NOT_SINGULAR',
      },
    });
    expect(model['lock-node']).toMatchObject({
      visibility: 'disabled',
      disabledReason: {
        code: 'SELECTION_NOT_SINGULAR',
      },
    });
  });

  it('shows grouping and z-order actions for structural multi-selection on canvas nodes', () => {
    const groupedCanvasNode = makeCanonicalNode({
      id: 'shape-a',
      type: 'shape',
      groupId: 'canvas-group',
      sourceKind: 'canvas',
    });

    const model = buildNodeContextMenuModel(makeSnapshot({
      node: groupedCanvasNode,
      currentFile: 'examples/bridge.tsx',
      selectedNodeIds: ['shape-a', 'shape-b'],
    }));

    expect(model['enter-group'].visibility).toBe('enabled');
    expect(model['group-selection'].visibility).toBe('enabled');
    expect(model['ungroup-selection'].visibility).toBe('enabled');
    expect(model['bring-to-front'].visibility).toBe('enabled');
    expect(model['send-to-back'].visibility).toBe('enabled');
  });
});
