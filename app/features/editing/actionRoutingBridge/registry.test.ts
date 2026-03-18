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
});
