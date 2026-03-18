import { describe, expect, it, mock } from 'bun:test';
import {
  applyEditCompletionSnapshot,
  createPerFileMutationExecutor,
  createVersionConflictMetricsTracker,
  MAX_VERSION_CONFLICT_RETRY,
  RpcClientError,
  buildWatchedFilesSignature,
  normalizeWatchedFiles,
  resolveFileSyncWsUrl,
  shouldReloadAfterHistoryReplay,
  shouldReloadForFileChange,
  VERSION_CONFLICT_METRIC_WINDOW_MS,
  VERSION_CONFLICT_RATE_THRESHOLD,
} from './useFileSync.shared';

async function waitForAsyncTurn(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('useFileSync ws url resolution', () => {
  it('브라우저 location을 기준으로 ws url을 만든다', () => {
    expect(resolveFileSyncWsUrl({
      port: '3012',
      location: {
        protocol: 'http:',
        hostname: '127.0.0.1',
      },
    })).toBe('ws://127.0.0.1:3012');
  });

  it('https 환경이면 wss를 사용한다', () => {
    expect(resolveFileSyncWsUrl({
      port: '4444',
      location: {
        protocol: 'https:',
        hostname: 'dev.local',
      },
    })).toBe('wss://dev.local:4444');
  });
});

describe('useFileSync watched files normalization', () => {
  it('현재 파일과 의존 파일을 unique + stable sort로 정규화한다', () => {
    expect(normalizeWatchedFiles('examples/a.tsx', [
      'examples/b.tsx',
      'examples/a.tsx',
      'examples/b.tsx',
    ])).toEqual([
      'examples/a.tsx',
      'examples/b.tsx',
    ]);
  });

  it('watch signature는 같은 파일 집합이면 동일 문자열을 만든다', () => {
    expect(buildWatchedFilesSignature([
      'examples/a.tsx',
      'examples/b.tsx',
    ])).toBe(buildWatchedFilesSignature([
      'examples/a.tsx',
      'examples/b.tsx',
    ]));
  });
});

describe('useFileSync notification guard', () => {
  it('self-origin + same command 는 무시한다', () => {
    const shouldReload = shouldReloadForFileChange({
      changedFile: 'examples/a.tsx',
      currentFile: 'examples/a.tsx',
      watchedFiles: new Set(['examples/a.tsx']),
      incomingOriginId: 'client-1',
      incomingCommandId: 'cmd-1',
      clientId: 'client-1',
      recentOwnCommandIds: new Set(['cmd-1']),
      lastAppliedCommandId: 'cmd-1',
    });

    expect(shouldReload).toBe(false);
  });

  it('다른 origin 이면 리렌더한다', () => {
    const shouldReload = shouldReloadForFileChange({
      changedFile: 'examples/a.tsx',
      currentFile: 'examples/a.tsx',
      watchedFiles: new Set(['examples/a.tsx']),
      incomingOriginId: 'external',
      incomingCommandId: 'cmd-x',
      clientId: 'client-1',
      recentOwnCommandIds: new Set(['cmd-1']),
      lastAppliedCommandId: 'cmd-1',
    });

    expect(shouldReload).toBe(true);
  });

  it('watch 대상이 아닌 파일 변경은 무시한다', () => {
    const shouldReload = shouldReloadForFileChange({
      changedFile: 'examples/b.tsx',
      currentFile: 'examples/a.tsx',
      watchedFiles: new Set(['examples/a.tsx']),
      incomingOriginId: 'external',
      incomingCommandId: 'cmd-x',
      clientId: 'client-1',
      recentOwnCommandIds: new Set(['cmd-1']),
      lastAppliedCommandId: 'cmd-1',
    });

    expect(shouldReload).toBe(false);
  });

  it('외부 의존 파일 변경은 현재 파일이 아니어도 리렌더한다', () => {
    const shouldReload = shouldReloadForFileChange({
      changedFile: 'components/auth.tsx',
      currentFile: 'examples/a.tsx',
      watchedFiles: new Set(['examples/a.tsx', 'components/auth.tsx']),
      incomingOriginId: 'client-1',
      incomingCommandId: 'cmd-1',
      clientId: 'client-1',
      recentOwnCommandIds: new Set(),
      lastAppliedCommandId: 'cmd-1',
    });

    expect(shouldReload).toBe(true);
  });

  it('self-origin dependency file change도 own command면 리렌더하지 않는다', () => {
    const shouldReload = shouldReloadForFileChange({
      changedFile: 'components/auth.tsx',
      currentFile: 'examples/a.tsx',
      watchedFiles: new Set(['examples/a.tsx', 'components/auth.tsx']),
      incomingOriginId: 'client-1',
      incomingCommandId: 'cmd-2',
      clientId: 'client-1',
      recentOwnCommandIds: new Set(['cmd-2']),
      lastAppliedCommandId: 'cmd-1',
    });

    expect(shouldReload).toBe(false);
  });
});

describe('useFileSync mutation queue', () => {
  it('같은 파일 mutation은 순차 실행된다', async () => {
    const timeline: string[] = [];
    let releaseFirst: (value?: void | PromiseLike<void>) => void = () => { };
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    let commandSequence = 0;
    const sendRequest = mock(async (_method: string, params: Record<string, unknown>) => {
      const marker = params.marker as string;
      timeline.push(`start:${marker}`);
      if (marker === 'first') {
        await firstGate;
      }
      timeline.push(`end:${marker}`);
      return { success: true, newVersion: `v-${marker}` };
    });

    const executor = createPerFileMutationExecutor({
      sendRequest,
      buildCommonParams: (params) => ({
        ...params,
        baseVersion: 'sha256:test',
        originId: 'client-1',
        commandId: `cmd-${++commandSequence}`,
      }),
      applyResultVersion: (result) => result as { success: boolean; newVersion: string },
    });

    const first = executor.enqueueMutation({
      method: 'node.move',
      filePath: 'same-file.tsx',
      buildParams: () => ({ marker: 'first' }),
    });
    const second = executor.enqueueMutation({
      method: 'node.move',
      filePath: 'same-file.tsx',
      buildParams: () => ({ marker: 'second' }),
    });

    await waitForAsyncTurn();
    expect(timeline).toEqual(['start:first']);

    releaseFirst();

    await Promise.all([first, second]);
    expect(timeline).toEqual([
      'start:first',
      'end:first',
      'start:second',
      'end:second',
    ]);
  });

  it('앞선 mutation 실패가 다음 mutation을 막지 않는다', async () => {
    const timeline: string[] = [];
    const sendRequest = mock(async (_method: string, params: Record<string, unknown>) => {
      const marker = params.marker as string;
      timeline.push(`start:${marker}`);
      if (marker === 'first') {
        throw new Error('boom-first');
      }
      timeline.push(`end:${marker}`);
      return { success: true, newVersion: 'sha256:ok' };
    });

    const executor = createPerFileMutationExecutor({
      sendRequest,
      buildCommonParams: (params) => ({
        ...params,
        baseVersion: 'sha256:test',
        originId: 'client-1',
        commandId: crypto.randomUUID(),
      }),
      applyResultVersion: (result) => result as { success: boolean; newVersion: string },
    });

    const first = executor.enqueueMutation({
      method: 'node.update',
      filePath: 'same-file.tsx',
      buildParams: () => ({ marker: 'first' }),
    });
    const second = executor.enqueueMutation({
      method: 'node.update',
      filePath: 'same-file.tsx',
      buildParams: () => ({ marker: 'second' }),
    });

    await expect(first).rejects.toThrow('boom-first');
    await expect(second).resolves.toMatchObject({ success: true });
    expect(timeline).toEqual(['start:first', 'start:second', 'end:second']);
  });
});

describe('useFileSync version conflict retry', () => {
  it('40901 충돌 시 1회 자동 재시도 후 성공한다', async () => {
    let sendCallCount = 0;
    let commonCallCount = 0;
    const commandIds: string[] = [];
    const retriedActualVersions: string[] = [];
    const retryEvents: Array<{ attempt: number; maxRetry: number }> = [];

    const sendRequest = mock(async (_method: string, params: Record<string, unknown>) => {
      sendCallCount += 1;
      commandIds.push(params.commandId as string);

      if (sendCallCount === 1) {
        throw new RpcClientError(40901, 'VERSION_CONFLICT', {
          expected: 'sha256:old',
          actual: 'sha256:new',
        });
      }

      return { success: true, newVersion: 'sha256:new', commandId: params.commandId };
    });

    const executor = createPerFileMutationExecutor({
      sendRequest,
      buildCommonParams: (params) => ({
        ...params,
        baseVersion: `sha256:base-${commonCallCount}`,
        originId: 'client-1',
        commandId: `cmd-${++commonCallCount}`,
      }),
      applyResultVersion: (result) => result as { success: boolean; newVersion: string; commandId: string },
      onVersionConflictActual: (actualVersion) => {
        retriedActualVersions.push(actualVersion);
      },
      onConflictRetry: (event) => {
        retryEvents.push({ attempt: event.attempt, maxRetry: event.maxRetry });
      },
    });

    const result = await executor.enqueueMutation({
      method: 'node.reparent',
      filePath: 'retry-file.tsx',
      buildParams: () => ({ nodeId: 'n1' }),
    });

    expect(result.success).toBe(true);
    expect(sendCallCount).toBe(2);
    expect(retriedActualVersions).toEqual(['sha256:new']);
    expect(retryEvents).toEqual([{ attempt: 1, maxRetry: MAX_VERSION_CONFLICT_RETRY }]);
    expect(commandIds[0]).not.toBe(commandIds[1]);
  });

  it('40901이 2회 연속이면 실패를 전파한다', async () => {
    let sendCallCount = 0;
    const sendRequest = mock(async () => {
      sendCallCount += 1;
      throw new RpcClientError(40901, 'VERSION_CONFLICT', {
        expected: 'sha256:old',
        actual: 'sha256:new',
      });
    });

    const executor = createPerFileMutationExecutor({
      sendRequest,
      buildCommonParams: (params) => ({
        ...params,
        baseVersion: 'sha256:test',
        originId: 'client-1',
        commandId: crypto.randomUUID(),
      }),
      applyResultVersion: (result) => result as { success: boolean; newVersion: string },
    });

    await expect(executor.enqueueMutation({
      method: 'node.move',
      filePath: 'retry-file.tsx',
      buildParams: () => ({ nodeId: 'n1' }),
    })).rejects.toMatchObject({ code: 40901, message: 'VERSION_CONFLICT' });
    expect(sendCallCount).toBe(MAX_VERSION_CONFLICT_RETRY + 1);
  });

  it('비충돌 에러는 재시도하지 않는다', async () => {
    let sendCallCount = 0;
    const sendRequest = mock(async () => {
      sendCallCount += 1;
      throw new RpcClientError(50001, 'PATCH_FAILED', { reason: 'mock' });
    });

    const executor = createPerFileMutationExecutor({
      sendRequest,
      buildCommonParams: (params) => ({
        ...params,
        baseVersion: 'sha256:test',
        originId: 'client-1',
        commandId: crypto.randomUUID(),
      }),
      applyResultVersion: (result) => result as { success: boolean; newVersion: string },
    });

    await expect(executor.enqueueMutation({
      method: 'node.create',
      filePath: 'retry-file.tsx',
      buildParams: () => ({ nodeId: 'n1' }),
    })).rejects.toMatchObject({ code: 50001, message: 'PATCH_FAILED' });
    expect(sendCallCount).toBe(1);
  });
});

describe('version conflict metrics tracker', () => {
  it('10분 롤링 윈도우를 유지한다', () => {
    let now = 0;
    const tracker = createVersionConflictMetricsTracker({
      now: () => now,
    });

    tracker.recordMutation();
    tracker.recordVersionConflict();

    const first = tracker.getSnapshot();
    expect(first.mutationTotal10m).toBe(1);
    expect(first.versionConflictTotal10m).toBe(1);

    now = VERSION_CONFLICT_METRIC_WINDOW_MS + 1;
    const second = tracker.getSnapshot();
    expect(second.mutationTotal10m).toBe(0);
    expect(second.versionConflictTotal10m).toBe(0);
    expect(second.versionConflictRate10m).toBe(0);
  });

  it('충돌 비율 2% 이상이면 server mutex 권고를 true로 계산한다', () => {
    const tracker = createVersionConflictMetricsTracker();
    for (let i = 0; i < 100; i += 1) {
      tracker.recordMutation();
    }
    tracker.recordVersionConflict();
    tracker.recordVersionConflict();

    const snapshot = tracker.getSnapshot();
    expect(snapshot.versionConflictRate10m).toBe(VERSION_CONFLICT_RATE_THRESHOLD);
    expect(snapshot.shouldEnableServerMutex).toBe(true);
  });
});

describe('history replay helpers', () => {
  it('rename undo/redo는 현재/이전 id를 올바르게 바꿔 replay한다', async () => {
    const calls: Array<Record<string, unknown>> = [];
    const mutators = {
      moveNode: async () => undefined,
      updateNode: async (nodeId: string, props: Record<string, unknown>, filePath?: string | null, options?: { commandType?: string }) => {
        calls.push({ nodeId, props, filePath, commandType: options?.commandType });
        return undefined;
      },
      createNode: async () => undefined,
      deleteNode: async () => undefined,
      reparentNode: async () => undefined,
    };
    const event = {
      eventId: 'rename-1',
      type: 'NODE_RENAMED' as const,
      nodeId: 'old-id',
      filePath: 'examples/a.tsx',
      commandId: 'cmd-rename-1',
      baseVersion: 'sha256:base',
      nextVersion: 'sha256:next',
      before: { id: 'old-id' },
      after: { id: 'new-id' },
      committedAt: Date.now(),
    };

    await applyEditCompletionSnapshot(event, 'before', mutators);
    await applyEditCompletionSnapshot(event, 'after', mutators);

    expect(calls).toEqual([
      {
        nodeId: 'new-id',
        props: { id: 'old-id' },
        filePath: 'examples/a.tsx',
        commandType: 'node.rename',
      },
      {
        nodeId: 'old-id',
        props: { id: 'new-id' },
        filePath: 'examples/a.tsx',
        commandType: 'node.rename',
      },
    ]);
  });

  it('create undo/redo는 delete/create inverse를 각각 사용한다', async () => {
    const calls: string[] = [];
    const mutators = {
      moveNode: async () => undefined,
      updateNode: async () => undefined,
      createNode: async (node: Record<string, unknown>) => {
        calls.push(`create:${String(node.id)}`);
        return undefined;
      },
      deleteNode: async (nodeId: string) => {
        calls.push(`delete:${nodeId}`);
        return undefined;
      },
      reparentNode: async () => undefined,
    };
    const event = {
      eventId: 'create-1',
      type: 'NODE_CREATED' as const,
      nodeId: 'shape-1',
      filePath: 'examples/a.tsx',
      commandId: 'cmd-create-1',
      baseVersion: 'sha256:base',
      nextVersion: 'sha256:next',
      before: { created: false },
      after: {
        create: {
          id: 'shape-1',
          type: 'shape',
          props: { x: 10, y: 20 },
          placement: { mode: 'canvas-absolute', x: 10, y: 20 },
        },
      },
      committedAt: Date.now(),
    };

    await applyEditCompletionSnapshot(event, 'before', mutators);
    await applyEditCompletionSnapshot(event, 'after', mutators);

    expect(calls).toEqual(['delete:shape-1', 'create:shape-1']);
  });

  it('reparent undo/redo는 parentId snapshot을 그대로 replay한다', async () => {
    const calls: Array<{ nodeId: string; newParentId?: string | null }> = [];
    const mutators = {
      moveNode: async () => undefined,
      updateNode: async () => undefined,
      createNode: async () => undefined,
      deleteNode: async () => undefined,
      reparentNode: async (nodeId: string, newParentId?: string | null) => {
        calls.push({ nodeId, newParentId });
        return undefined;
      },
    };
    const event = {
      eventId: 'reparent-1',
      type: 'NODE_REPARENTED' as const,
      nodeId: 'child',
      filePath: 'examples/map.tsx',
      commandId: 'cmd-reparent-1',
      baseVersion: 'sha256:base',
      nextVersion: 'sha256:next',
      before: { parentId: 'root-a' },
      after: { parentId: 'root-b' },
      committedAt: Date.now(),
    };

    await applyEditCompletionSnapshot(event, 'before', mutators);
    await applyEditCompletionSnapshot(event, 'after', mutators);

    expect(calls).toEqual([
      { nodeId: 'child', newParentId: 'root-a' },
      { nodeId: 'child', newParentId: 'root-b' },
    ]);
  });

  it('delete undo/redo는 recreate snapshot과 delete mutation을 교차 replay한다', async () => {
    const calls: string[] = [];
    const mutators = {
      moveNode: async () => undefined,
      updateNode: async () => undefined,
      createNode: async (node: Record<string, unknown>) => {
        calls.push(`create:${String(node.id)}`);
        return undefined;
      },
      deleteNode: async (nodeId: string) => {
        calls.push(`delete:${nodeId}`);
        return undefined;
      },
      reparentNode: async () => undefined,
    };
    const event = {
      eventId: 'delete-1',
      type: 'NODE_DELETED' as const,
      nodeId: 'shape-1',
      filePath: 'examples/a.tsx',
      commandId: 'cmd-delete-1',
      baseVersion: 'sha256:base',
      nextVersion: 'sha256:next',
      before: {
        create: {
          id: 'shape-1',
          type: 'shape',
          props: { x: 10, y: 20 },
          placement: { mode: 'canvas-absolute', x: 10, y: 20 },
        },
      },
      after: { deleted: true },
      committedAt: Date.now(),
    };

    await applyEditCompletionSnapshot(event, 'before', mutators);
    await applyEditCompletionSnapshot(event, 'after', mutators);

    expect(calls).toEqual(['create:shape-1', 'delete:shape-1']);
  });

  it('lock toggle replay uses generic node.update snapshots', async () => {
    const calls: Array<Record<string, unknown>> = [];
    const mutators = {
      moveNode: async () => undefined,
      updateNode: async (nodeId: string, props: Record<string, unknown>, filePath?: string | null) => {
        calls.push({ nodeId, props, filePath });
        return undefined;
      },
      createNode: async () => undefined,
      deleteNode: async () => undefined,
      reparentNode: async () => undefined,
    };
    const event = {
      eventId: 'lock-1',
      type: 'NODE_LOCK_TOGGLED' as const,
      nodeId: 'shape-1',
      filePath: 'examples/a.tsx',
      commandId: 'cmd-lock-1',
      baseVersion: 'sha256:base',
      nextVersion: 'sha256:next',
      before: { locked: false },
      after: { locked: true },
      committedAt: Date.now(),
    };

    await applyEditCompletionSnapshot(event, 'before', mutators);
    await applyEditCompletionSnapshot(event, 'after', mutators);

    expect(calls).toEqual([
      { nodeId: 'shape-1', props: { locked: false }, filePath: 'examples/a.tsx' },
      { nodeId: 'shape-1', props: { locked: true }, filePath: 'examples/a.tsx' },
    ]);
    expect(shouldReloadAfterHistoryReplay(event)).toBe(true);
  });

  it('style update replay uses node.style.update without forcing reload semantics', async () => {
    const calls: Array<Record<string, unknown>> = [];
    const mutators = {
      moveNode: async () => undefined,
      updateNode: async (nodeId: string, props: Record<string, unknown>, filePath?: string | null, options?: { commandType?: string }) => {
        calls.push({ nodeId, props, filePath, commandType: options?.commandType });
        return undefined;
      },
      createNode: async () => undefined,
      deleteNode: async () => undefined,
      reparentNode: async () => undefined,
    };
    const event = {
      eventId: 'style-1',
      type: 'STYLE_UPDATED' as const,
      nodeId: 'sticky-1',
      filePath: 'examples/sticky.tsx',
      commandId: 'cmd-style-1',
      baseVersion: 'sha256:base',
      nextVersion: 'sha256:next',
      before: { className: 'shadow-sm' },
      after: { className: 'shadow-lg ring-2' },
      committedAt: Date.now(),
    };

    await applyEditCompletionSnapshot(event, 'before', mutators);
    await applyEditCompletionSnapshot(event, 'after', mutators);

    expect(calls).toEqual([
      {
        nodeId: 'sticky-1',
        props: { className: 'shadow-sm' },
        filePath: 'examples/sticky.tsx',
        commandType: 'node.style.update',
      },
      {
        nodeId: 'sticky-1',
        props: { className: 'shadow-lg ring-2' },
        filePath: 'examples/sticky.tsx',
        commandType: 'node.style.update',
      },
    ]);
    expect(shouldReloadAfterHistoryReplay(event)).toBe(false);
  });

  it('rename/create/delete/lock/reparent 이벤트만 graph reload를 요구한다', () => {
    expect(shouldReloadAfterHistoryReplay({
      eventId: 'style-1',
      type: 'STYLE_UPDATED',
      nodeId: 'n1',
      filePath: 'examples/a.tsx',
      commandId: 'cmd-style',
      baseVersion: 'sha256:base',
      nextVersion: 'sha256:next',
      before: { fill: '#fff' },
      after: { fill: '#000' },
      committedAt: 1,
    })).toBe(false);

    expect(shouldReloadAfterHistoryReplay({
      eventId: 'create-1',
      type: 'NODE_CREATED',
      nodeId: 'n1',
      filePath: 'examples/a.tsx',
      commandId: 'cmd-create',
      baseVersion: 'sha256:base',
      nextVersion: 'sha256:next',
      before: { created: false },
      after: { create: { id: 'n1' } },
      committedAt: 1,
    })).toBe(true);

    expect(shouldReloadAfterHistoryReplay({
      eventId: 'delete-1',
      type: 'NODE_DELETED',
      nodeId: 'n1',
      filePath: 'examples/a.tsx',
      commandId: 'cmd-delete',
      baseVersion: 'sha256:base',
      nextVersion: 'sha256:next',
      before: { create: { id: 'n1' } },
      after: { deleted: true },
      committedAt: 1,
    })).toBe(true);
  });
});
