import { mock } from 'bun:test';
import type {
  ActionRoutingBridgeDependencies,
  ActionRoutingRuntimeSnapshot,
} from './actionRoutingBridge.types';

export function createActionRoutingBridgeDependencies(
  runtime: ActionRoutingRuntimeSnapshot,
): ActionRoutingBridgeDependencies & {
  setPendingSelectionNodeIdMock: ReturnType<typeof mock>;
} {
  const setPendingSelectionNodeIdMock = mock(() => {});
  return {
    runtime,
    updateNode: mock(async () => ({
      success: true,
      newVersion: 'sha256:updated',
      commandId: 'cmd-update-1',
    })),
    createNode: mock(async () => ({
      success: true,
      newVersion: 'sha256:created',
      commandId: 'cmd-create-1',
    })),
    updateNodeData: mock(() => {}),
    restoreNodeData: mock(() => {}),
    pushEditCompletionEvent: mock(() => {}),
    onFileChange: mock(() => {}),
    setPendingSelectionNodeId: setPendingSelectionNodeIdMock,
    createId: () => 'event-1',
    now: () => 1_234_567,
    setPendingSelectionNodeIdMock,
  };
}
