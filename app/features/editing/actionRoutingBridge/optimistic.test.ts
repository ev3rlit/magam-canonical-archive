import { describe, expect, it } from 'bun:test';
import {
  buildPendingKey,
  createApplyNodePatchStep,
  createOptimisticMeta,
  createRestoreNodeDataStep,
} from '@/features/editing/actionRoutingBridge/optimistic';

describe('action routing bridge optimistic helpers', () => {
  it('builds a stable pending key from surface + intent + node + version', () => {
    expect(buildPendingKey({
      intentId: 'selection.style.update',
      surfaceId: 'selection-floating-menu',
      nodeId: 'shape-1',
      baseVersion: 'sha256:v1',
    })).toBe('selection-floating-menu:selection.style.update:shape-1:sha256:v1');
  });

  it('creates rollback-aware optimistic metadata', () => {
    const rollbackStep = createRestoreNodeDataStep({
      nodeId: 'shape-1',
      previousData: { color: '#000000' },
    });
    const meta = createOptimisticMeta({
      intentId: 'selection.style.update',
      surfaceId: 'selection-floating-menu',
      baseVersion: 'sha256:v1',
      filePath: 'examples/bridge.tsx',
      nodeId: 'shape-1',
      rollbackSteps: [rollbackStep],
      startedAt: 100,
    });

    expect(meta.pendingKey).toContain('selection.style.update');
    expect(meta.rollbackSteps).toHaveLength(1);
    expect(meta.startedAt).toBe(100);
  });

  it('creates optimistic runtime patch steps', () => {
    const step = createApplyNodePatchStep({
      nodeId: 'shape-1',
      patch: { color: '#ff0000' },
    });

    expect(step).toMatchObject({
      kind: 'runtime-only-action',
      actionId: 'apply-node-data-patch',
      payload: {
        nodeId: 'shape-1',
        patch: { color: '#ff0000' },
      },
    });
  });
});
