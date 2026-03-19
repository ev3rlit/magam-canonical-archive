import { describe, expect, it } from 'bun:test';
import { createActionRoutingRegistry } from '@/features/editing/actionRoutingBridge/registry';
import {
  createContentIntentEnvelope,
  createNodeChildIntentEnvelope,
  createPaneCreateIntentEnvelope,
  createStyleIntentEnvelope,
} from '@/features/editing/actionRoutingBridge/__fixtures__/intentEnvelopes';
import {
  makeActionRoutingContext,
  makeCanonicalNode,
  makeReadonlyNode,
} from '@/features/editing/actionRoutingBridge/testUtils';

describe('action routing bridge registry', () => {
  const registry = createActionRoutingRegistry();

  it('rejects style patch keys outside canonical editability surface', () => {
    const node = makeCanonicalNode({
      id: 'shape-1',
      type: 'shape',
      data: { color: '#000000' },
    });
    const result = registry['selection.style.update']?.normalizePayload({
      envelope: createStyleIntentEnvelope({
        rawPayload: {
          patch: {
            color: '#ffffff',
            anchor: 'forbidden',
          },
        },
      }),
      context: makeActionRoutingContext({
        nodes: [node],
      }),
    });

    expect(result?.ok).toBe(false);
    if (!result || result.ok) return;
    expect(result.error.code).toBe('INTENT_PAYLOAD_INVALID');
  });

  it('denies mindmap child create when target is not a mindmap member', () => {
    const node = makeCanonicalNode({
      id: 'shape-1',
      type: 'shape',
    });
    const result = registry['node.create']?.isEnabled({
      envelope: createNodeChildIntentEnvelope(),
      context: makeActionRoutingContext({
        nodes: [node],
      }),
    });

    expect(result?.ok).toBe(false);
    if (!result || result.ok) return;
    expect(result.error.code).toBe('INTENT_GATING_DENIED');
  });

  it('allows pane create without a selected target', () => {
    const result = registry['node.create']?.isEnabled({
      envelope: createPaneCreateIntentEnvelope(),
      context: makeActionRoutingContext(),
    });

    expect(result).toEqual({ ok: true, value: true });
  });

  it('merges drag-sized rectangle create props into the node.create payload', () => {
    const normalized = registry['node.create']?.normalizePayload({
      envelope: createPaneCreateIntentEnvelope({
        rawPayload: {
          nodeType: 'rectangle',
          placement: {
            mode: 'canvas-absolute',
            x: 120,
            y: 160,
          },
          initialProps: {
            size: {
              width: 240,
              height: 140,
            },
          },
        },
      }),
      context: makeActionRoutingContext(),
    });

    expect(normalized?.ok).toBe(true);
    if (!normalized || !normalized.ok) return;
    expect(normalized.value.createInput).toMatchObject({
      type: 'rectangle',
      props: {
        type: 'rectangle',
        size: {
          width: 240,
          height: 140,
        },
      },
    });
  });

  it('normalizes content updates against canonical content carriers', () => {
    const node = makeCanonicalNode({
      id: 'text-1',
      type: 'text',
      data: { label: 'Before' },
    });
    const result = registry['selection.content.update']?.normalizePayload({
      envelope: createContentIntentEnvelope(),
      context: makeActionRoutingContext({
        nodes: [node],
      }),
    });

    expect(result?.ok).toBe(true);
    if (!result || !result.ok) return;
    expect(result.value.previousContent).toBe('Before');
    expect(result.value.nextContent).toBe('Updated content');
  });

  it('treats read-only nodes as gated for selection style updates', () => {
    const node = makeReadonlyNode({
      id: 'readonly-1',
      type: 'shape',
    });
    const result = registry['selection.style.update']?.isEnabled({
      envelope: createStyleIntentEnvelope({
        targetRef: { renderedNodeId: 'readonly-1' },
      }),
      context: makeActionRoutingContext({
        nodes: [node],
      }),
    });

    expect(result?.ok).toBe(false);
    if (!result || result.ok) return;
    expect(result.error.code).toBe('INTENT_GATING_DENIED');
  });

  it('enables node.delete for mutable node-context-menu targets', () => {
    const result = registry['node.delete']?.isEnabled({
      envelope: {
        surfaceId: 'node-context-menu',
        intentId: 'node.delete',
        selectionRef: {
          currentFile: 'examples/bridge.tsx',
          selectedNodeIds: ['shape-1'],
        },
        targetRef: {
          renderedNodeId: 'shape-1',
        },
        rawPayload: {},
        optimistic: false,
      },
      context: makeActionRoutingContext({
        nodes: [
          makeCanonicalNode({
            id: 'shape-1',
            type: 'shape',
          }),
        ],
      }),
    });

    expect(result).toEqual({ ok: true, value: true });
  });

  it('builds duplicate dispatch through node.create instead of leaving a placeholder', () => {
    const node = makeCanonicalNode({
      id: 'shape-1',
      type: 'shape',
      data: { label: 'Duplicate me', color: '#ffffff' },
    });
    const normalized = registry['node.duplicate']?.normalizePayload({
      envelope: {
        surfaceId: 'node-context-menu',
        intentId: 'node.duplicate',
        selectionRef: {
          currentFile: 'examples/bridge.tsx',
          selectedNodeIds: ['shape-1'],
        },
        targetRef: {
          renderedNodeId: 'shape-1',
        },
        rawPayload: {},
        optimistic: false,
      },
      context: makeActionRoutingContext({
        nodes: [node],
      }),
    });

    expect(normalized?.ok).toBe(true);
    if (!normalized || !normalized.ok) return;
    const plan = registry['node.duplicate']?.buildDispatch({
      envelope: {
        surfaceId: 'node-context-menu',
        intentId: 'node.duplicate',
        selectionRef: {
          currentFile: 'examples/bridge.tsx',
          selectedNodeIds: ['shape-1'],
        },
        targetRef: {
          renderedNodeId: 'shape-1',
        },
        rawPayload: {},
        optimistic: false,
      },
      context: makeActionRoutingContext({
        nodes: [node],
      }),
      normalized: normalized.value,
    });

    expect(plan?.ok).toBe(true);
    if (!plan || !plan.ok) return;
    expect(plan.value.steps[0]).toMatchObject({
      kind: 'canonical-mutation',
      actionId: 'node.create',
    });
  });

  it('routes group select as a runtime-only action for grouped nodes', () => {
    const node = makeCanonicalNode({
      id: 'mind-1',
      type: 'shape',
      groupId: 'map-1',
    });
    const normalized = registry['node.group.select']?.normalizePayload({
      envelope: {
        surfaceId: 'node-context-menu',
        intentId: 'node.group.select',
        selectionRef: {
          currentFile: 'examples/bridge.tsx',
          selectedNodeIds: ['mind-1'],
        },
        targetRef: {
          renderedNodeId: 'mind-1',
        },
        rawPayload: {},
        optimistic: false,
      },
      context: makeActionRoutingContext({
        nodes: [node],
      }),
    });

    expect(normalized?.ok).toBe(true);
    if (!normalized || !normalized.ok) return;
    const plan = registry['node.group.select']?.buildDispatch({
      envelope: {
        surfaceId: 'node-context-menu',
        intentId: 'node.group.select',
        selectionRef: {
          currentFile: 'examples/bridge.tsx',
          selectedNodeIds: ['mind-1'],
        },
        targetRef: {
          renderedNodeId: 'mind-1',
        },
        rawPayload: {},
        optimistic: false,
      },
      context: makeActionRoutingContext({
        nodes: [node],
      }),
      normalized: normalized.value,
    });

    expect(plan?.ok).toBe(true);
    if (!plan || !plan.ok) return;
    expect(plan.value.steps[0]).toEqual({
      kind: 'runtime-only-action',
      actionId: 'select-node-group',
      payload: {
        groupId: 'map-1',
        anchorNodeId: 'mind-1',
      },
    });
  });

  it('allows node.lock.toggle to unlock locked nodes', () => {
    const node = makeCanonicalNode({
      id: 'locked-1',
      type: 'shape',
      data: { locked: true },
    });
    const result = registry['node.lock.toggle']?.isEnabled({
      envelope: {
        surfaceId: 'node-context-menu',
        intentId: 'node.lock.toggle',
        selectionRef: {
          currentFile: 'examples/bridge.tsx',
          selectedNodeIds: ['locked-1'],
        },
        targetRef: {
          renderedNodeId: 'locked-1',
        },
        rawPayload: {},
        optimistic: false,
      },
      context: makeActionRoutingContext({
        nodes: [node],
      }),
    });

    expect(result).toEqual({ ok: true, value: true });
  });
});
