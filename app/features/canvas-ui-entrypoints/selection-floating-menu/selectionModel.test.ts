import { describe, expect, it } from 'bun:test';
import type { Node } from 'reactflow';
import { DEFAULT_ENTRYPOINT_RUNTIME_STATE } from '@/features/canvas-ui-entrypoints/ui-runtime-state';
import { makeCanonicalNode } from '@/features/editing/actionRoutingBridge/testUtils';
import { resolveSelectionFloatingMenuModel } from './selectionModel';

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

describe('selection floating menu selectionModel', () => {
  it('hides the menu for heterogeneous multi-selection', () => {
    const nodes = [
      makeSelectionNode({
        id: 'text-1',
        type: 'text',
        data: {
          label: 'Title',
          color: '#111827',
          fontSize: 'm',
          fontFamily: 'sans-inter',
          bold: true,
        },
        editMeta: {
          family: 'rich-content',
          contentCarrier: 'text-child',
          styleEditableKeys: ['color', 'fontSize', 'fontFamily', 'bold'],
        },
      }),
      makeSelectionNode({
        id: 'shape-1',
        type: 'shape',
        data: {
          label: 'Shape',
          fill: '#ffffff',
          labelFontSize: 16,
          labelBold: false,
        },
        editMeta: {
          family: 'canvas-absolute',
          contentCarrier: 'label-prop',
          styleEditableKeys: ['fill', 'labelFontSize', 'labelBold', 'fontFamily'],
        },
      }),
    ];

    const model = resolveSelectionFloatingMenuModel({
      nodes,
      selectedNodeIds: ['text-1', 'shape-1'],
      currentFile: 'examples/bridge.tsx',
      runtimeState: DEFAULT_ENTRYPOINT_RUNTIME_STATE,
    });

    expect(model.visible).toBe(false);
    expect(model.hiddenReason).toBe('HETEROGENEOUS_SELECTION');
  });

  it('derives direct-edit controls for a single text selection', () => {
    const node = makeSelectionNode({
      id: 'text-1',
      type: 'text',
      data: {
        label: 'Hello',
        color: '#2563eb',
        fontSize: 'l',
        fontFamily: 'hand-gaegu',
        bold: true,
      },
      editMeta: {
        family: 'rich-content',
        contentCarrier: 'text-child',
        styleEditableKeys: ['color', 'fontSize', 'fontFamily', 'bold'],
      },
    });

    const model = resolveSelectionFloatingMenuModel({
      nodes: [node],
      selectedNodeIds: ['text-1'],
      currentFile: 'examples/bridge.tsx',
      runtimeState: DEFAULT_ENTRYPOINT_RUNTIME_STATE,
    });

    expect(model.visible).toBe(true);
    expect(model.summary.commonValues.fontFamily).toBe('hand-gaegu');
    expect(model.summary.commonValues.fontSize).toBe('l');
    expect(model.summary.commonValues.bold).toBe(true);
    expect(model.summary.commonValues.color).toBe('#2563eb');
    expect(model.primaryControls.map((control) => control.inventory.controlId)).toEqual([
      'object-type',
      'font-family',
      'font-size',
      'bold',
      'color',
      'more',
    ]);
    expect(model.overflowControls.map((control) => control.inventory.controlId)).toEqual(['content']);
  });

  it('shows washi preset overflow and disables controls while selection actions are pending', () => {
    const washiA = makeSelectionNode({
      id: 'washi-1',
      type: 'washi-tape',
      data: {
        label: 'Tape',
        pattern: { type: 'preset', id: 'paper-grid' },
      },
      editMeta: {
        family: 'canvas-absolute',
        styleEditableKeys: ['pattern', 'opacity', 'texture'],
      },
    });
    const washiB = makeSelectionNode({
      id: 'washi-2',
      type: 'washi-tape',
      data: {
        label: 'Tape',
        pattern: { type: 'preset', id: 'paper-grid' },
      },
      editMeta: {
        family: 'canvas-absolute',
        styleEditableKeys: ['pattern', 'opacity', 'texture'],
      },
    });

    const model = resolveSelectionFloatingMenuModel({
      nodes: [washiA, washiB],
      selectedNodeIds: ['washi-1', 'washi-2'],
      currentFile: 'examples/bridge.tsx',
      runtimeState: {
        ...DEFAULT_ENTRYPOINT_RUNTIME_STATE,
        pendingByRequestId: {
          'request-1': {
            requestId: 'request-1',
            actionType: 'node.style.update',
            targetIds: ['washi-1'],
            status: 'pending',
            startedAt: 1,
          },
        },
      },
    });

    expect(model.visible).toBe(true);
    expect(model.summary.activePresetId).toBe('paper-grid');
    expect(model.primaryControls.map((control) => control.inventory.controlId)).toEqual([
      'object-type',
      'more',
    ]);
    expect(model.overflowControls.map((control) => control.inventory.controlId)).toEqual(['washi-preset']);
    expect(model.overflowControls[0]?.enabled).toBe(false);
    expect(model.overflowControls[0]?.disabledReason).toBe('PENDING_ACTION');
  });
});
