import { describe, expect, it } from 'bun:test';
import type { Node } from 'reactflow';
import { mapDragToRelativeAttachmentUpdate } from '@/utils/relativeAttachmentMapping';
import { deriveCapabilityProfile } from '@/features/editing/capabilityProfile';
import type { CanonicalObject } from '@/features/render/canonicalObject';
import {
  canCommitTextEdit,
  canRunNodeCommand,
  getAllowedNodeStylePatch,
  extractWorkspaceStyleInput,
  flattenWorkspaceStyleDiagnostics,
  mapEditRpcErrorToToast,
  resolveNodeEditContext,
  resolveNodeEditTarget,
} from './workspaceEditUtils';

function makeNode(input: Partial<Node> & { id: string; type: string; data?: Record<string, unknown> }): Node {
  return {
    id: input.id,
    type: input.type,
    position: input.position ?? { x: 0, y: 0 },
    data: input.data ?? {},
  } as Node;
}

function makeCapabilityProfileNodeFromCanonical(
  input: {
    id: string;
    type: string;
    canonical: CanonicalObject;
  },
): Node {
  const profile = deriveCapabilityProfile(input.canonical);
  return {
    id: input.id,
    type: input.type,
    position: { x: 0, y: 0 },
    data: {
      sourceMeta: {
        sourceId: input.id,
      },
      canonicalObject: input.canonical,
      editMeta: {
        family: profile.contentCarrier ? 'rich-content' : 'canvas-absolute',
        contentCarrier: profile.contentCarrier,
        styleEditableKeys: profile.allowedUpdateKeys,
        createMode: profile.allowedCommands.includes('node.reparent') ? 'mindmap-child' : 'canvas',
      },
    },
  };
}

const canonicalProfileNode: CanonicalObject = {
  core: {
    id: 'profile-node-1',
    sourceMeta: {
      sourceId: 'profile-node-1',
      filePath: 'examples/profile.tsx',
    },
  },
  semanticRole: 'topic',
  alias: 'Node',
  capabilities: {
    frame: {
      shape: 'rounded',
      fill: '#fff',
    },
    content: {
      kind: 'text',
      value: 'Hello',
      fontSize: 'm',
    },
  },
};

const canonicalProfileShape: CanonicalObject = {
  ...canonicalProfileNode,
  core: {
    id: 'profile-shape-1',
    sourceMeta: {
      sourceId: 'profile-shape-1',
      filePath: 'examples/profile.tsx',
    },
  },
  alias: 'Shape',
};

describe('WorkspaceClient text edit isolation', () => {
  it('선택된 activeTextEditNodeId만 커밋 가능하다', () => {
    expect(canCommitTextEdit({
      activeNodeId: 'md-1',
      requestNodeId: 'md-1',
      selectedNodeIds: ['md-1', 'other'],
    })).toBe(true);

    expect(canCommitTextEdit({
      activeNodeId: 'md-1',
      requestNodeId: 'md-2',
      selectedNodeIds: ['md-1', 'md-2'],
    })).toBe(false);

    expect(canCommitTextEdit({
      activeNodeId: 'md-1',
      requestNodeId: 'md-1',
      selectedNodeIds: ['md-2'],
    })).toBe(false);
  });

  it('외부 파일 sourceMeta가 있으면 해당 파일과 sourceId를 편집 대상으로 선택한다', () => {
    const target = resolveNodeEditTarget(makeNode({
      id: 'map.root',
      type: 'shape',
      data: {
        sourceMeta: {
          sourceId: 'root',
          filePath: 'components/auth-branch.tsx',
        },
      },
    }), 'examples/main.tsx');

    expect(target).toEqual({
      nodeId: 'root',
      filePath: 'components/auth-branch.tsx',
    });
  });

  it('sourceMeta가 없으면 현재 파일과 렌더 노드 id를 편집 대상으로 사용한다', () => {
    const target = resolveNodeEditTarget(makeNode({
      id: 'shape-1',
      type: 'shape',
    }), 'examples/main.tsx');

    expect(target).toEqual({
      nodeId: 'shape-1',
      filePath: 'examples/main.tsx',
    });
  });

  it('frameScope만 있어도 nested frame local id를 편집 대상으로 유도한다', () => {
    const target = resolveNodeEditTarget(makeNode({
      id: 'auth.cache.worker',
      type: 'shape',
      data: {
        sourceMeta: {
          frameScope: 'auth.cache',
          filePath: 'components/service-frame.tsx',
        },
      },
    }), 'examples/main.tsx');

    expect(target).toEqual({
      nodeId: 'worker',
      filePath: 'components/service-frame.tsx',
    });
  });
});

describe('WorkspaceClient attach rejection guidance', () => {
  it('missing attach target이면 사용자 안내 메시지를 반환한다', () => {
    const washi = makeNode({
      id: 'washi-1',
      type: 'washi-tape',
      data: {
        at: { type: 'attach', target: 'missing', placement: 'top', offset: 2 },
      },
    });

    const mapping = mapDragToRelativeAttachmentUpdate({
      draggedNode: washi,
      allNodes: [washi],
      dropPosition: { x: 0, y: 0 },
    });

    expect(mapping?.kind).toBe('invalid');
    if (!mapping || mapping.kind !== 'invalid') return;
    expect(
      mapEditRpcErrorToToast({
        message: 'NODE_NOT_FOUND',
        data: { reason: mapping.reason },
      }),
    ).toContain('attach target');
  });

  it('ID 충돌 에러는 중복 해결 메시지로 매핑된다', () => {
    expect(
      mapEditRpcErrorToToast({
        code: 40903,
        message: 'ID_COLLISION',
      }),
    ).toContain('ID 중복');
  });

  it('EDIT_NOT_ALLOWED 에러는 read-only 안내 메시지로 매핑된다', () => {
    expect(
      mapEditRpcErrorToToast({
        code: 42201,
        message: 'EDIT_NOT_ALLOWED',
      }),
    ).toContain('웹 편집 범위');
  });

  it('MindMap reparent 후보가 없으면 구조 편집 안내 메시지를 반환한다', () => {
    expect(
      mapEditRpcErrorToToast({
        code: 42201,
        message: 'EDIT_NOT_ALLOWED',
        data: { reason: 'NO_VALID_PARENT' },
      }),
    ).toContain('부모를 바꿔야');
  });
});

describe('WorkspaceClient editability helpers', () => {
  const editableNode = makeNode({
    id: 'sticker-1',
    type: 'sticker',
    data: {
      sourceMeta: { sourceId: 'sticker-1', filePath: 'examples/demo.tsx' },
      editMeta: {
        family: 'canvas-absolute',
        styleEditableKeys: ['outlineColor', 'outlineWidth', 'shadow'],
        createMode: 'canvas',
      },
    },
  });

  it('resolveNodeEditContext returns target + editMeta together', () => {
    expect(resolveNodeEditContext(editableNode, 'examples/fallback.tsx')).toEqual({
      target: {
        nodeId: 'sticker-1',
        filePath: 'examples/demo.tsx',
      },
      editMeta: {
        family: 'canvas-absolute',
        styleEditableKeys: ['outlineColor', 'outlineWidth', 'shadow'],
        createMode: 'canvas',
      },
      readOnlyReason: undefined,
    });
  });

  it('canRunNodeCommand respects editMeta gating', () => {
    expect(canRunNodeCommand(editableNode, 'node.style.update')).toBe(true);
    expect(canRunNodeCommand(editableNode, 'node.reparent')).toBe(false);
  });

  it('getAllowedNodeStylePatch filters non-whitelisted keys', () => {
    expect(getAllowedNodeStylePatch(editableNode, {
      outlineColor: '#fff',
      shadow: 'lg',
      anchor: 'shape-1',
    })).toEqual({
      patch: {
        outlineColor: '#fff',
        shadow: 'lg',
      },
      rejectedKeys: ['anchor'],
    });
  });

  it('extractWorkspaceStyleInput derives className input + revision from sourceMeta/current file', () => {
    expect(extractWorkspaceStyleInput(makeNode({
      id: 'shape-2',
      type: 'shape',
      data: {
        className: 'w-32 shadow-md',
        sourceMeta: {
          filePath: 'examples/feature.tsx',
        },
      },
    }), {
      currentFile: 'examples/fallback.tsx',
      sourceVersions: {
        'examples/feature.tsx': 'rev-feature',
      },
      timestamp: 123,
    })).toEqual({
      objectId: 'shape-2',
      className: 'w-32 shadow-md',
      sourceRevision: 'rev-feature',
      timestamp: 123,
    });
  });

  it('extracts stable workspace style input across rerender-like repeated reads', () => {
    const node = makeNode({
      id: 'sticky-runtime',
      type: 'sticky',
      data: {
        className: 'w-32 bg-amber-100 shadow-lg',
        sourceMeta: {
          filePath: 'examples/sticky.tsx',
        },
      },
    });

    const first = extractWorkspaceStyleInput(node, {
      currentFile: 'examples/fallback.tsx',
      sourceVersions: {
        'examples/sticky.tsx': 'rev-1',
      },
      timestamp: 100,
    });
    const second = extractWorkspaceStyleInput(node, {
      currentFile: 'examples/fallback.tsx',
      sourceVersions: {
        'examples/sticky.tsx': 'rev-1',
      },
      timestamp: 100,
    });

    expect(first).toEqual(second);
  });

  it('flattens diagnostics for overlay rendering and clears when empty', () => {
    expect(flattenWorkspaceStyleDiagnostics({
      a: [{ objectId: 'sticky-1', code: 'UNSUPPORTED_TOKEN', message: 'bad token' }],
      b: [{ objectId: 'sticker-1', code: 'OUT_OF_SCOPE_OBJECT', message: 'out of scope' }],
    }, 1)).toEqual(['[sticky-1] bad token']);

    expect(flattenWorkspaceStyleDiagnostics({})).toEqual([]);
  });
});

describe('WorkspaceClient capability-profile editability parity', () => {
  it('동일 canonical capability 집합은 Node/Shape alias에서 동일한 editability 명령 집합을 만든다', () => {
    const nodeProfile = deriveCapabilityProfile(canonicalProfileNode);
    const shapeProfile = deriveCapabilityProfile(canonicalProfileShape);

    expect(nodeProfile.allowedCommands).toEqual(shapeProfile.allowedCommands);
    expect(nodeProfile.allowedUpdateKeys).toEqual(shapeProfile.allowedUpdateKeys);
  });

  it('동일 capability 프로파일 기반 editMeta는 alias 타입과 무관하게 UI 커맨드 게이팅을 일치시킨다', () => {
    const nodeFromCanonicalAlias = makeCapabilityProfileNodeFromCanonical({
      id: 'profile-node-1',
      type: 'shape',
      canonical: canonicalProfileNode,
    });
    const nodeFromShapeAlias = makeCapabilityProfileNodeFromCanonical({
      id: 'profile-shape-1',
      type: 'text',
      canonical: canonicalProfileShape,
    });

    expect(
      canRunNodeCommand(nodeFromCanonicalAlias, 'node.style.update'),
    ).toBe(canRunNodeCommand(nodeFromShapeAlias, 'node.style.update'));
    expect(
      canRunNodeCommand(nodeFromCanonicalAlias, 'node.content.update'),
    ).toBe(canRunNodeCommand(nodeFromShapeAlias, 'node.content.update'));
    expect(
      canRunNodeCommand(nodeFromCanonicalAlias, 'node.move.absolute'),
    ).toBe(canRunNodeCommand(nodeFromShapeAlias, 'node.move.absolute'));
    expect(
      canRunNodeCommand(nodeFromCanonicalAlias, 'node.rename'),
    ).toBe(canRunNodeCommand(nodeFromShapeAlias, 'node.rename'));

    expect(
      getAllowedNodeStylePatch(nodeFromCanonicalAlias, {
        outlineColor: '#fff',
        color: '#000',
        value: 'updated',
        unknown: 'x',
      }),
    ).toEqual(
      getAllowedNodeStylePatch(nodeFromShapeAlias, {
        outlineColor: '#fff',
        color: '#000',
        value: 'updated',
        unknown: 'x',
      }),
    );
  });

  it('canvas sourceMeta를 가진 linked node는 from 관계가 있어도 canvas 편집 규칙을 유지한다', () => {
    const linkedCanvasNode = makeNode({
      id: 'linked-canvas-node',
      type: 'shape',
      data: {
        sourceMeta: {
          sourceId: 'linked-canvas-node',
          filePath: 'examples/profile.tsx',
        },
        canonicalObject: {
          core: {
            id: 'linked-canvas-node',
            relations: {
              from: 'root-node',
            },
            sourceMeta: {
              sourceId: 'linked-canvas-node',
              filePath: 'examples/profile.tsx',
              kind: 'canvas',
            },
          },
          semanticRole: 'topic',
          alias: 'Node',
          capabilities: {
            content: {
              kind: 'text',
              value: 'Linked child',
            },
          },
        } satisfies CanonicalObject,
      },
    });

    expect(resolveNodeEditContext(linkedCanvasNode, 'examples/profile.tsx').editMeta).toMatchObject({
      family: 'rich-content',
      contentCarrier: 'text-child',
      createMode: 'canvas',
    });
    expect(canRunNodeCommand(linkedCanvasNode, 'node.move.absolute')).toBe(true);
    expect(canRunNodeCommand(linkedCanvasNode, 'node.reparent')).toBe(false);
  });
});
