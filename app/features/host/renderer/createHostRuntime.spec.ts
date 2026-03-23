import { afterEach, describe, expect, it } from 'vitest';
import { getHostRuntime, resetHostRuntimeForTests } from './createHostRuntime';

function createDesktopHostBridge() {
  return {
    runtime: {
      mode: 'desktop-primary' as const,
      httpBaseUrl: 'http://127.0.0.1:3003',
      wsUrl: 'ws://127.0.0.1:3004',
      appStateDbPath: '/tmp/app-state-pgdata',
      workspacePath: '/tmp/workspace',
    },
    capabilities: {
      workspace: {
        async selectWorkspace() {
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
    expect(runtime.rpc.descriptor.methods).not.toContain('chat.send');
    expect('sendChat' in runtime.rpc).toBe(false);
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
      httpBaseUrl: 'http://127.0.0.1:3003',
      wsUrl: 'ws://127.0.0.1:3004',
      appStateDbPath: '/tmp/app-state-pgdata',
      workspacePath: '/tmp/workspace',
    }));
    expect(runtime.rpc.descriptor.hostMode).toBe('desktop-primary');
    expect(runtime.rpc.descriptor.methods).not.toContain('chat.send');
    expect('sendChat' in runtime.rpc).toBe(false);
  });
});
