import { afterEach, describe, expect, it } from 'bun:test';
import { createPaneActionRoutingContext, resolveNodeActionRoutingContext } from '@/components/editor/workspaceEditUtils';
import { subscribeActionOptimisticLifecycle } from './actionOptimisticLifecycle';
import {
  mindmapBridgeNodeFixture,
  stickerBridgeNodeFixture,
} from './__fixtures__/actionRoutingBridgeFixtures';
import {
  dispatchActionRoutingIntent,
  dispatchActionRoutingIntentOrThrow,
} from './actionRoutingBridge';
import { createActionRoutingBridgeDependencies } from './actionRoutingBridgeTestUtils';

const cleanups: Array<() => void> = [];

afterEach(() => {
  while (cleanups.length > 0) {
    cleanups.pop()?.();
  }
});

describe('actionRoutingBridge', () => {
  it('pane create intent uses bridge catalog and emits optimistic apply/commit lifecycle', async () => {
    const runtime = {
      currentCanvasId: 'canvas-bridge',
      canvasVersions: {
        'canvas-bridge': 'sha256:base',
      },
      nodes: [stickerBridgeNodeFixture],
      selectedNodeIds: [],
    };
    const deps = createActionRoutingBridgeDependencies(runtime);
    const events: string[] = [];
    cleanups.push(subscribeActionOptimisticLifecycle((event) => {
      events.push(`${event.phase}:${event.intent}`);
    }));

    const response = await dispatchActionRoutingIntent({
      surface: 'pane-context-menu',
      intent: 'create-node',
      resolvedContext: createPaneActionRoutingContext({
        currentCanvasId: runtime.currentCanvasId,
        selectedNodeIds: runtime.selectedNodeIds,
      }),
      uiPayload: {
        nodeType: 'shape',
        placement: { mode: 'canvas-absolute', x: 48, y: 64 },
      },
      trigger: { source: 'menu' },
    }, deps);

    expect(response.error).toBeUndefined();
    expect(response.dispatchedActions).toEqual([
      { action: 'node.create', status: 'applied' },
    ]);
    expect(events).toEqual([
      'apply:create-node',
      'commit:create-node',
    ]);
    expect(deps.createNode).toHaveBeenCalledTimes(1);
    expect(deps.setPendingSelectionNodeIdMock).toHaveBeenCalledWith('shape-shape');
  });

  it('style update rejects disallowed patch keys with explicit bridge error', async () => {
    const runtime = {
      currentCanvasId: 'canvas-bridge',
      canvasVersions: {
        'canvas-bridge': 'sha256:base',
      },
      nodes: [stickerBridgeNodeFixture],
      selectedNodeIds: ['sticker-1'],
    };
    const deps = createActionRoutingBridgeDependencies(runtime);

    const response = await dispatchActionRoutingIntent({
      surface: 'selection-floating-menu',
      intent: 'style-update',
      resolvedContext: resolveNodeActionRoutingContext(
        stickerBridgeNodeFixture,
        runtime.currentCanvasId,
        runtime.selectedNodeIds,
      ),
      uiPayload: {
        patch: {
          anchor: 'other',
        },
      },
      trigger: { source: 'inspector' },
    }, deps);

    expect(response.error?.code).toBe('PATCH_SURFACE_VIOLATION');
    expect(response.error?.rpcCode).toBe(42211);
    expect(deps.updateNode).not.toHaveBeenCalled();
  });

  it('node context child create keeps source scope and bridge contract stable', async () => {
    const runtime = {
      currentCanvasId: 'canvas-mindmap',
      canvasVersions: {
        'canvas-mindmap': 'sha256:base-mindmap',
      },
      nodes: [mindmapBridgeNodeFixture],
      selectedNodeIds: ['mindmap.child-1'],
    };
    const deps = createActionRoutingBridgeDependencies(runtime);

    const response = await dispatchActionRoutingIntentOrThrow({
      surface: 'node-context-menu',
      intent: 'create-mindmap-child',
      resolvedContext: resolveNodeActionRoutingContext(
        mindmapBridgeNodeFixture,
        runtime.currentCanvasId,
        runtime.selectedNodeIds,
      ),
      uiPayload: {
        nodeType: 'shape',
        placement: { mode: 'mindmap-child', parentId: 'child-1' },
        scopeId: 'mindmap',
      },
      trigger: { source: 'menu' },
    }, deps);

    expect(response.dispatchedActions).toEqual([
      { action: 'mindmap.child.create', status: 'applied' },
    ]);
    expect(response.optimisticToken).toBeDefined();
    expect(response.rollbackToken).toBeDefined();
    expect(deps.createNode).toHaveBeenCalledTimes(1);
  });

  it('unregistered surface intent returns INVALID_INTENT contract response', async () => {
    const runtime = {
      currentCanvasId: 'canvas-bridge',
      canvasVersions: {
        'canvas-bridge': 'sha256:base',
      },
      nodes: [],
      selectedNodeIds: [],
    };
    const deps = createActionRoutingBridgeDependencies(runtime);

    const response = await dispatchActionRoutingIntent({
      surface: 'canvas-toolbar',
      intent: 'rename-node',
      resolvedContext: createPaneActionRoutingContext({
        currentCanvasId: runtime.currentCanvasId,
        selectedNodeIds: runtime.selectedNodeIds,
      }),
      uiPayload: {},
      trigger: { source: 'click' },
    }, deps);

    expect(response.error).toMatchObject({
      code: 'INVALID_INTENT',
      surface: 'canvas-toolbar',
      intent: 'rename-node',
    });
  });

  it('CanvasEditorPage no longer uses direct create/rename/style command builders for bridge-owned intents', async () => {
    const source = await Bun.file(new URL('../editor/pages/CanvasEditorPage.tsx', import.meta.url)).text();

    expect(source).toContain('dispatchActionRoutingIntentOrThrow');
    expect(source).not.toContain('buildCreateCommand(');
    expect(source).not.toContain('buildRenameCommand(');
    expect(source).not.toContain('buildStyleUpdateCommand(');
  });
});
