import { randomUUID } from 'node:crypto';
import type {
  DesktopBootstrapFailure,
  DesktopBootstrapSession,
} from '@/features/host/contracts';

export function createDesktopBootstrapSession(
  workspacePath: string | null,
): DesktopBootstrapSession {
  const timestamp = Date.now();
  const isPersisted = typeof workspacePath === 'string' && workspacePath.length > 0;
  return {
    sessionId: randomUUID(),
    workspacePath,
    workspaceMode: isPersisted ? 'persisted' : 'transient',
    storageBackend: isPersisted ? 'file' : 'memory',
    transientCanvasId: isPersisted ? null : `transient-canvas-${randomUUID()}`,
    backendState: 'idle',
    rendererState: 'idle',
    startedAt: timestamp,
    updatedAt: timestamp,
  };
}

export function mergeDesktopBootstrapSession(
  session: DesktopBootstrapSession,
  patch: Partial<DesktopBootstrapSession>,
): DesktopBootstrapSession {
  const workspacePath = patch.workspacePath === undefined
    ? session.workspacePath
    : patch.workspacePath;
  const isPersisted = typeof workspacePath === 'string' && workspacePath.length > 0;
  return {
    ...session,
    ...patch,
    workspaceMode: patch.workspaceMode ?? (isPersisted ? 'persisted' : 'transient'),
    storageBackend: patch.storageBackend ?? (isPersisted ? 'file' : 'memory'),
    transientCanvasId: patch.transientCanvasId === undefined
      ? (isPersisted ? null : session.transientCanvasId ?? `transient-canvas-${randomUUID()}`)
      : patch.transientCanvasId,
    updatedAt: Date.now(),
  };
}

export function createDesktopBootstrapFailure(
  code: string,
  message: string,
): DesktopBootstrapFailure {
  return {
    code,
    message,
  };
}
