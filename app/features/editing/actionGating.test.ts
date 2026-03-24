import { describe, expect, it } from 'bun:test';
import { createPaneActionRoutingContext, resolveNodeActionRoutingContext } from '@/components/editor/workspaceEditUtils';
import { stickerBridgeNodeFixture } from './__fixtures__/actionRoutingBridgeFixtures';
import { gateActionPayload } from './actionGating';
import type { ActionRoutingBridgeRequest } from './actionRoutingBridge.types';

describe('actionGating', () => {
  it('blocks mutation when resolved context is read only', () => {
    const request: ActionRoutingBridgeRequest = {
      surface: 'selection-floating-menu',
      intent: 'style-update',
      resolvedContext: {
        ...resolveNodeActionRoutingContext(stickerBridgeNodeFixture, 'examples/bridge.tsx', ['sticker-1']),
        editability: {
          canMutate: false,
          allowedCommands: [],
          styleEditableKeys: [],
          reason: 'READ_ONLY',
        },
      },
      uiPayload: { patch: { outlineColor: '#000' } },
      trigger: { source: 'inspector' },
    };

    const result = gateActionPayload(request, {
      kind: 'style-update',
      commandType: 'node.style.update',
      editTarget: {
        sourceId: 'sticker-1',
        filePath: 'examples/bridge.tsx',
        renderedId: 'sticker-1',
      },
      baseVersion: 'sha256:base',
      renderedNodeId: 'sticker-1',
      patch: { outlineColor: '#000' },
      previousPatch: { outlineColor: '#fff' },
      previousNodeData: { outlineColor: '#fff' },
      targetNode: stickerBridgeNodeFixture,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        errorCode: 'GATE_BLOCKED',
        details: {
          reason: 'READ_ONLY',
          commandType: 'node.style.update',
        },
      },
    });
  });

  it('allows pane create when pane context exposes node.create permission', () => {
    const request: ActionRoutingBridgeRequest = {
      surface: 'pane-context-menu',
      intent: 'create-node',
      resolvedContext: createPaneActionRoutingContext({
        currentFile: 'examples/bridge.tsx',
        selectedNodeIds: [],
      }),
      uiPayload: {
        nodeType: 'shape',
        placement: { mode: 'canvas-absolute', x: 20, y: 30 },
      },
      trigger: { source: 'menu' },
    };

    const result = gateActionPayload(request, {
      kind: 'create-node',
      commandType: 'node.create',
      editTarget: {
        sourceId: 'shape-new-shape',
        filePath: 'examples/bridge.tsx',
      },
      baseVersion: 'sha256:base',
      nodeType: 'shape',
      initialProps: {},
      initialContent: 'New shape',
      placement: { mode: 'canvas-absolute', x: 20, y: 30 },
      createInput: {
        id: 'shape-new-shape',
        type: 'shape',
        props: {
          x: 20,
          y: 30,
          content: 'New shape',
        },
        placement: { mode: 'canvas-absolute', x: 20, y: 30 },
      },
      renderedId: 'shape-new-shape',
    });

    expect(result).toEqual({
      ok: true,
      value: {},
    });
  });
});
