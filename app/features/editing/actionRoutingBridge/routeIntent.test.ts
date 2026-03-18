import { describe, expect, it } from 'bun:test';
import { createPaneCreateIntentEnvelope, createRenameIntentEnvelope, createStyleIntentEnvelope } from '@/features/editing/actionRoutingBridge/__fixtures__/intentEnvelopes';
import { routeIntent } from '@/features/editing/actionRoutingBridge/routeIntent';
import { makeActionRoutingContext, makeCanonicalNode } from '@/features/editing/actionRoutingBridge/testUtils';

describe('action routing bridge routeIntent', () => {
  it('returns INTENT_NOT_REGISTERED for unknown intents', () => {
    const result = routeIntent({
      envelope: {
        ...createStyleIntentEnvelope(),
        intentId: 'unknown.intent',
      },
      context: makeActionRoutingContext(),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INTENT_NOT_REGISTERED');
  });

  it('builds an optimistic style update plan with runtime patch + mutation', () => {
    const target = makeCanonicalNode({
      id: 'shape-1',
      type: 'shape',
      data: { color: '#000000' },
    });

    const result = routeIntent({
      envelope: createStyleIntentEnvelope(),
      context: makeActionRoutingContext({
        nodes: [target],
      }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.steps).toHaveLength(2);
    expect(result.value.steps[0]?.kind).toBe('runtime-only-action');
    expect(result.value.steps[1]?.kind).toBe('canonical-mutation');
    expect(result.value.rollbackSteps).toHaveLength(1);
  });

  it('builds a rename plan for node-context-menu surface only', () => {
    const target = makeCanonicalNode({
      id: 'shape-1',
      type: 'shape',
    });

    const result = routeIntent({
      envelope: createRenameIntentEnvelope(),
      context: makeActionRoutingContext({
        nodes: [target],
      }),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.steps).toHaveLength(1);
    expect(result.value.steps[0]).toMatchObject({
      kind: 'canonical-mutation',
      actionId: 'node.update',
    });
  });

  it('builds a pane create plan with node.create mutation', () => {
    const result = routeIntent({
      envelope: createPaneCreateIntentEnvelope(),
      context: makeActionRoutingContext(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.steps[0]).toMatchObject({
      kind: 'canonical-mutation',
      actionId: 'node.create',
    });
  });
});
