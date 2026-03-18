import type { UIIntentEnvelope } from '@/features/editing/actionRoutingBridge/types';

export function createStyleIntentEnvelope(overrides?: Partial<UIIntentEnvelope>): UIIntentEnvelope {
  return {
    surfaceId: 'selection-floating-menu',
    intentId: 'selection.style.update',
    selectionRef: {
      currentFile: 'examples/bridge.tsx',
      selectedNodeIds: ['shape-1'],
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
      currentFile: 'examples/bridge.tsx',
      selectedNodeIds: ['shape-1'],
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
      currentFile: 'examples/bridge.tsx',
      selectedNodeIds: [],
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
      currentFile: 'examples/bridge.tsx',
      selectedNodeIds: ['mind-1'],
    },
    targetRef: {
      renderedNodeId: 'mind-1',
      filePath: 'examples/bridge.tsx',
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
      currentFile: 'examples/bridge.tsx',
      selectedNodeIds: ['text-1'],
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
