import { afterEach, describe, expect, it } from 'bun:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { tmpdir } from 'os';
import {
  compatibilitySubscriptionHandlers,
  runWithOptionalFileMutex,
} from './compatibilityHandlers';

const originalMutexEnv = process.env.MAGAM_WS_ENABLE_FILE_MUTEX;
const tempDirs: string[] = [];

function createDeferred<T = void>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => { };
  let reject: (reason?: unknown) => void = () => { };
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function waitForAsyncTurn(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  if (originalMutexEnv === undefined) {
    delete process.env.MAGAM_WS_ENABLE_FILE_MUTEX;
  } else {
    process.env.MAGAM_WS_ENABLE_FILE_MUTEX = originalMutexEnv;
  }
});

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

describe('runWithOptionalFileMutex', () => {
  it('file.subscribe / file.unsubscribe resolve compatibility file paths through the dedicated handler', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'magam-compat-subscribe-'));
    tempDirs.push(dir);
    const documentsDir = join(dir, 'documents');
    await mkdir(documentsDir, { recursive: true });
    const filePath = join(documentsDir, 'doc-1.graph.tsx');
    await writeFile(filePath, 'export default function Doc(){ return null; }', 'utf-8');

    process.env.MAGAM_TARGET_DIR = dir;
    const subscriptions = new Set<string>();
    const ctx = { ws: {}, subscriptions };

    await expect(compatibilitySubscriptionHandlers['file.subscribe']({
      filePath: 'documents/doc-1.graph.tsx',
      rootPath: dir,
    }, ctx)).resolves.toEqual({ success: true });
    expect(subscriptions.has(filePath)).toBe(true);

    await expect(compatibilitySubscriptionHandlers['file.unsubscribe']({
      filePath: 'documents/doc-1.graph.tsx',
      rootPath: dir,
    }, ctx)).resolves.toEqual({ success: true });
    expect(subscriptions.has(filePath)).toBe(false);
  });

  it('mutex OFF면 같은 파일 작업도 병렬로 시작될 수 있다', async () => {
    process.env.MAGAM_WS_ENABLE_FILE_MUTEX = '0';

    const blocker = createDeferred<void>();
    let firstStarted = false;
    let secondStarted = false;

    const first = runWithOptionalFileMutex('same-file-off', async () => {
      firstStarted = true;
      await blocker.promise;
      return 'first';
    });

    await waitForAsyncTurn();
    const second = runWithOptionalFileMutex('same-file-off', async () => {
      secondStarted = true;
      return 'second';
    });

    await waitForAsyncTurn();
    expect(firstStarted).toBe(true);
    expect(secondStarted).toBe(true);

    blocker.resolve();
    await expect(Promise.all([first, second])).resolves.toEqual(['first', 'second']);
  });

  it('mutex ON이면 같은 파일 작업은 직렬화된다', async () => {
    process.env.MAGAM_WS_ENABLE_FILE_MUTEX = '1';

    const blocker = createDeferred<void>();
    let secondStarted = false;

    const first = runWithOptionalFileMutex('same-file-on', async () => {
      await blocker.promise;
      return 'first';
    });

    await waitForAsyncTurn();
    const second = runWithOptionalFileMutex('same-file-on', async () => {
      secondStarted = true;
      return 'second';
    });

    await waitForAsyncTurn();
    expect(secondStarted).toBe(false);

    blocker.resolve();
    await first;
    await second;
    expect(secondStarted).toBe(true);
  });

  it('mutex ON이어도 서로 다른 파일은 독립 실행된다', async () => {
    process.env.MAGAM_WS_ENABLE_FILE_MUTEX = '1';

    const blocker = createDeferred<void>();
    let secondStarted = false;

    const first = runWithOptionalFileMutex('file-a', async () => {
      await blocker.promise;
      return 'first';
    });

    await waitForAsyncTurn();
    const second = runWithOptionalFileMutex('file-b', async () => {
      secondStarted = true;
      return 'second';
    });

    await waitForAsyncTurn();
    expect(secondStarted).toBe(true);

    blocker.resolve();
    await expect(Promise.all([first, second])).resolves.toEqual(['first', 'second']);
  });

  it('실패한 작업 이후에도 같은 파일 lock이 해제된다', async () => {
    process.env.MAGAM_WS_ENABLE_FILE_MUTEX = '1';

    await expect(runWithOptionalFileMutex('failure-file', async () => {
      throw new Error('boom');
    })).rejects.toThrow('boom');

    let started = false;
    await expect(runWithOptionalFileMutex('failure-file', async () => {
      started = true;
      return 'ok';
    })).resolves.toBe('ok');
    expect(started).toBe(true);
  });

  it('compatibilityHandlers만 filePatcher를 직접 import한다', async () => {
    const handlersDir = join(process.cwd(), 'app', 'ws', 'handlers');
    const files = [
      'canvasHandlers.ts',
      'workspaceHandlers.ts',
      'appStateHandlers.ts',
      'compatibilityHandlers.ts',
      'historyHandlers.ts',
    ];

    const contents = await Promise.all(
      files.map(async (file) => ({
        file,
        source: await readFile(join(handlersDir, file), 'utf-8'),
      })),
    );

    const importers = contents
      .filter(({ source }) => source.includes("from '../filePatcher'"))
      .map(({ file }) => file);

    expect(importers).toEqual(['compatibilityHandlers.ts']);
  });
});
