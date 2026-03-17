import { describe, expect, it } from 'bun:test';
import { deriveCapabilityProfile } from '@/features/editing/capabilityProfile';
import type { CanonicalObject } from '@/features/render/canonicalObject';
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
  shouldCommitDragStop,
  shouldHandlePaneCreate,
  shouldSuppressDragStopErrorToast,
} from './GraphCanvas.drag';

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
