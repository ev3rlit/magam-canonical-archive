import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { deriveCapabilityProfile } from '@/features/editing/capabilityProfile';
import { openOverlay } from '@/features/overlay-host/commands';
import { canDismissOverlay } from '@/features/overlay-host/lifecycle';
import { initialOverlayHostState } from '@/features/overlay-host/state';
import { createSlotContribution, resolveToolbarAnchor, updateSelectionFloatingAnchor } from '@/features/overlay-host/slots';
import type { CanonicalObject } from '@/features/render/canonicalObject';
import { useGraphStore } from '@/store/graph';
import { shouldDismissContextMenuForSelectionChange } from '@/hooks/useContextMenu.helpers';
import { createContextMenuOverlayContribution } from './ContextMenu';
import {
  AUTO_RELAYOUT_MAX_ATTEMPTS,
  getChangedMindMapGroupIds,
  getEligibleAutoRelayoutGroupIds,
  shouldScheduleAutoRelayout,
} from './GraphCanvas.relayout';
import {
  resolveEditHistoryShortcut,
  resolveMindMapDragFeedback,
  resolveMindMapReparentIntent,
  shouldRetainSelectionOnStyleUpdate,
  shouldCommitDragStop,
  shouldHandlePaneCreate,
  shouldSuppressDragStopErrorToast,
} from './GraphCanvas.drag';
import {
  buildSelectionBoundsAnchor,
  shouldHandleRuntimePaneCreate,
} from './GraphCanvas';

function resolveProfileFamily(canonical: CanonicalObject): 'mindmap-member' | 'canvas-absolute' {
  return deriveCapabilityProfile(canonical).allowedCommands.includes('node.reparent')
    ? 'mindmap-member'
    : 'canvas-absolute';
}

const profileMindMapNodeA: CanonicalObject = {
  core: {
    id: 'profile-map-a',
    sourceMeta: {
      sourceId: 'profile-map-a',
      filePath: 'examples/profile.tsx',
      kind: 'mindmap',
    },
    relations: {
      from: 'map.root',
    },
  },
  semanticRole: 'topic',
  alias: 'Node',
  capabilities: {},
};

const profileMindMapNodeB: CanonicalObject = {
  core: {
    id: 'profile-map-b',
    sourceMeta: {
      sourceId: 'profile-map-b',
      filePath: 'examples/profile.tsx',
      kind: 'mindmap',
    },
    relations: {
      from: 'map.root',
    },
  },
  semanticRole: 'topic',
  alias: 'Shape',
  capabilities: {},
};

const profileCanvasNode: CanonicalObject = {
  core: {
    id: 'profile-canvas-text',
    sourceMeta: {
      sourceId: 'profile-canvas-text',
      filePath: 'examples/profile.tsx',
      kind: 'canvas',
    },
  },
  semanticRole: 'topic',
  alias: 'Node',
  capabilities: {
    content: {
      kind: 'text',
      value: 'Hello',
      fontSize: 16,
    },
  },
};

const initialGraphState = useGraphStore.getState();

beforeEach(() => {
  useGraphStore.setState(initialGraphState);
});

afterEach(() => {
  useGraphStore.setState(initialGraphState);
});

describe('GraphCanvas auto relayout policy', () => {
  const baseInput = {
    needsAutoLayout: true,
    hasLayouted: true,
    nodesInitialized: true,
    nodesMeasured: true,
    changedGroupIds: ['map-a'],
    inFlight: false,
    attemptCounts: new Map<string, number>(),
    maxAttempts: AUTO_RELAYOUT_MAX_ATTEMPTS,
    now: 1_000,
    lastRelayoutAts: new Map<string, number>(),
    cooldownMs: 250,
  };

  it('schedules when all guards pass and signature changed', () => {
    expect(shouldScheduleAutoRelayout(baseInput)).toBe(true);
  });

  it('does not schedule when no group signature changed', () => {
    expect(
      shouldScheduleAutoRelayout({
        ...baseInput,
        changedGroupIds: [],
      }),
    ).toBe(false);
  });

  it('does not schedule while layout is in-flight', () => {
    expect(
      shouldScheduleAutoRelayout({
        ...baseInput,
        inFlight: true,
      }),
    ).toBe(false);
  });

  it('does not schedule after max attempts reached', () => {
    expect(
      shouldScheduleAutoRelayout({
        ...baseInput,
        attemptCounts: new Map([['map-a', AUTO_RELAYOUT_MAX_ATTEMPTS]]),
      }),
    ).toBe(false);
  });

  it('does not schedule during cooldown window', () => {
    expect(
      shouldScheduleAutoRelayout({
        ...baseInput,
        now: 1_200,
        lastRelayoutAts: new Map([['map-a', 1_000]]),
      }),
    ).toBe(false);
  });

  it('keeps relayout eligibility isolated per changed group', () => {
    expect(
      shouldScheduleAutoRelayout({
        ...baseInput,
        changedGroupIds: ['map-a', 'map-b'],
        attemptCounts: new Map([['map-a', AUTO_RELAYOUT_MAX_ATTEMPTS]]),
      }),
    ).toBe(true);
  });
});

describe('GraphCanvas auto relayout group helpers', () => {
  it('detects only the groups whose quantized signatures changed', () => {
    expect(
      getChangedMindMapGroupIds(
        new Map([
          ['map-a', 'map-a.root:200x100'],
          ['map-b', 'map-b.root:180x80'],
        ]),
        new Map([
          ['map-a', 'map-a.root:198x100'],
          ['map-b', 'map-b.root:180x80'],
        ]),
      ),
    ).toEqual(['map-a']);
  });

  it('returns only groups that still have retry budget and are outside cooldown', () => {
    expect(
      getEligibleAutoRelayoutGroupIds({
        changedGroupIds: ['map-a', 'map-b', 'map-c'],
        attemptCounts: new Map([
          ['map-a', AUTO_RELAYOUT_MAX_ATTEMPTS],
          ['map-b', 1],
        ]),
        maxAttempts: AUTO_RELAYOUT_MAX_ATTEMPTS,
        now: 1_000,
        lastRelayoutAts: new Map([
          ['map-b', 900],
          ['map-c', 100],
        ]),
        cooldownMs: 250,
      }),
    ).toEqual(['map-c']);
  });
});

describe('GraphCanvas drag-stop commit policy', () => {
  it('drag 시작/종료 좌표가 같으면 커밋하지 않는다', () => {
    expect(
      shouldCommitDragStop({
        origin: { x: 100, y: 200 },
        current: { x: 100, y: 200 },
      }),
    ).toBe(false);
  });

  it('좌표가 변경되면 drag-stop 1회 커밋 대상으로 본다', () => {
    expect(
      shouldCommitDragStop({
        origin: { x: 100, y: 200 },
        current: { x: 130, y: 210 },
      }),
    ).toBe(true);
  });
});

describe('GraphCanvas create mode helpers', () => {
  it('pointer 모드에서만 pane click create를 허용한다', () => {
    expect(shouldHandlePaneCreate({ interactionMode: 'pointer', createMode: 'shape' })).toBe(true);
    expect(shouldHandlePaneCreate({ interactionMode: 'hand', createMode: 'shape' })).toBe(false);
    expect(shouldHandlePaneCreate({ interactionMode: 'pointer', createMode: null })).toBe(false);
  });

  it('pending action이 있으면 pane click create를 차단한다', () => {
    expect(shouldHandleRuntimePaneCreate({
      interactionMode: 'pointer',
      createMode: 'shape',
      hasPendingUiActions: true,
    })).toBe(false);

    expect(shouldHandleRuntimePaneCreate({
      interactionMode: 'pointer',
      createMode: 'shape',
      hasPendingUiActions: false,
    })).toBe(true);
  });
});

describe('GraphCanvas selection anchor helpers', () => {
  it('selection bounds anchor는 node ids와 serializable bounds만 보존한다', () => {
    const anchor = buildSelectionBoundsAnchor({
      selectedNodes: [
        {
          id: 'node-a',
          position: { x: 10, y: 20 },
          width: 100,
          height: 40,
        } as any,
        {
          id: 'node-b',
          position: { x: 140, y: 90 },
          width: 60,
          height: 30,
        } as any,
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    });

    expect(anchor).toMatchObject({
      anchorId: 'selection-floating-menu:selection-bounds',
      kind: 'selection-bounds',
      nodeIds: ['node-a', 'node-b'],
      flow: { x: 10, y: 20 },
      screen: { x: 10, y: 20, width: 190, height: 100 },
      viewport: { x: 0, y: 0, zoom: 1 },
    });
    expect(anchor && 'selection' in anchor).toBe(false);
  });
});

describe('GraphCanvas runtime surface integration', () => {
  it('새 primary surface가 열리면 이전 surface를 대체한다', () => {
    useGraphStore.getState().registerEntrypointAnchor({
      anchorId: 'pane-anchor',
      kind: 'pointer',
      screen: { x: 10, y: 10 },
    });
    useGraphStore.getState().registerEntrypointAnchor({
      anchorId: 'node-anchor',
      kind: 'pointer',
      ownerId: 'node-a',
      nodeIds: ['node-a'],
      screen: { x: 24, y: 32 },
    });

    useGraphStore.getState().openEntrypointSurface({
      kind: 'pane-context-menu',
      anchorId: 'pane-anchor',
      dismissOnSelectionChange: false,
      dismissOnViewportChange: true,
    });
    useGraphStore.getState().openEntrypointSurface({
      kind: 'node-context-menu',
      anchorId: 'node-anchor',
      ownerId: 'node-a',
      dismissOnSelectionChange: true,
      dismissOnViewportChange: true,
    });

    expect(useGraphStore.getState().entrypointRuntime.openSurface).toMatchObject({
      kind: 'node-context-menu',
      anchorId: 'node-anchor',
    });
  });

  it('selection 변화 경로는 selection-dependent surface를 닫고 selection anchor를 정리한다', () => {
    useGraphStore.getState().registerEntrypointAnchor({
      anchorId: 'selection-floating-menu:selection-bounds',
      kind: 'selection-bounds',
      nodeIds: ['node-a'],
      flow: { x: 0, y: 0 },
    });
    useGraphStore.getState().openEntrypointSurface({
      kind: 'selection-floating-menu',
      anchorId: 'selection-floating-menu:selection-bounds',
      dismissOnSelectionChange: true,
      dismissOnViewportChange: false,
    });

    useGraphStore.getState().setSelectedNodes(['node-b']);

    expect(useGraphStore.getState().entrypointRuntime.openSurface).toBeNull();
    expect(
      useGraphStore.getState().entrypointRuntime.anchorsById['selection-floating-menu:selection-bounds'],
    ).toBeUndefined();
  });
});

describe('GraphCanvas history shortcuts', () => {
  it('cmd/ctrl+z 를 undo 로 해석한다', () => {
    expect(resolveEditHistoryShortcut({
      key: 'z',
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
    })).toBe('undo');
  });

  it('cmd/ctrl+shift+z 와 cmd/ctrl+y 를 redo 로 해석한다', () => {
    expect(resolveEditHistoryShortcut({
      key: 'z',
      metaKey: true,
      ctrlKey: false,
      shiftKey: true,
    })).toBe('redo');
    expect(resolveEditHistoryShortcut({
      key: 'y',
      metaKey: false,
      ctrlKey: true,
      shiftKey: false,
    })).toBe('redo');
  });
});

describe('GraphCanvas mindmap reparent intent', () => {
  const baseNode = {
    width: 120,
    height: 60,
  };

  it('같은 group 내 드롭 후보를 부모 변경 intent로 해석한다', () => {
    expect(resolveMindMapReparentIntent({
      draggedNode: {
        ...baseNode,
        id: 'child',
        position: { x: 0, y: 0 },
        data: { groupId: 'map', editMeta: { family: 'mindmap-member' } },
      },
      allNodes: [
        {
          ...baseNode,
          id: 'child',
          position: { x: 0, y: 0 },
          data: { groupId: 'map', editMeta: { family: 'mindmap-member' } },
        },
        {
          ...baseNode,
          id: 'parent',
          position: { x: 200, y: 100 },
          data: { groupId: 'map', editMeta: { family: 'mindmap-member' } },
        },
      ],
      dropPosition: { x: 210, y: 110 },
    })).toEqual({
      kind: 'reparent',
      newParentNodeId: 'parent',
    });
  });

  it('후보가 없으면 rejected intent를 반환한다', () => {
    expect(resolveMindMapReparentIntent({
      draggedNode: {
        ...baseNode,
        id: 'child',
        position: { x: 0, y: 0 },
        data: { groupId: 'map', editMeta: { family: 'mindmap-member' } },
      },
      allNodes: [
        {
          ...baseNode,
          id: 'child',
          position: { x: 0, y: 0 },
          data: { groupId: 'map', editMeta: { family: 'mindmap-member' } },
        },
      ],
      dropPosition: { x: 500, y: 500 },
    })).toEqual({
      kind: 'rejected',
      reason: 'NO_VALID_PARENT',
    });
  });

  it('drag feedback는 reparent 후보가 있으면 ready 상태를 준다', () => {
    expect(resolveMindMapDragFeedback({
      draggedNode: {
        ...baseNode,
        id: 'child',
        position: { x: 0, y: 0 },
        data: { groupId: 'map', editMeta: { family: 'mindmap-member' } },
      },
      allNodes: [
        {
          ...baseNode,
          id: 'child',
          position: { x: 0, y: 0 },
          data: { groupId: 'map', editMeta: { family: 'mindmap-member' } },
        },
        {
          ...baseNode,
          id: 'parent',
          position: { x: 200, y: 100 },
          data: { groupId: 'map', editMeta: { family: 'mindmap-member' } },
        },
      ],
      dropPosition: { x: 210, y: 110 },
    })).toEqual({
      kind: 'reparent-ready',
      newParentNodeId: 'parent',
    });
  });
});

describe('GraphCanvas overlay host wiring helpers', () => {
  it('resolves the toolbar anchor to viewport bottom-center', () => {
    expect(resolveToolbarAnchor({ width: 1440, height: 900 })).toEqual({
      type: 'viewport-fixed',
      x: 720,
      y: 868,
    });
  });

  it('builds toolbar contributions with the shared toolbar slot defaults', () => {
    const contribution = createSlotContribution('toolbar', {
      anchor: resolveToolbarAnchor({ width: 1280, height: 720 }),
      focusPolicy: {
        openTarget: 'none',
        restoreTarget: 'none',
      },
      render: () => null,
    });

    expect(contribution.slot).toBe('toolbar');
    expect(contribution.priority).toBe(10);
    expect(contribution.dismissible).toBe(false);
  });

  it('treats selection drift as a close signal for open context menus', () => {
    expect(shouldDismissContextMenuForSelectionChange({
      instanceId: 'node-context-menu:4',
      context: {
        type: 'node',
        position: { x: 200, y: 120 },
        nodeId: 'shape-1',
        selectedNodeIds: ['shape-1'],
      },
    }, ['shape-2'])).toBe(true);
  });

  it('keeps node and pane menu defaults dismissible for pointer/escape parity', () => {
    expect(canDismissOverlay(createSlotContribution('pane-context-menu', {
      anchor: { type: 'pointer', x: 120, y: 180 },
      render: () => null,
    }), 'outside-pointer')).toBe(true);
    expect(canDismissOverlay(createSlotContribution('node-context-menu', {
      anchor: { type: 'pointer', x: 120, y: 180 },
      render: () => null,
    }), 'escape-key')).toBe(true);
  });

  it('keeps higher-priority node menus above toolbar overlays in host ordering', () => {
    const toolbar = openOverlay({
      state: initialOverlayHostState,
      contribution: createSlotContribution('toolbar', {
        anchor: resolveToolbarAnchor({ width: 1280, height: 720 }),
        focusPolicy: { openTarget: 'none', restoreTarget: 'none' },
        render: () => null,
      }),
      viewport: { width: 1280, height: 720 },
      now: 1,
    });

    const nodeMenu = openOverlay({
      state: toolbar.state,
      contribution: createSlotContribution('node-context-menu', {
        anchor: { type: 'pointer', x: 400, y: 280 },
        render: () => null,
      }),
      viewport: { width: 1280, height: 720 },
      now: 2,
    });

    expect(nodeMenu.state.active.at(-1)?.slot).toBe('node-context-menu');
  });

  it('preserves legacy menu anchor and focus parity when adapting to host contributions', () => {
    const contribution = createContextMenuOverlayContribution({
      slot: 'node-context-menu',
      items: [],
      context: {
        type: 'node',
        position: { x: 320, y: 240 },
        nodeId: 'shape-1',
        selectedNodeIds: ['shape-1'],
      },
    });

    expect(contribution.anchor).toEqual({ type: 'pointer', x: 320, y: 240 });
    expect(contribution.focusPolicy).toEqual({
      openTarget: 'first-actionable',
      restoreTarget: 'trigger',
    });
  });

  it('updates selection floating anchors without changing the owning slot', () => {
    const base = createSlotContribution('selection-floating-menu', {
      anchor: { type: 'selection-bounds', x: 20, y: 40, width: 80, height: 24 },
      render: () => null,
    });
    const moved = updateSelectionFloatingAnchor(base, {
      type: 'selection-bounds',
      x: 100,
      y: 120,
      width: 90,
      height: 32,
    });

    expect(moved.slot).toBe('selection-floating-menu');
    expect(moved.anchor).toEqual({
      type: 'selection-bounds',
      x: 100,
      y: 120,
      width: 90,
      height: 32,
    });
  });
});

describe('GraphCanvas capability-profile based reparent gating', () => {
  it('같은 capability profile을 가진 다른 alias는 mindmap 가족 판정에서 동일한 reparent intent를 낸다', () => {
    const nodeFamily = resolveProfileFamily(profileMindMapNodeA);
    const shapeFamily = resolveProfileFamily(profileMindMapNodeB);

    expect(nodeFamily).toBe('mindmap-member');
    expect(shapeFamily).toBe('mindmap-member');

    expect(resolveMindMapReparentIntent({
      draggedNode: {
        width: 120,
        height: 60,
        id: 'dragged',
        position: { x: 0, y: 0 },
        data: {
          groupId: 'map',
          editMeta: {
            family: nodeFamily,
          },
        },
      },
      allNodes: [
        {
          width: 120,
          height: 60,
          id: 'candidate-parent-a',
          position: { x: 200, y: 100 },
          data: {
            groupId: 'map',
            editMeta: {
              family: shapeFamily,
            },
          },
        },
        {
          width: 120,
          height: 60,
          id: 'dragged',
          position: { x: 0, y: 0 },
          data: {
            groupId: 'map',
            editMeta: {
              family: nodeFamily,
            },
          },
        },
      ],
      dropPosition: { x: 210, y: 110 },
    })).toEqual({
      kind: 'reparent',
      newParentNodeId: 'candidate-parent-a',
    });
  });

  it('capability 프로파일이 mindmap 멤버가 아니면 family gating으로 reparent를 허용하지 않는다', () => {
    const canvasFamily = resolveProfileFamily(profileCanvasNode);
    expect(canvasFamily).toBe('canvas-absolute');

    expect(resolveMindMapReparentIntent({
      draggedNode: {
        width: 120,
        height: 60,
        id: 'canvas-child',
        position: { x: 0, y: 0 },
        data: {
          groupId: 'map',
          editMeta: {
            family: canvasFamily,
          },
        },
      },
      allNodes: [
        {
          width: 120,
          height: 60,
          id: 'canvas-parent',
          position: { x: 200, y: 100 },
          data: {
            groupId: 'map',
            editMeta: {
              family: canvasFamily,
            },
          },
        },
      ],
      dropPosition: { x: 210, y: 110 },
    })).toBeNull();
  });
});

describe('GraphCanvas style update context retention', () => {
  it('retains selection for style-only updates on selected nodes', () => {
    expect(shouldRetainSelectionOnStyleUpdate({
      selectedNodeIds: ['sticky-1', 'shape-2'],
      updatedNodeId: 'sticky-1',
    })).toBe(true);

    expect(shouldRetainSelectionOnStyleUpdate({
      selectedNodeIds: ['shape-2'],
      updatedNodeId: 'sticky-1',
    })).toBe(false);
  });
});

describe('GraphCanvas drag error toast suppression', () => {
  it('NO_VALID_PARENT 는 drag-stop toast를 띄우지 않는다', () => {
    expect(shouldSuppressDragStopErrorToast({
      code: 42201,
      message: 'EDIT_NOT_ALLOWED',
      data: { reason: 'NO_VALID_PARENT' },
    })).toBe(true);
  });

  it('일반 에러는 suppress 하지 않는다', () => {
    expect(shouldSuppressDragStopErrorToast({
      message: 'Request timeout: node.move',
    })).toBe(false);
  });
});

describe('GraphCanvas bridge adoption', () => {
  it('toolbar and context menu create flows stamp surface metadata instead of calling mutations directly', async () => {
    const source = await Bun.file(new URL('./GraphCanvas.tsx', import.meta.url)).text();

    expect(source).toContain("surface: 'pane-context-menu'");
    expect(source).toContain("surface: 'node-context-menu'");
    expect(source).toContain("surface: 'canvas-toolbar'");
    expect(source).not.toContain('updateNode(');
    expect(source).not.toContain('createNode(');
    expect(source).not.toContain('reparentNode(');
  });
});
