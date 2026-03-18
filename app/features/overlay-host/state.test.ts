import { describe, expect, it } from 'bun:test';
import { closeOverlay, openOverlay, replaceOverlay } from './commands';
import { initialOverlayHostState } from './state';
import { createTestContribution } from './testUtils';

const viewport = { width: 800, height: 600 };

describe('overlay host state and commands', () => {
  it('sorts active overlays by priority and openedAt', () => {
    const toolbar = openOverlay({
      state: initialOverlayHostState,
      contribution: createTestContribution('toolbar', {
        anchor: { type: 'viewport-fixed', x: 400, y: 568 },
      }),
      viewport,
      now: 1,
    });

    const nodeMenu = openOverlay({
      state: toolbar.state,
      contribution: createTestContribution('node-context-menu', {
        anchor: { type: 'pointer', x: 120, y: 160 },
      }),
      viewport,
      now: 2,
    });

    expect(nodeMenu.state.active.map((item) => item.slot)).toEqual([
      'toolbar',
      'node-context-menu',
    ]);
  });

  it('records dismiss metadata when an instance closes', () => {
    const opened = openOverlay({
      state: initialOverlayHostState,
      contribution: createTestContribution(),
      viewport,
      now: 10,
    });

    const closed = closeOverlay({
      state: opened.state,
      instanceId: opened.instanceId,
      reason: 'escape-key',
      now: 11,
    });

    expect(closed.state.active).toHaveLength(0);
    expect(closed.state.lastDismissed).toEqual({
      slot: 'pane-context-menu',
      reason: 'escape-key',
      at: 11,
    });
  });

  it('replaces an existing slot instead of keeping duplicates', () => {
    const first = openOverlay({
      state: initialOverlayHostState,
      contribution: createTestContribution('pane-context-menu', {
        anchor: { type: 'pointer', x: 100, y: 120 },
      }),
      viewport,
      now: 20,
    });

    const next = replaceOverlay({
      state: first.state,
      instanceId: first.instanceId,
      contribution: createTestContribution('pane-context-menu', {
        anchor: { type: 'pointer', x: 200, y: 240 },
      }),
      viewport,
      now: 21,
    });

    expect(next.state.active).toHaveLength(1);
    expect(next.instanceId).not.toBe(first.instanceId);
    expect(next.state.active[0]?.resolvedPosition).toEqual({ x: 200, y: 240 });
  });
});
