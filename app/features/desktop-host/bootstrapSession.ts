import { randomUUID } from 'node:crypto';
import type {
  DesktopBootstrapFailure,
  DesktopBootstrapSession,
} from '@/features/host/contracts';

export function createDesktopBootstrapSession(
  workspacePath: string | null,
): DesktopBootstrapSession {
  const timestamp = Date.now();
  return {
    sessionId: randomUUID(),
    workspacePath,
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
  return {
    ...session,
    ...patch,
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
