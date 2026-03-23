import { describe, expect, it } from 'bun:test';
import { createGraphCanvasKeyboardHost } from './keyboardHost';

function createHostInput(overrides: Partial<Parameters<typeof createGraphCanvasKeyboardHost>[0]> = {}) {
  return {
    clipboardHistoryRef: { current: { past: [], future: [] } },
    graphClipboardRef: { current: null },
    focusNextNodeByType: () => null,
    selectNodesByType: () => [],
    selectAllNodeIds: () => ['shape-1', 'shape-2'],
    deleteSelectedNodes: async () => ['shape-1'],
    duplicateSelectedNodes: async () => ['shape-2'],
    groupSelection: async () => ['shape-1', 'shape-2'],
    getGraphState: () => ({
      nodes: [],
      edges: [],
      selectedNodeIds: [],
    }),
    setGraphState: () => undefined,
    getActiveElement: () => null,
    isEditorFocusActive: () => false,
    ungroupSelection: async () => ['shape-1', 'shape-2'],
    zoomIn: () => 1.2,
    zoomOut: () => 0.8,
    ...overrides,
  };
}

function createKeyboardEvent(input: {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
}) {
  return {
    ...input,
    preventDefaultCalled: false,
    preventDefault() {
      this.preventDefaultCalled = true;
    },
  } as KeyboardEvent & { preventDefaultCalled: boolean };
}

describe('createGraphCanvasKeyboardHost', () => {
  it('skips non-global commands while editor focus is active', async () => {
    const host = createGraphCanvasKeyboardHost(createHostInput({
      isEditorFocusActive: () => true,
    }));

    const event = createKeyboardEvent({ key: 'd', metaKey: true });
    const result = await host.handleKeyDown(event);

    expect(result).toMatchObject({
      commandId: 'selection.duplicate',
      outcome: 'skipped',
      handled: true,
      preventDefault: false,
    });
    expect(event.preventDefaultCalled).toBe(false);
  });

  it('allows global zoom commands to pass through while editor focus is active', async () => {
    const host = createGraphCanvasKeyboardHost(createHostInput({
      isEditorFocusActive: () => true,
    }));

    const event = createKeyboardEvent({ key: '=', metaKey: true });
    const result = await host.handleKeyDown(event);

    expect(result).toMatchObject({
      commandId: 'viewport.zoom-in',
      outcome: 'executed',
      handled: true,
      preventDefault: true,
    });
    expect(event.preventDefaultCalled).toBe(true);
  });
});
