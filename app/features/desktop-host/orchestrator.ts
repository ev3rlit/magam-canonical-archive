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
  workspacePath: string | null;
}

export function createDesktopHostOrchestrator(
  config: DesktopHostOrchestratorConfig,
): DesktopHostOrchestrator {
  const events = createLifecycleEventBridge();
  let workspacePath = config.workspacePath;
  let session = createDesktopBootstrapSession(workspacePath);
  let runtimeConfig: DesktopRuntimeConfig = {
    mode: 'desktop-primary',
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

  async function activateRuntime(nextWorkspacePath: string | null): Promise<DesktopBootstrapSession> {
    updateSession({
      backendState: 'starting',
      lastError: undefined,
      rendererState: 'loading',
      workspacePath: nextWorkspacePath,
    });

    try {
      workspacePath = nextWorkspacePath;
      runtimeConfig = {
        mode: 'desktop-primary',
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
      return activateRuntime(nextWorkspacePath);
    },
    async start() {
      return activateRuntime(workspacePath);
    },
    async stop() {
      events.emit({ type: 'shutdown-requested' });
      updateSession({ backendState: 'stopping' });
      updateSession({ backendState: 'idle' });
    },
    subscribe(listener) {
      return events.subscribe(listener);
    },
  };
}
