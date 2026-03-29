import type { EditCompletionEvent } from '@/store/graph';
import type { MutationResultEnvelopeV1 } from '../../libs/shared/src/lib/canvas-runtime';

const OWN_COMMAND_TTL_MS = 60_000;

export const MAX_VERSION_CONFLICT_RETRY = 1;
export const VERSION_CONFLICT_METRIC_WINDOW_MS = 10 * 60 * 1000;
export const VERSION_CONFLICT_RATE_THRESHOLD = 0.02;

export type MutationMethod =
  | 'canvas.runtime.mutate'
  | 'canvas.runtime.undo'
  | 'canvas.runtime.redo'
  | 'canvas.node.create'
  | 'object.body.block.insert'
  | 'node.update'
  | 'node.move'
  | 'node.create'
  | 'node.delete'
  | 'node.reparent';

export type UpdateNodeCommandType =
  | 'node.move.relative'
  | 'node.content.update'
  | 'node.style.update'
  | 'node.rename'
  | 'node.group.update'
  | 'node.z-order.update';

export interface RpcMutationResult {
  success?: boolean;
  newVersion?: string;
  canvasRevision?: number;
  commandId?: string;
  canvasId?: string;
  runtimeResult?: MutationResultEnvelopeV1;
}

export interface UpdateNodeMutationOptions {
  commandType?: UpdateNodeCommandType;
}

export interface EditEventMutators {
  moveNode: (
    nodeId: string,
    x: number,
    y: number,
    targetCanvasId?: string | null,
  ) => Promise<unknown>;
  updateNode: (
    nodeId: string,
    props: Record<string, unknown>,
    options?: UpdateNodeMutationOptions,
    targetCanvasId?: string | null,
  ) => Promise<unknown>;
  createNode: (
    node: Record<string, unknown>,
    targetCanvasId?: string | null,
  ) => Promise<unknown>;
  createCanvasNode: (
    node: Record<string, unknown>,
    targetCanvasId?: string | null,
  ) => Promise<unknown>;
  insertObjectBodyBlock: (
    input: {
      objectId: string;
      block: Record<string, unknown>;
      afterBlockId?: string;
    },
    targetCanvasId?: string | null,
  ) => Promise<unknown>;
  deleteNode: (
    nodeId: string,
    targetCanvasId?: string | null,
  ) => Promise<unknown>;
  reparentNode: (
    nodeId: string,
    newParentId?: string | null,
    targetCanvasId?: string | null,
  ) => Promise<unknown>;
}

type VersionConflictData = {
  expected?: unknown;
  actual?: unknown;
};

type VersionConflictErrorLike = {
  code?: unknown;
  message?: unknown;
  data?: unknown;
};

export interface VersionConflictMetricsSnapshot {
  windowMs: number;
  threshold: number;
  mutationTotal10m: number;
  versionConflictTotal10m: number;
  versionConflictRate10m: number;
  shouldEnableServerMutex: boolean;
  updatedAt: number;
}

export interface VersionConflictMetricsTracker {
  recordMutation: () => VersionConflictMetricsSnapshot;
  recordVersionConflict: () => VersionConflictMetricsSnapshot;
  getSnapshot: () => VersionConflictMetricsSnapshot;
  reset: () => void;
}

type RetryEvent = {
  method: MutationMethod;
  canvasId: string;
  attempt: number;
  maxRetry: number;
  expected?: string | number;
  actual?: string | number;
  metrics: VersionConflictMetricsSnapshot;
  error: unknown;
};

type CreateMutationExecutorInput = {
  sendRequest: (method: MutationMethod, params: Record<string, unknown>) => Promise<unknown>;
  buildCommonParams: (method: MutationMethod, params: Record<string, unknown>) => Record<string, unknown>;
  applyResultVersion: (result: unknown) => RpcMutationResult;
  onVersionConflictActual?: (actualVersion: string | number) => void;
  onConflictRetry?: (event: RetryEvent) => void;
  metricsTracker?: VersionConflictMetricsTracker;
};

type EnqueueMutationInput = {
  method: MutationMethod;
  canvasId: string;
  buildParams: () => Record<string, unknown>;
};

export class RpcClientError extends Error {
  code: number;
  data?: unknown;

  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.name = 'RpcClientError';
    this.code = code;
    this.data = data;
  }
}

export function resolveFileSyncWsUrl(input?: {
  port?: string;
  location?: {
    protocol?: string;
    hostname?: string;
  };
}): string {
  const port = input?.port ?? process.env.NEXT_PUBLIC_MAGAM_WS_PORT ?? '3001';
  const protocol = input?.location?.protocol === 'https:' ? 'wss' : 'ws';
  const hostname = input?.location?.hostname || 'localhost';
  return `${protocol}://${hostname}:${port}`;
}

export function pruneExpiredOwnCommands(commands: Map<string, number>, now: number): void {
  commands.forEach((issuedAt, commandId) => {
    if ((now - issuedAt) > OWN_COMMAND_TTL_MS) {
      commands.delete(commandId);
    }
  });
}

export function rememberOwnCommand(commands: Map<string, number>, commandId: string, now: number): void {
  pruneExpiredOwnCommands(commands, now);
  commands.set(commandId, now);
}

function pruneExpiredTimestamps(timestamps: number[], now: number, windowMs: number): void {
  while (timestamps.length > 0 && (now - timestamps[0]) > windowMs) {
    timestamps.shift();
  }
}

function toOptionalVersionValue(value: unknown): string | number | undefined {
  return typeof value === 'string' || typeof value === 'number' ? value : undefined;
}

function extractVersionConflictVersions(error: unknown): { expected?: string | number; actual?: string | number } {
  const data = (error as VersionConflictErrorLike)?.data as VersionConflictData | undefined;
  return {
    expected: toOptionalVersionValue(data?.expected),
    actual: toOptionalVersionValue(data?.actual),
  };
}

export function isVersionConflictError(error: unknown): error is VersionConflictErrorLike {
  const candidate = error as VersionConflictErrorLike | undefined;
  if (!candidate) return false;
  return candidate.code === 40901 || candidate.message === 'VERSION_CONFLICT';
}

export function createVersionConflictMetricsTracker(input?: {
  windowMs?: number;
  threshold?: number;
  now?: () => number;
}): VersionConflictMetricsTracker {
  const mutationTimestamps: number[] = [];
  const versionConflictTimestamps: number[] = [];
  const windowMs = input?.windowMs ?? VERSION_CONFLICT_METRIC_WINDOW_MS;
  const threshold = input?.threshold ?? VERSION_CONFLICT_RATE_THRESHOLD;
  const now = input?.now ?? Date.now;

  const buildSnapshot = (): VersionConflictMetricsSnapshot => {
    const timestamp = now();
    pruneExpiredTimestamps(mutationTimestamps, timestamp, windowMs);
    pruneExpiredTimestamps(versionConflictTimestamps, timestamp, windowMs);

    const mutationTotal10m = mutationTimestamps.length;
    const versionConflictTotal10m = versionConflictTimestamps.length;
    const versionConflictRate10m = mutationTotal10m === 0 ? 0 : versionConflictTotal10m / mutationTotal10m;

    return {
      windowMs,
      threshold,
      mutationTotal10m,
      versionConflictTotal10m,
      versionConflictRate10m,
      shouldEnableServerMutex: versionConflictRate10m >= threshold,
      updatedAt: timestamp,
    };
  };

  return {
    recordMutation: () => {
      mutationTimestamps.push(now());
      return buildSnapshot();
    },
    recordVersionConflict: () => {
      versionConflictTimestamps.push(now());
      return buildSnapshot();
    },
    getSnapshot: () => buildSnapshot(),
    reset: () => {
      mutationTimestamps.length = 0;
      versionConflictTimestamps.length = 0;
    },
  };
}

export function createPerCanvasMutationExecutor(input: CreateMutationExecutorInput): {
  enqueueMutation: (mutation: EnqueueMutationInput) => Promise<RpcMutationResult>;
  getMetricsSnapshot: () => VersionConflictMetricsSnapshot;
  resetMetrics: () => void;
} {
  const queueTails = new Map<string, Promise<void>>();
  const metrics = input.metricsTracker ?? createVersionConflictMetricsTracker();

  const executeWithRetry = async (mutation: EnqueueMutationInput): Promise<RpcMutationResult> => {
    metrics.recordMutation();

    let retryAttempt = 0;
    while (true) {
      try {
        const params = input.buildCommonParams(mutation.method, mutation.buildParams());
        const result = await input.sendRequest(mutation.method, params);
        return input.applyResultVersion(result);
      } catch (error) {
        if (!isVersionConflictError(error)) {
          throw error;
        }

        const { expected, actual } = extractVersionConflictVersions(error);
        const metricsSnapshot = metrics.recordVersionConflict();

        if (retryAttempt >= MAX_VERSION_CONFLICT_RETRY) {
          throw error;
        }

        retryAttempt += 1;
        if (actual) {
          input.onVersionConflictActual?.(actual);
        }
        input.onConflictRetry?.({
          method: mutation.method,
          canvasId: mutation.canvasId,
          attempt: retryAttempt,
          maxRetry: MAX_VERSION_CONFLICT_RETRY,
          expected,
          actual,
          metrics: metricsSnapshot,
          error,
        });
      }
    }
  };

  const enqueueMutation = async (mutation: EnqueueMutationInput): Promise<RpcMutationResult> => {
    const previousTail = queueTails.get(mutation.canvasId) || Promise.resolve();
    const run = previousTail.catch(() => undefined).then(() => executeWithRetry(mutation));
    const nextTail = run.then(() => undefined, () => undefined);
    queueTails.set(mutation.canvasId, nextTail);
    nextTail.finally(() => {
      if (queueTails.get(mutation.canvasId) === nextTail) {
        queueTails.delete(mutation.canvasId);
      }
    });
    return run;
  };

  return {
    enqueueMutation,
    getMetricsSnapshot: () => metrics.getSnapshot(),
    resetMetrics: () => metrics.reset(),
  };
}

export const createPerFileMutationExecutor = createPerCanvasMutationExecutor;

export function shouldReloadAfterHistoryReplay(event: EditCompletionEvent): boolean {
  return (
    event.type === 'NODE_RENAMED'
    || event.type === 'NODE_CREATED'
    || event.type === 'NODE_DELETED'
    || event.type === 'NODE_LOCK_TOGGLED'
    || event.type === 'NODE_REPARENTED'
  );
}

export async function applyEditCompletionSnapshot(
  event: EditCompletionEvent,
  direction: 'before' | 'after',
  mutators: EditEventMutators,
): Promise<void> {
  const snapshot = direction === 'before' ? event.before : event.after;

  if (event.type === 'ABSOLUTE_MOVE_COMMITTED') {
    const x = snapshot.x;
    const y = snapshot.y;
    if (typeof x !== 'number' || typeof y !== 'number') {
      throw new Error('INVALID_EVENT_SNAPSHOT');
    }
    await mutators.moveNode(event.nodeId, x, y, event.canvasId);
    return;
  }

  if (event.type === 'TEXT_EDIT_COMMITTED' || event.type === 'CONTENT_UPDATED') {
    const content = snapshot.content;
    if (typeof content !== 'string') {
      throw new Error('INVALID_EVENT_SNAPSHOT');
    }
    await mutators.updateNode(
      event.nodeId,
      { content },
      { commandType: 'node.content.update' },
      event.canvasId,
    );
    return;
  }

  if (event.type === 'STYLE_UPDATED') {
    await mutators.updateNode(
      event.nodeId,
      snapshot,
      { commandType: 'node.style.update' },
      event.canvasId,
    );
    return;
  }

  if (event.type === 'NODE_GROUP_MEMBERSHIP_UPDATED') {
    const groupId = 'groupId' in snapshot && typeof snapshot.groupId === 'string'
      ? snapshot.groupId
      : null;
    await mutators.updateNode(
      event.nodeId,
      { groupId },
      { commandType: 'node.group.update' },
      event.canvasId,
    );
    return;
  }

  if (event.type === 'NODE_RENAMED') {
    const beforeId = event.before.id;
    const afterId = event.after.id;
    if (typeof beforeId !== 'string' || typeof afterId !== 'string') {
      throw new Error('INVALID_EVENT_SNAPSHOT');
    }
    const targetNodeId = direction === 'before' ? afterId : beforeId;
    const nextId = direction === 'before' ? beforeId : afterId;
    await mutators.updateNode(
      targetNodeId,
      { id: nextId },
      { commandType: 'node.rename' },
      event.canvasId,
    );
    return;
  }

  if (event.type === 'NODE_CREATED') {
    const createInput = event.after.create;
    if (!createInput || typeof createInput !== 'object') {
      throw new Error('INVALID_EVENT_SNAPSHOT');
    }
    const actionId = typeof event.after.actionId === 'string' ? event.after.actionId : 'node.create';
    if (direction === 'before') {
      const createdId = (createInput as { id?: unknown }).id;
      if (typeof createdId !== 'string') {
        throw new Error('INVALID_EVENT_SNAPSHOT');
      }
      await mutators.deleteNode(createdId, event.canvasId);
      return;
    }
    if (actionId === 'canvas.node.create') {
      await mutators.createCanvasNode(createInput as Record<string, unknown>, event.canvasId);
      return;
    }
    await mutators.createNode(createInput as Record<string, unknown>, event.canvasId);
    return;
  }

  if (event.type === 'NODE_DELETED') {
    const recreateInput = event.before.create;
    if (!recreateInput || typeof recreateInput !== 'object') {
      throw new Error('INVALID_EVENT_SNAPSHOT');
    }
    const actionId = typeof event.before.actionId === 'string' ? event.before.actionId : 'node.create';
    if (direction === 'before') {
      if (actionId === 'canvas.node.create') {
        await mutators.createCanvasNode(recreateInput as Record<string, unknown>, event.canvasId);
      } else {
        await mutators.createNode(recreateInput as Record<string, unknown>, event.canvasId);
      }
      return;
    }
    await mutators.deleteNode(event.nodeId, event.canvasId);
    return;
  }

  if (event.type === 'NODE_REPARENTED') {
    const parentId = 'parentId' in snapshot ? snapshot.parentId : undefined;
    if (parentId !== null && parentId !== undefined && typeof parentId !== 'string') {
      throw new Error('INVALID_EVENT_SNAPSHOT');
    }
    await mutators.reparentNode(event.nodeId, parentId ?? undefined, event.canvasId);
    return;
  }

  if (event.type === 'NODE_LOCK_TOGGLED') {
    const locked = snapshot.locked;
    if (typeof locked !== 'boolean') {
      throw new Error('INVALID_EVENT_SNAPSHOT');
    }
    await mutators.updateNode(event.nodeId, { locked }, undefined, event.canvasId);
    return;
  }

  if (event.type === 'NODE_Z_ORDER_UPDATED') {
    const zIndex = 'zIndex' in snapshot && typeof snapshot.zIndex === 'number'
      ? snapshot.zIndex
      : null;
    await mutators.updateNode(
      event.nodeId,
      { zIndex },
      { commandType: 'node.z-order.update' },
      event.canvasId,
    );
    return;
  }

  const patchProps: Record<string, unknown> = {};
  if ('gap' in snapshot && typeof snapshot.gap === 'number') {
    patchProps.gap = snapshot.gap;
  }
  if ('at' in snapshot && snapshot.at && typeof snapshot.at === 'object') {
    patchProps.at = snapshot.at;
  }
  if (Object.keys(patchProps).length === 0) {
    throw new Error('INVALID_EVENT_SNAPSHOT');
  }
  await mutators.updateNode(
    event.nodeId,
    patchProps,
    { commandType: 'node.move.relative' },
    event.canvasId,
  );
}

export function shouldReloadForCanvasChange(input: {
  changedCanvasId?: string | null;
  currentCanvasId?: string | null;
  incomingOriginId?: unknown;
  incomingCommandId?: unknown;
  clientId: string;
  recentOwnCommandIds?: Set<string>;
  lastAppliedCommandId?: string;
}): boolean {
  if (!input.changedCanvasId || input.changedCanvasId !== input.currentCanvasId) {
    return false;
  }

  const isSelfEvent =
    input.incomingOriginId === input.clientId &&
    typeof input.incomingCommandId === 'string';

  if (isSelfEvent && input.recentOwnCommandIds?.has(input.incomingCommandId as string)) {
    return false;
  }

  const isCurrentFileSelfEvent =
    input.changedCanvasId === input.currentCanvasId &&
    isSelfEvent &&
    input.incomingCommandId === input.lastAppliedCommandId;

  return !isCurrentFileSelfEvent;
}

export const shouldReloadForFileChange = shouldReloadForCanvasChange;
