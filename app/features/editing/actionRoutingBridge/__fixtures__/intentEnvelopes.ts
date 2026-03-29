import type { UIIntentEnvelope } from '@/features/editing/actionRoutingBridge/types';

export function createStyleIntentEnvelope(overrides?: Partial<UIIntentEnvelope>): UIIntentEnvelope {
  return {
    surfaceId: 'selection-floating-menu',
    intentId: 'selection.style.update',
    selectionRef: {
      selectedNodeIds: ['shape-1'],
      currentCanvasId: 'canvas-bridge',
    },
    targetRef: {
      renderedNodeId: 'shape-1',
    },
    rawPayload: {
      patch: {
        color: '#ff0000',
      },
    },
    optimistic: true,
    ...overrides,
  };
}

export function createRenameIntentEnvelope(overrides?: Partial<UIIntentEnvelope>): UIIntentEnvelope {
  return {
    surfaceId: 'node-context-menu',
    intentId: 'node.rename',
    selectionRef: {
      selectedNodeIds: ['shape-1'],
      currentCanvasId: 'canvas-bridge',
    },
    targetRef: {
      renderedNodeId: 'shape-1',
    },
    rawPayload: {
      nextId: 'shape-1-renamed',
    },
    optimistic: false,
    ...overrides,
  };
}

export function createPaneCreateIntentEnvelope(overrides?: Partial<UIIntentEnvelope>): UIIntentEnvelope {
  return {
    surfaceId: 'pane-context-menu',
    intentId: 'node.create',
    selectionRef: {
      selectedNodeIds: [],
      currentCanvasId: 'canvas-bridge',
    },
    rawPayload: {
      nodeType: 'shape',
      placement: {
        mode: 'canvas-absolute',
        x: 120,
        y: 160,
      },
    },
    optimistic: false,
    ...overrides,
  };
}

export function createNodeChildIntentEnvelope(overrides?: Partial<UIIntentEnvelope>): UIIntentEnvelope {
  return {
    surfaceId: 'node-context-menu',
    intentId: 'node.create',
    selectionRef: {
      selectedNodeIds: ['mind-1'],
      currentCanvasId: 'canvas-bridge',
    },
    targetRef: {
      renderedNodeId: 'mind-1',
    },
    rawPayload: {
      nodeType: 'shape',
      placement: {
        mode: 'mindmap-child',
        parentId: 'mind-1',
      },
    },
    optimistic: false,
    ...overrides,
  };
}

export function createContentIntentEnvelope(overrides?: Partial<UIIntentEnvelope>): UIIntentEnvelope {
  return {
    surfaceId: 'selection-floating-menu',
    intentId: 'selection.content.update',
    selectionRef: {
      selectedNodeIds: ['text-1'],
      currentCanvasId: 'canvas-bridge',
    },
    targetRef: {
      renderedNodeId: 'text-1',
    },
    rawPayload: {
      content: 'Updated content',
    },
    optimistic: true,
    ...overrides,
  };
}

export function createSelectionStructuralIntentEnvelope(input: {
  intentId: 'selection.group' | 'selection.ungroup' | 'selection.z-order.bring-to-front' | 'selection.z-order.send-to-back';
  selectedNodeIds: string[];
  renderedNodeId?: string;
  overrides?: Partial<UIIntentEnvelope>;
}): UIIntentEnvelope {
  return {
    surfaceId: 'node-context-menu',
    intentId: input.intentId,
    selectionRef: {
      selectedNodeIds: input.selectedNodeIds,
      currentCanvasId: 'canvas-bridge',
    },
    ...(input.renderedNodeId ? {
      targetRef: {
        renderedNodeId: input.renderedNodeId,
      },
    } : {}),
    rawPayload: {},
    optimistic: false,
    ...(input.overrides ?? {}),
  };
}
