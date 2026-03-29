export type HostMode = 'desktop-primary' | 'web-secondary';

export type HostAppEvent =
  | { type: 'workspace-selected'; path: string }
  | { type: 'workspace-cleared' }
  | { type: 'backend-ready' }
  | { type: 'backend-failed'; code: string; message: string }
  | { type: 'workspace-runtime-invalidated'; workspaceId: string; canvasId?: string | null }
  | { type: 'shutdown-requested' };

export interface HostCapabilitySurface {
  workspace: {
    selectWorkspace: () => Promise<{ path: string } | null>;
    chooseSaveLocation: () => Promise<{ path: string } | null>;
    revealInOs: (path: string) => Promise<void>;
  };
  shell: {
    openExternal: (url: string) => Promise<void>;
  };
  lifecycle: {
    onAppEvent: (listener: (event: HostAppEvent) => void) => () => void;
  };
}

export interface DesktopBootstrapFailure {
  code: string;
  message: string;
}

export interface DesktopBootstrapSession {
  sessionId: string;
  workspacePath: string | null;
  workspaceMode: 'transient' | 'persisted';
  storageBackend: 'memory' | 'file';
  transientCanvasId: string | null;
  backendState: 'idle' | 'starting' | 'ready' | 'failed' | 'stopping';
  rendererState: 'idle' | 'loading' | 'ready' | 'failed';
  startedAt: number;
  updatedAt: number;
  lastError?: DesktopBootstrapFailure;
}

export interface DesktopRuntimeConfig {
  mode: 'desktop-primary';
  appStateDbPath: string | null;
  workspacePath: string | null;
  workspaceMode: 'transient' | 'persisted';
  storageBackend: 'memory' | 'file';
  transientCanvasId: string | null;
}

export interface DesktopRpcBridge {
  healthCheck: () => Promise<boolean>;
  invoke: <T = unknown>(method: string, payload?: unknown) => Promise<T>;
}

export interface HostBootstrapSurface {
  getSession: () => Promise<DesktopBootstrapSession | null>;
  markRendererLoading: () => Promise<DesktopBootstrapSession | null>;
  markRendererReady: () => Promise<DesktopBootstrapSession | null>;
  markRendererFailed: (payload: DesktopBootstrapFailure) => Promise<DesktopBootstrapSession | null>;
}

export interface DesktopHostBridge {
  runtime: DesktopRuntimeConfig;
  capabilities: HostCapabilitySurface;
  bootstrap: HostBootstrapSurface;
  rpc: DesktopRpcBridge;
}
