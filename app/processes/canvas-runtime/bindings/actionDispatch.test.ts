import { describe, expect, it, mock } from 'bun:test';
import { createPaneActionRoutingContext } from '@/components/editor/workspaceEditUtils';
import { createCanvasActionDispatchBinding } from './actionDispatch';

describe('actionDispatch runtime contribution intents', () => {
  it('routes runtime-provided intent entries through the shared bridge binding', async () => {
    const appliedActions: string[] = [];
    const binding = createCanvasActionDispatchBinding({
      getRuntime: () => ({
        nodes: [],
        edges: [],
        currentCanvasId: 'canvas-bridge',
        currentCompatibilityFilePath: 'examples/bridge.tsx',
        canvasVersions: { 'canvas-bridge': 'sha256:v1' },
        selectedNodeIds: [],
      }),
      applyRuntimeAction: (descriptor) => {
        appliedActions.push(descriptor.actionId);
      },
      executeMutationDescriptor: async () => {
        throw new Error('should not execute mutation');
      },
      commitHistoryEffect: () => {},
      registerPendingActionRouting: () => {},
      clearPendingActionRouting: () => {},
      registryEntries: [{
        intentId: 'selection.debug.runtime-action',
        supportedSurfaces: ['selection-floating-menu'],
        isEnabled: () => ({ ok: true, value: true }),
        normalizePayload: () => ({ ok: true, value: {} }),
        buildDispatch: () => ({
          ok: true,
          value: {
            intentId: 'selection.debug.runtime-action',
            steps: [{
              kind: 'runtime-only-action',
              actionId: 'fit-view',
              payload: {},
            }],
            rollbackSteps: [],
          },
        }),
      }],
    });

    await binding.executeBridgeIntent({
      surfaceId: 'selection-floating-menu',
      intentId: 'selection.debug.runtime-action',
      selectionRef: {
        selectedNodeIds: [],
        currentCanvasId: 'canvas-bridge',
      },
      rawPayload: {},
      optimistic: false,
    });

    expect(appliedActions).toEqual(['fit-view']);
  });

  it('routes canvas-toolbar create intents with compatibility file context', async () => {
    const executeMutationDescriptor = mock(async () => ({}));
    const binding = createCanvasActionDispatchBinding({
      getRuntime: () => ({
        nodes: [],
        edges: [],
        currentCanvasId: 'canvas-bridge',
        currentCompatibilityFilePath: 'examples/bridge.tsx',
        canvasVersions: {
          'canvas-bridge': 'sha256:v1',
        },
        selectedNodeIds: [],
      }),
      applyRuntimeAction: () => {},
      executeMutationDescriptor,
      commitHistoryEffect: () => {},
      registerPendingActionRouting: () => {},
      clearPendingActionRouting: () => {},
    });

    await expect(binding.dispatchActionRoutingIntentOrThrow({
      surface: 'canvas-toolbar',
      intent: 'create-node',
      resolvedContext: createPaneActionRoutingContext({
        currentCanvasId: 'canvas-bridge',
        currentFile: 'examples/bridge.tsx',
        selectedNodeIds: [],
      }),
      uiPayload: {
        nodeType: 'shape',
        placement: { mode: 'canvas-absolute', x: 320, y: 240 },
      },
      trigger: { source: 'click' },
    })).resolves.toBeUndefined();

    expect(executeMutationDescriptor).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'runtime-mutation',
      payload: expect.objectContaining({
        filePath: 'examples/bridge.tsx',
      }),
    }));
  });
});
