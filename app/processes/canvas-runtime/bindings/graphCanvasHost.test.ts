import { describe, expect, it, mock } from 'bun:test';
import type { Node } from 'reactflow';
import {
  createEntrypointAnchor,
  DEFAULT_ENTRYPOINT_RUNTIME_STATE,
} from '@/features/canvas-ui-entrypoints/ui-runtime-state';
import { makeCanonicalNode } from '@/features/editing/actionRoutingBridge/testUtils';
import React from 'react';

mock.module('@/components/FloatingToolbar', () => ({
  FloatingToolbar: () => React.createElement('div'),
}));

const { canvasRuntime } = await import('@/processes/canvas-runtime/createCanvasRuntime');
const {
  createGraphCanvasSelectionFloatingMenuContribution,
  syncGraphCanvasSelectionFloatingMenuOverlay,
} = await import('./graphCanvasHost');

function makeSelectionNode(input: {
  id: string;
  type: string;
  data?: Record<string, unknown>;
  editMeta?: Record<string, unknown>;
}): Node {
  const base = makeCanonicalNode({
    id: input.id,
    type: input.type,
    data: input.data,
  });

  return {
    ...base,
    data: {
      ...(base.data as Record<string, unknown>),
      ...(input.data ?? {}),
      editMeta: input.editMeta,
    },
  } as Node;
}

describe('graphCanvasHost selection floating menu binding', () => {
  it('builds a hosted selection floating menu contribution from the fixed slot + anchor', () => {
    const node = makeSelectionNode({
      id: 'text-1',
      type: 'text',
      data: {
        label: 'Hello',
        color: '#111827',
        fontSize: 'm',
        fontFamily: 'sans-inter',
      },
      editMeta: {
        family: 'rich-content',
        contentCarrier: 'text-child',
        styleEditableKeys: ['color', 'fontSize', 'fontFamily', 'bold'],
      },
    });

    const contribution = createGraphCanvasSelectionFloatingMenuContribution({
      runtime: canvasRuntime,
      toolbarSlot: canvasRuntime.slots.canvasToolbar,
      selectionFloatingMenuSlot: canvasRuntime.slots.selectionFloatingMenu,
      nodes: [node],
      selectedNodeIds: ['text-1'],
      currentFile: 'examples/bridge.tsx',
      runtimeState: {
        ...DEFAULT_ENTRYPOINT_RUNTIME_STATE,
        anchorsById: {
          'selection-floating-menu:selection-bounds': createEntrypointAnchor({
            anchorId: 'selection-floating-menu:selection-bounds',
            kind: 'selection-bounds',
            nodeIds: ['text-1'],
            screen: { x: 32, y: 48, width: 120, height: 40 },
          }),
        },
      },
      pendingActionRoutingByKey: {},
      washiPresets: [],
      onApplyStylePatch: () => {},
      onCommitContent: () => {},
    });

    expect(contribution).not.toBeNull();
    expect(contribution?.slot).toBe('selection-floating-menu');
    expect(contribution?.anchor).toEqual({
      type: 'selection-bounds',
      x: 32,
      y: 48,
      width: 120,
      height: 40,
    });
  });

  it('opens, replaces, and closes the selection floating overlay without touching unrelated surfaces', () => {
    let openedSurfaceKind: string | null = null;
    let closedSurfaceCount = 0;
    let openedContributionCount = 0;
    let replacedContributionCount = 0;
    let closedOverlayReason: string | null = null;

    const contribution = {
      slot: 'selection-floating-menu',
      priority: 20,
      dismissible: true,
      placement: 'top-center',
      estimatedSize: { width: 320, height: 56 },
      anchor: { type: 'selection-bounds' as const, x: 10, y: 20, width: 80, height: 24 },
      render: () => null,
    };

    const openedId = syncGraphCanvasSelectionFloatingMenuOverlay({
      activeOverlayId: null,
      contribution,
      currentOpenSurfaceKind: null,
      getActiveOverlays: () => [],
      openOverlayHost: () => {
        openedContributionCount += 1;
        return 'selection-floating-menu:1';
      },
      replaceOverlayHost: () => {
        replacedContributionCount += 1;
        return 'selection-floating-menu:2';
      },
      closeOverlayHost: (_instanceId, reason) => {
        closedOverlayReason = reason;
      },
      openEntrypointSurface: (surface) => {
        openedSurfaceKind = surface.kind;
      },
      closeEntrypointSurface: () => {
        closedSurfaceCount += 1;
      },
    });

    expect(openedId).toBe('selection-floating-menu:1');
    expect(openedContributionCount).toBe(1);
    expect(openedSurfaceKind).toBe('selection-floating-menu');

    const replacedId = syncGraphCanvasSelectionFloatingMenuOverlay({
      activeOverlayId: openedId,
      contribution,
      currentOpenSurfaceKind: 'selection-floating-menu',
      getActiveOverlays: () => [{ instanceId: 'selection-floating-menu:1' }],
      openOverlayHost: () => 'selection-floating-menu:open',
      replaceOverlayHost: () => {
        replacedContributionCount += 1;
        return 'selection-floating-menu:2';
      },
      closeOverlayHost: (_instanceId, reason) => {
        closedOverlayReason = reason;
      },
      openEntrypointSurface: (surface) => {
        openedSurfaceKind = surface.kind;
      },
      closeEntrypointSurface: () => {
        closedSurfaceCount += 1;
      },
    });

    expect(replacedId).toBe('selection-floating-menu:2');
    expect(replacedContributionCount).toBe(1);

    const closedId = syncGraphCanvasSelectionFloatingMenuOverlay({
      activeOverlayId: replacedId,
      contribution: null,
      currentOpenSurfaceKind: 'selection-floating-menu',
      getActiveOverlays: () => [{ instanceId: 'selection-floating-menu:2' }],
      openOverlayHost: () => 'selection-floating-menu:open',
      replaceOverlayHost: () => 'selection-floating-menu:replace',
      closeOverlayHost: (_instanceId, reason) => {
        closedOverlayReason = reason;
      },
      openEntrypointSurface: (surface) => {
        openedSurfaceKind = surface.kind;
      },
      closeEntrypointSurface: () => {
        closedSurfaceCount += 1;
      },
    });

    expect(closedId).toBeNull();
    expect(closedOverlayReason).toBe('programmatic-close');
    expect(closedSurfaceCount).toBe(1);
  });
});
