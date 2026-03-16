import { describe, expect, it } from 'bun:test';
import {
  applySessionUpdate,
  createWorkspaceStyleSessionState,
} from './sessionState';

describe('workspace-styling/sessionState', () => {
  it('creates first accepted state for a new object', () => {
    const state = createWorkspaceStyleSessionState('session-1');
    const result = applySessionUpdate(state, {
      objectId: 'node-1',
      sourceRevision: 'rev-1',
      timestamp: 100,
    });

    expect(result.stale).toBe(false);
    expect(result.state.byObjectId['node-1']).toEqual({
      sessionId: 'session-1',
      objectId: 'node-1',
      latestAcceptedRevision: 'rev-1',
      lastAppliedAt: 100,
      updateCount: 1,
    });
  });

  it('accepts newer update and increments count', () => {
    const base = applySessionUpdate(createWorkspaceStyleSessionState(), {
      objectId: 'node-1',
      sourceRevision: 'rev-1',
      timestamp: 100,
    }).state;

    const result = applySessionUpdate(base, {
      objectId: 'node-1',
      sourceRevision: 'rev-2',
      timestamp: 200,
    });

    expect(result.stale).toBe(false);
    expect(result.state.byObjectId['node-1']).toMatchObject({
      latestAcceptedRevision: 'rev-2',
      lastAppliedAt: 200,
      updateCount: 2,
    });
  });

  it('treats older timestamp with different revision as stale', () => {
    const base = applySessionUpdate(createWorkspaceStyleSessionState(), {
      objectId: 'node-1',
      sourceRevision: 'rev-2',
      timestamp: 200,
    }).state;

    const result = applySessionUpdate(base, {
      objectId: 'node-1',
      sourceRevision: 'rev-1',
      timestamp: 100,
    });

    expect(result.stale).toBe(true);
    expect(result.state).toBe(base);
    expect(result.state.byObjectId['node-1'].latestAcceptedRevision).toBe('rev-2');
  });

  it('allows idempotent same-revision updates', () => {
    const base = applySessionUpdate(createWorkspaceStyleSessionState(), {
      objectId: 'node-1',
      sourceRevision: 'rev-1',
      timestamp: 100,
    }).state;

    const result = applySessionUpdate(base, {
      objectId: 'node-1',
      sourceRevision: 'rev-1',
      timestamp: 50,
    });

    expect(result.stale).toBe(false);
    expect(result.state.byObjectId['node-1']).toMatchObject({
      latestAcceptedRevision: 'rev-1',
      updateCount: 2,
    });
  });
});

