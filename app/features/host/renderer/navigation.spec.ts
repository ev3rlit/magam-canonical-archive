import { afterEach, describe, expect, it } from 'vitest';
import {
  buildAppNavigationTarget,
  navigateToAppRoute,
  navigateToDashboard,
  navigateToDocument,
  navigateToWorkspaceDocument,
  navigateToWorkspaceDetail,
} from './navigation';

const originalWindow = (globalThis as { window?: Window }).window;

function installWindowStub(input?: {
  desktop?: boolean;
}) {
  const location = {
    href: 'http://localhost/app',
    hash: '',
  };
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      location,
      ...(input?.desktop
        ? {
            __MAGAM_DESKTOP_HOST__: {
              runtime: {
                mode: 'desktop-primary' as const,
                httpBaseUrl: 'http://127.0.0.1:3003',
                wsUrl: 'ws://127.0.0.1:3004',
                appStateDbPath: '/tmp/app-state-pgdata',
                workspacePath: null,
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
            },
          }
        : {}),
    },
  });

  return location;
}

afterEach(() => {
  if (originalWindow === undefined) {
    delete (globalThis as { window?: unknown }).window;
  } else {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    });
  }
});

describe('renderer navigation', () => {
  it('builds web targets under /app', () => {
    installWindowStub();
    expect(buildAppNavigationTarget('/workspace/ws-1')).toBe('/app/workspace/ws-1');
  });

  it('builds desktop targets under hash routes', () => {
    installWindowStub({ desktop: true });
    expect(buildAppNavigationTarget('/workspace/ws-1')).toBe('#/workspace/ws-1');
  });

  it('navigates to workspace, document, and dashboard routes in desktop mode', () => {
    const location = installWindowStub({ desktop: true });

    navigateToWorkspaceDetail('ws-1');
    expect(location.hash).toBe('/workspace/ws-1');

    navigateToDocument('/tmp/workspace/docs/alpha.graph.tsx');
    expect(location.hash).toBe(`/${'document'}/${encodeURIComponent('/tmp/workspace/docs/alpha.graph.tsx')}`);

    navigateToWorkspaceDocument('/tmp/workspace', { filePath: 'docs/beta.graph.tsx' });
    expect(location.hash).toBe(`/${'document'}/${encodeURIComponent('/tmp/workspace/docs/beta.graph.tsx')}`);

    navigateToDashboard();
    expect(location.hash).toBe('/');
  });

  it('navigates with /app href targets in web mode', () => {
    const location = installWindowStub();

    navigateToAppRoute('/workspace/ws-2');
    expect(location.href).toBe('/app/workspace/ws-2');
  });
});
