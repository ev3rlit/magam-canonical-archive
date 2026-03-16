import type {
  SessionUpdateInput,
  SessionUpdateResult,
  StyleUpdateSession,
  WorkspaceStyleSessionState,
} from './types';

export function createWorkspaceStyleSessionState(sessionId = 'workspace-style-session'): WorkspaceStyleSessionState {
  return {
    sessionId,
    byObjectId: {},
  };
}

function isStaleAgainstSession(existing: StyleUpdateSession, input: SessionUpdateInput): boolean {
  if (input.sourceRevision === existing.latestAcceptedRevision) {
    return false;
  }

  return input.timestamp < existing.lastAppliedAt;
}

export function applySessionUpdate(
  state: WorkspaceStyleSessionState,
  input: SessionUpdateInput,
): SessionUpdateResult {
  const existing = state.byObjectId[input.objectId];
  if (!existing) {
    return {
      stale: false,
      state: {
        ...state,
        byObjectId: {
          ...state.byObjectId,
          [input.objectId]: {
            sessionId: state.sessionId,
            objectId: input.objectId,
            latestAcceptedRevision: input.sourceRevision,
            lastAppliedAt: input.timestamp,
            updateCount: 1,
          },
        },
      },
    };
  }

  if (isStaleAgainstSession(existing, input)) {
    return { stale: true, state };
  }

  return {
    stale: false,
    state: {
      ...state,
      byObjectId: {
        ...state.byObjectId,
        [input.objectId]: {
          ...existing,
          latestAcceptedRevision: input.sourceRevision,
          lastAppliedAt: input.timestamp,
          updateCount: existing.updateCount + 1,
        },
      },
    },
  };
}

