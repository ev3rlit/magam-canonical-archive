import { describe, expect, it } from 'bun:test';
import { createCanvasActionDispatchBinding } from './actionDispatch';

describe('actionDispatch runtime contribution intents', () => {
  it('routes runtime-provided intent entries through the shared bridge binding', async () => {
    const appliedActions: string[] = [];
    const binding = createCanvasActionDispatchBinding({
      getRuntime: () => ({
        nodes: [],
        edges: [],
        currentFile: 'examples/bridge.tsx',
        sourceVersions: { 'examples/bridge.tsx': 'sha256:v1' },
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
        currentFile: 'examples/bridge.tsx',
      },
      rawPayload: {},
      optimistic: false,
    });

    expect(appliedActions).toEqual(['fit-view']);
  });
});
