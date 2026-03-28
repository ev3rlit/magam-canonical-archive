import type {
  DesktopBootstrapFailure,
  DesktopBootstrapSession,
  DesktopRuntimeConfig,
} from '@/features/host/contracts';
import {
  createDesktopBootstrapFailure,
  createDesktopBootstrapSession,
  mergeDesktopBootstrapSession,
} from './bootstrapSession';
import {
  startDesktopBackend,
  type DesktopBackendHandle,
} from './backendLifecycle';
import {
  createLifecycleEventBridge,
  type HostAppEventListener,
} from './lifecycleEvents';

export interface DesktopHostOrchestrator {
  getRuntimeConfig: () => DesktopRuntimeConfig;
  getSession: () => DesktopBootstrapSession;
  markRendererFailed: (payload: DesktopBootstrapFailure) => DesktopBootstrapSession;
  markRendererLoading: () => DesktopBootstrapSession;
  markRendererReady: () => DesktopBootstrapSession;
  selectWorkspace: (workspacePath: string) => Promise<DesktopBootstrapSession>;
  start: () => Promise<DesktopBootstrapSession>;
  stop: () => Promise<void>;
  subscribe: (listener: HostAppEventListener) => () => void;
}

export interface DesktopHostOrchestratorConfig {
  appStateDbPath: string;
  bunBin: string;
  httpPort: number;
  repoRoot: string;
  workspacePath: string | null;
  wsPort: number;
}

export function createDesktopHostOrchestrator(
  config: DesktopHostOrchestratorConfig,
): DesktopHostOrchestrator {
  const events = createLifecycleEventBridge();
  let workspacePath = config.workspacePath;
  let session = createDesktopBootstrapSession(workspacePath);
  let backend: DesktopBackendHandle | null = null;
  let runtimeConfig: DesktopRuntimeConfig = {
    mode: 'desktop-primary',
    httpBaseUrl: `http://127.0.0.1:${config.httpPort}`,
    wsUrl: `ws://127.0.0.1:${config.wsPort}`,
    appStateDbPath: config.appStateDbPath,
    workspacePath,
    workspaceMode: workspacePath ? 'persisted' : 'transient',
    storageBackend: workspacePath ? 'file' : 'memory',
    transientCanvasId: session.transientCanvasId,
  };

  function updateSession(
    patch: Partial<DesktopBootstrapSession>,
  ): DesktopBootstrapSession {
    session = mergeDesktopBootstrapSession(session, patch);
    return session;
  }

  async function restartBackend(nextWorkspacePath: string | null): Promise<DesktopBootstrapSession> {
    updateSession({
      backendState: 'starting',
      lastError: undefined,
      rendererState: 'loading',
      workspacePath: nextWorkspacePath,
    });

    if (backend) {
      updateSession({ backendState: 'stopping' });
      await backend.stop();
      backend = null;
    }

    try {
      backend = await startDesktopBackend({
        appStateDbPath: config.appStateDbPath,
        bunBin: config.bunBin,
        httpPort: config.httpPort,
        repoRoot: config.repoRoot,
        workspacePath: nextWorkspacePath,
        wsPort: config.wsPort,
      });
      workspacePath = nextWorkspacePath;
      runtimeConfig = {
        mode: 'desktop-primary',
        httpBaseUrl: backend.httpBaseUrl,
        wsUrl: backend.wsUrl,
        appStateDbPath: config.appStateDbPath,
        workspacePath,
        workspaceMode: nextWorkspacePath ? 'persisted' : 'transient',
        storageBackend: nextWorkspacePath ? 'file' : 'memory',
        transientCanvasId: nextWorkspacePath ? null : session.transientCanvasId,
      };
      updateSession({
        backendState: 'ready',
        workspacePath,
      });
      if (workspacePath) {
        events.emit({ type: 'workspace-selected', path: workspacePath });
      } else {
        events.emit({ type: 'workspace-cleared' });
      }
      events.emit({ type: 'backend-ready' });
      return session;
    } catch (error) {
      const failure = createDesktopBootstrapFailure(
        'DESKTOP_BOOT_BACKEND_START_FAILED',
        error instanceof Error ? error.message : 'Unknown backend startup error',
      );
      updateSession({
        backendState: 'failed',
        lastError: failure,
      });
      events.emit({
        type: 'backend-failed',
        code: failure.code,
        message: failure.message,
      });
      throw error;
    }
  }

  return {
    getRuntimeConfig() {
      return runtimeConfig;
    },
    getSession() {
      return session;
    },
    markRendererFailed(payload) {
      return updateSession({
        lastError: payload,
        rendererState: 'failed',
      });
    },
    markRendererLoading() {
      return updateSession({
        rendererState: 'loading',
      });
    },
    markRendererReady() {
      return updateSession({
        rendererState: 'ready',
      });
    },
    async selectWorkspace(nextWorkspacePath: string) {
      return restartBackend(nextWorkspacePath);
    },
    async start() {
      return restartBackend(workspacePath);
    },
    async stop() {
      events.emit({ type: 'shutdown-requested' });
      updateSession({ backendState: 'stopping' });
      if (backend) {
        await backend.stop();
        backend = null;
      }
      updateSession({ backendState: 'idle' });
    },
    subscribe(listener) {
      return events.subscribe(listener);
    },
  };
}
