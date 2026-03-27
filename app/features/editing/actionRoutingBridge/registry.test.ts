import { describe, expect, it } from 'bun:test';
import { createActionRoutingRegistry } from '@/features/editing/actionRoutingBridge/registry';
import {
  createContentIntentEnvelope,
  createNodeChildIntentEnvelope,
  createPaneCreateIntentEnvelope,
  createSelectionStructuralIntentEnvelope,
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

  it('routes shape root create through the canonical canvas.node.create action', () => {
    const normalized = registry['node.create']?.normalizePayload({
      envelope: createPaneCreateIntentEnvelope(),
      context: makeActionRoutingContext({
        currentCanvasId: 'doc-1',
        canvasVersions: { 'doc-1': 'rev-1' },
      }),
    });

    expect(normalized?.ok).toBe(true);
    if (!normalized || !normalized.ok) return;
    const plan = registry['node.create']?.buildDispatch({
      envelope: createPaneCreateIntentEnvelope(),
      context: makeActionRoutingContext({
        currentCanvasId: 'doc-1',
        canvasVersions: { 'doc-1': 'rev-1' },
      }),
      normalized: normalized.value,
    });

    expect(plan?.ok).toBe(true);
    if (!plan || !plan.ok) return;
    expect(plan.value.steps[0]).toMatchObject({
      kind: 'runtime-mutation',
      payload: {
        canvasId: 'doc-1',
      },
    });
  });

  it('routes mindmap child create through the canonical canvas.node.create action', () => {
    const node = makeCanonicalNode({
      id: 'mind-1',
      type: 'shape',
      data: {
        sourceMeta: {
          sourceId: 'mind-1',
          filePath: 'examples/bridge.tsx',
          kind: 'mindmap',
        },
      },
    });
    const normalized = registry['node.create']?.normalizePayload({
      envelope: createNodeChildIntentEnvelope(),
      context: makeActionRoutingContext({
        currentCanvasId: 'doc-1',
        canvasVersions: { 'doc-1': 'rev-1' },
        nodes: [node],
      }),
    });

    expect(normalized?.ok).toBe(true);
    if (!normalized || !normalized.ok) return;
    const plan = registry['node.create']?.buildDispatch({
      envelope: createNodeChildIntentEnvelope(),
      context: makeActionRoutingContext({
        currentCanvasId: 'doc-1',
        canvasVersions: { 'doc-1': 'rev-1' },
        nodes: [node],
      }),
      normalized: normalized.value,
    });

    expect(plan?.ok).toBe(true);
    if (!plan || !plan.ok) return;
    expect(plan.value.steps[0]).toMatchObject({
      kind: 'runtime-mutation',
    });
  });

  it('routes mindmap root create through the canonical canvas.node.create action with a scoped rendered id', () => {
    const normalized = registry['node.create']?.normalizePayload({
      envelope: createPaneCreateIntentEnvelope({
        rawPayload: {
          nodeType: 'rectangle',
          placement: {
            mode: 'mindmap-root',
            x: 64,
            y: 96,
          },
        },
      }),
      context: makeActionRoutingContext({
        currentCanvasId: 'doc-1',
        canvasVersions: { 'doc-1': 'rev-1' },
      }),
    });

    expect(normalized?.ok).toBe(true);
    if (!normalized || !normalized.ok) return;
    expect(normalized.value.placement).toMatchObject({
      mode: 'mindmap-root',
      x: 64,
      y: 96,
      mindmapId: expect.stringMatching(/^mindmap-/),
    });
    expect(normalized.value.renderedId).toMatch(/^mindmap-.*\.rectangle-/);

    const plan = registry['node.create']?.buildDispatch({
      envelope: createPaneCreateIntentEnvelope({
        rawPayload: {
          nodeType: 'rectangle',
          placement: {
            mode: 'mindmap-root',
            x: 64,
            y: 96,
          },
        },
      }),
      context: makeActionRoutingContext({
        currentCanvasId: 'doc-1',
        canvasVersions: { 'doc-1': 'rev-1' },
      }),
      normalized: normalized.value,
    });

    expect(plan?.ok).toBe(true);
    if (!plan || !plan.ok) return;
    expect(plan.value.steps[0]?.kind).toBe('runtime-mutation');
    const step = plan.value.steps[0];
    if (!step || step.kind !== 'runtime-mutation') return;
    expect(step.payload.canvasId).toBe('doc-1');
    const createCommand = step.payload.commands[0];
    expect(createCommand?.name).toBe('canvas.node.create');
    if (!createCommand || createCommand.name !== 'canvas.node.create') return;
    expect(createCommand.placement.mode).toBe('mindmap-root');
    expect(createCommand.placement.mindmapId).toBeTruthy();
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
          selectedNodeIds: ['shape-1'],
          currentCanvasId: 'canvas-bridge',
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
          selectedNodeIds: ['shape-1'],
          currentCanvasId: 'canvas-bridge',
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
          selectedNodeIds: ['shape-1'],
          currentCanvasId: 'canvas-bridge',
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
      kind: 'runtime-mutation',
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
          selectedNodeIds: ['mind-1'],
          currentCanvasId: 'canvas-bridge',
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
          selectedNodeIds: ['mind-1'],
          currentCanvasId: 'canvas-bridge',
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

  it('builds selection.group as structural group-membership updates for the selected canvas nodes', () => {
    const first = makeCanonicalNode({
      id: 'shape-a',
      type: 'shape',
      sourceKind: 'canvas',
    });
    const second = makeCanonicalNode({
      id: 'shape-b',
      type: 'shape',
      sourceKind: 'canvas',
    });
    const envelope = createSelectionStructuralIntentEnvelope({
      intentId: 'selection.group',
      selectedNodeIds: ['shape-a', 'shape-b'],
      renderedNodeId: 'shape-a',
    });

    const normalized = registry['selection.group']?.normalizePayload({
      envelope,
      context: makeActionRoutingContext({
        nodes: [first, second],
      }),
    });

    expect(normalized?.ok).toBe(true);
    if (!normalized || !normalized.ok) return;
    expect(normalized.value.nextGroupId).toBe('group-1');

    const plan = registry['selection.group']?.buildDispatch({
      envelope,
      context: makeActionRoutingContext({
        nodes: [first, second],
      }),
      normalized: normalized.value,
    });

    expect(plan?.ok).toBe(true);
    if (!plan || !plan.ok) return;
    expect(plan.value.steps[0]).toMatchObject({
      kind: 'runtime-only-action',
      actionId: 'apply-node-data-patch',
      payload: {
        nodeId: 'shape-a',
        patch: {
          groupId: 'group-1',
        },
      },
    });
    expect(plan.value.steps[1]).toMatchObject({
      kind: 'compatibility-mutation',
      actionId: 'node.group-membership.update',
      payload: {
        nodeId: 'shape-a',
        groupId: 'group-1',
      },
    });
    expect(plan.value.steps.at(-1)).toMatchObject({
      kind: 'runtime-only-action',
      actionId: 'select-node-group',
      payload: {
        groupId: 'group-1',
        anchorNodeId: 'shape-a',
      },
    });
  });

  it('builds selection.ungroup from grouped canvas nodes without treating them as mindmap members', () => {
    const first = makeCanonicalNode({
      id: 'shape-a',
      type: 'shape',
      groupId: 'canvas-group',
      sourceKind: 'canvas',
    });
    const second = makeCanonicalNode({
      id: 'shape-b',
      type: 'shape',
      groupId: 'canvas-group',
      sourceKind: 'canvas',
    });
    const envelope = createSelectionStructuralIntentEnvelope({
      intentId: 'selection.ungroup',
      selectedNodeIds: ['shape-a', 'shape-b'],
      renderedNodeId: 'shape-a',
    });

    const normalized = registry['selection.ungroup']?.normalizePayload({
      envelope,
      context: makeActionRoutingContext({
        nodes: [first, second],
      }),
    });

    expect(normalized?.ok).toBe(true);
    if (!normalized || !normalized.ok) return;

    const plan = registry['selection.ungroup']?.buildDispatch({
      envelope,
      context: makeActionRoutingContext({
        nodes: [first, second],
      }),
      normalized: normalized.value,
    });

    expect(plan?.ok).toBe(true);
    if (!plan || !plan.ok) return;
    expect(plan.value.steps[1]).toMatchObject({
      kind: 'compatibility-mutation',
      actionId: 'node.group-membership.update',
      payload: {
        nodeId: 'shape-a',
        groupId: null,
      },
    });
  });

  it('builds selection z-order updates against only the selected set', () => {
    const backNode = makeCanonicalNode({
      id: 'shape-back',
      type: 'shape',
      sourceKind: 'canvas',
      data: { zIndex: 5 },
    });
    const first = makeCanonicalNode({
      id: 'shape-a',
      type: 'shape',
      sourceKind: 'canvas',
      data: { zIndex: 10 },
    });
    const second = makeCanonicalNode({
      id: 'shape-b',
      type: 'shape',
      sourceKind: 'canvas',
      data: { zIndex: 11 },
    });
    const envelope = createSelectionStructuralIntentEnvelope({
      intentId: 'selection.z-order.bring-to-front',
      selectedNodeIds: ['shape-a', 'shape-b'],
      renderedNodeId: 'shape-a',
    });

    const normalized = registry['selection.z-order.bring-to-front']?.normalizePayload({
      envelope,
      context: makeActionRoutingContext({
        nodes: [backNode, first, second],
      }),
    });

    expect(normalized?.ok).toBe(true);
    if (!normalized || !normalized.ok) return;
    const normalizedTargets = normalized.value.targets as Array<{ nextZIndex: number }>;
    expect(normalizedTargets.map((target) => target.nextZIndex)).toEqual([12, 13]);
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
          selectedNodeIds: ['locked-1'],
          currentCanvasId: 'canvas-bridge',
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
