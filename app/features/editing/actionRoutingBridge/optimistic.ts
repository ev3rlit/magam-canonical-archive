import type {
  ActionRoutingOptimisticMeta,
  ActionRoutingPendingRecord,
  ActionRoutingSurfaceId,
  DispatchDescriptor,
  RuntimeActionDescriptor,
} from '@/features/editing/actionRoutingBridge/types';

export function buildPendingKey(input: {
  intentId: string;
  surfaceId: ActionRoutingSurfaceId;
  nodeId?: string;
  baseVersion: string;
}): string {
  return [
    input.surfaceId,
    input.intentId,
    input.nodeId ?? 'global',
    input.baseVersion,
  ].join(':');
}

export function createRestoreNodeDataStep(input: {
  nodeId: string;
  previousData: Record<string, unknown>;
}): RuntimeActionDescriptor<'restore-node-data'> {
  return {
    kind: 'runtime-only-action',
    actionId: 'restore-node-data',
    payload: {
      nodeId: input.nodeId,
      previousData: input.previousData,
    },
  };
}

export function createApplyNodePatchStep(input: {
  nodeId: string;
  patch: Record<string, unknown>;
}): RuntimeActionDescriptor<'apply-node-data-patch'> {
  return {
    kind: 'runtime-only-action',
    actionId: 'apply-node-data-patch',
    payload: {
      nodeId: input.nodeId,
      patch: input.patch,
    },
  };
}

export function createOptimisticMeta(input: {
  intentId: string;
  surfaceId: ActionRoutingSurfaceId;
  baseVersion: string;
  filePath: string;
  nodeId?: string;
  rollbackSteps: DispatchDescriptor[];
  startedAt?: number;
}): ActionRoutingOptimisticMeta {
  return {
    pendingKey: buildPendingKey({
      intentId: input.intentId,
      surfaceId: input.surfaceId,
      nodeId: input.nodeId,
      baseVersion: input.baseVersion,
    }),
    baseVersion: input.baseVersion,
    intentId: input.intentId,
    surfaceId: input.surfaceId,
    filePath: input.filePath,
    nodeId: input.nodeId,
    rollbackSteps: input.rollbackSteps,
    startedAt: input.startedAt ?? Date.now(),
  };
}

export function toPendingRecord(meta: ActionRoutingOptimisticMeta): ActionRoutingPendingRecord {
  return { ...meta };
}
