import { afterEach, describe, expect, it } from 'vitest';
import { getHostRuntime, resetHostRuntimeForTests } from './createHostRuntime';

function createDesktopHostBridge() {
  return {
    runtime: {
      mode: 'desktop-primary' as const,
      appStateDbPath: '/tmp/app-state-pgdata',
      workspacePath: '/tmp/workspace',
      workspaceMode: 'persisted' as const,
      storageBackend: 'file' as const,
      transientCanvasId: null,
    },
    capabilities: {
      workspace: {
        async selectWorkspace() {
          return null;
        },
        async chooseSaveLocation() {
          return null;
        },
        async revealInOs() {
          return;
        },
      },
      shell: {
        async openExternal() {
          return;
        },
      },
      lifecycle: {
        onAppEvent() {
          return () => undefined;
        },
      },
    },
    bootstrap: {
      async getSession() {
        return null;
      },
      async markRendererLoading() {
        return null;
      },
      async markRendererReady() {
        return null;
      },
      async markRendererFailed() {
        return null;
      },
    },
    rpc: {
      async healthCheck() {
        return true;
      },
      async invoke() {
        return { ok: true, result: null };
      },
    },
  };
}

afterEach(() => {
  resetHostRuntimeForTests();
  delete (globalThis as { window?: Window }).window;
});

describe('getHostRuntime', () => {
  it('builds web-secondary runtime when no desktop bridge is available', () => {
    const runtime = getHostRuntime();

    expect(runtime.mode).toBe('web-secondary');
    expect(runtime.runtimeConfig).toBeNull();
    expect(runtime.rpc.descriptor.hostMode).toBe('web-secondary');
  });

  it('exposes the desktop runtime config including app-state DB path from the bridge', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        __MAGAM_DESKTOP_HOST__: createDesktopHostBridge(),
      },
    });

    const runtime = getHostRuntime();

    expect(runtime.mode).toBe('desktop-primary');
    expect(runtime.runtimeConfig).toEqual(expect.objectContaining({
      appStateDbPath: '/tmp/app-state-pgdata',
      workspacePath: '/tmp/workspace',
      workspaceMode: 'persisted',
      storageBackend: 'file',
      transientCanvasId: null,
    }));
    expect(runtime.rpc.descriptor.hostMode).toBe('desktop-primary');
  });
});
