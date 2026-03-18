import { describe, expect, it } from 'bun:test';
import { resolveRestoreFocusTarget, restoreFocusForOverlay } from '@/features/overlay-host';
import { installTestDom } from '@/features/overlay-host/testDom';
import { createCanvasActionDispatchBinding } from '@/processes/canvas-runtime/bindings/actionDispatch';
import type { Node } from 'reactflow';
import { mapDragToRelativeAttachmentUpdate } from '@/utils/relativeAttachmentMapping';
import { deriveCapabilityProfile } from '@/features/editing/capabilityProfile';
import type { CanonicalObject } from '@/features/render/canonicalObject';
import {
  canCommitTextEdit,
  canRunNodeCommand,
  createPaneActionRoutingContext,
  getAllowedNodeStylePatch,
  extractWorkspaceStyleInput,
  flattenWorkspaceStyleDiagnostics,
  mapEditRpcErrorToToast,
  resolveNodeActionRoutingContext,
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

  it('LOCKED reason은 잠금 안내 메시지로 매핑된다', () => {
    expect(
      mapEditRpcErrorToToast({
        code: 42201,
        message: 'EDIT_NOT_ALLOWED',
        data: { reason: 'LOCKED' },
      }),
    ).toContain('잠금된');
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

  it('bridge intent 오류는 surface/registry 안내 메시지로 매핑된다', () => {
    expect(
      mapEditRpcErrorToToast({
        code: 42212,
        message: 'INTENT_NOT_REGISTERED',
      }),
    ).toContain('등록되지 않은 UI intent');

    expect(
      mapEditRpcErrorToToast({
        code: 42214,
        message: 'INTENT_GATING_DENIED',
      }),
    ).toContain('현재 선택 상태');

    expect(
      mapEditRpcErrorToToast({
        code: 40904,
        message: 'OPTIMISTIC_CONFLICT',
      }),
    ).toContain('optimistic');
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

  it('resolveNodeActionRoutingContext exposes metadata and allowed commands for the bridge', () => {
    expect(resolveNodeActionRoutingContext(
      makeCapabilityProfileNodeFromCanonical({
        id: 'profile-node-1',
        type: 'shape',
        canonical: canonicalProfileNode,
      }),
      'examples/fallback.tsx',
      ['profile-node-1'],
    )).toEqual({
      surfaceId: 'examples/fallback.tsx',
      selection: {
        nodeIds: ['profile-node-1'],
        homogeneous: true,
      },
      target: {
        renderedNodeId: 'profile-node-1',
        sourceId: 'profile-node-1',
        filePath: 'examples/fallback.tsx',
        nodeType: 'shape',
      },
      metadata: {
        semanticRole: 'topic',
        primaryContentKind: 'text',
        capabilities: ['frame', 'content'],
      },
      relations: {
        hasParentRelation: false,
        isGroupMember: false,
        isMindmapMember: false,
        isFrameScoped: false,
      },
      editability: {
        canMutate: true,
        allowedCommands: ['node.move.absolute', 'node.content.update', 'node.style.update', 'node.rename', 'node.create'],
        styleEditableKeys: canonicalProfileNode.capabilities.content
          ? expect.any(Array)
          : [],
        reason: undefined,
        editMeta: {
          family: 'rich-content',
          contentCarrier: 'text-child',
          styleEditableKeys: expect.any(Array),
          createMode: 'canvas',
        },
      },
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

  it('createPaneActionRoutingContext exposes node.create permission only when file is ready', () => {
    expect(createPaneActionRoutingContext({
      currentFile: 'examples/fallback.tsx',
      selectedNodeIds: [],
    }).editability.allowedCommands).toEqual(['node.create']);

    expect(createPaneActionRoutingContext({
      currentFile: null,
      selectedNodeIds: [],
    }).editability.canMutate).toBe(false);
  });

  it('flattens diagnostics for overlay rendering and clears when empty', () => {
    expect(flattenWorkspaceStyleDiagnostics({
      a: [{ objectId: 'sticky-1', code: 'UNSUPPORTED_TOKEN', message: 'bad token' }],
      b: [{ objectId: 'sticker-1', code: 'OUT_OF_SCOPE_OBJECT', message: 'out of scope' }],
    }, 1)).toEqual(['[sticky-1] bad token']);

    expect(flattenWorkspaceStyleDiagnostics({})).toEqual([]);
  });

  it('bridge-specific error codes are mapped to actionable toast messages', () => {
    expect(mapEditRpcErrorToToast({
      code: 42212,
      message: 'INVALID_INTENT',
    })).toContain('지원되지 않는');
    expect(mapEditRpcErrorToToast({
      code: 42213,
      message: 'NORMALIZATION_FAILED',
    })).toContain('canonical');
    expect(mapEditRpcErrorToToast({
      code: 42214,
      message: 'GATE_BLOCKED',
    })).toContain('selection/context');
  });
});

describe('WorkspaceClient overlay boundary helpers', () => {
  it('focus restore keeps using the trigger element for canvas-host dismissals', () => {
    const cleanupDom = installTestDom();
    const trigger = document.createElement('button');
    trigger.type = 'button';
    document.body.appendChild(trigger);

    expect(resolveRestoreFocusTarget({
      focusPolicy: {
        openTarget: 'none',
        restoreTarget: 'trigger',
      },
      triggerElement: trigger,
      selectionOwnerElement: null,
    })).toBe(trigger);

    expect(restoreFocusForOverlay({
      focusPolicy: {
        openTarget: 'none',
        restoreTarget: 'trigger',
      },
      triggerElement: trigger,
      selectionOwnerElement: null,
    })).toEqual({ restored: true });

    trigger.remove();
    cleanupDom();
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

describe('WorkspaceClient action-dispatch binding', () => {
  it('maps compat requests into action-routing envelopes with surface and target fallbacks', async () => {
    let capturedEnvelope: unknown = null;

    const binding = createCanvasActionDispatchBinding({
      getRuntime: () => ({
        nodes: [],
        edges: [],
        currentFile: 'examples/current.tsx',
        sourceVersions: {},
        selectedNodeIds: ['node-1'],
      }),
      applyRuntimeAction: () => undefined,
      executeMutationDescriptor: async () => ({}),
      commitHistoryEffect: () => undefined,
      registerPendingActionRouting: () => undefined,
      clearPendingActionRouting: () => undefined,
      routeIntentImpl: ({ envelope }) => {
        capturedEnvelope = envelope;
        return {
          ok: true,
          value: {
            intentId: envelope.intentId,
            steps: [],
            rollbackSteps: [],
          },
        };
      },
    });

    await binding.dispatchActionRoutingIntentOrThrow({
      surface: 'canvas-toolbar',
      intent: 'content-update',
      resolvedContext: {
        selection: {
          nodeIds: ['node-1'],
          homogeneous: true,
        },
        target: {
          renderedNodeId: 'node-1',
        },
        metadata: {
          capabilities: [],
        },
        editability: {
          canMutate: true,
          allowedCommands: [],
          styleEditableKeys: [],
        },
      },
      uiPayload: {
        content: 'Updated label',
        filePath: 'examples/override.tsx',
        scopeId: 'scope-1',
        frameScope: 'frame-1',
      },
      trigger: { source: 'inspector' },
    });

    expect(capturedEnvelope).toEqual({
      surfaceId: 'toolbar',
      intentId: 'selection.content.update',
      selectionRef: {
        selectedNodeIds: ['node-1'],
        currentFile: 'examples/current.tsx',
      },
      targetRef: {
        renderedNodeId: 'node-1',
        filePath: 'examples/override.tsx',
        scopeId: 'scope-1',
        frameScope: 'frame-1',
      },
      rawPayload: {
        content: 'Updated label',
        filePath: 'examples/override.tsx',
        scopeId: 'scope-1',
        frameScope: 'frame-1',
      },
      optimistic: true,
    });
  });

  it('replays runtime rollback steps and clears optimistic registrations when a mutation fails', async () => {
    const appliedRuntimeActions: string[] = [];
    const registeredPendingKeys: string[] = [];
    const clearedPendingKeys: string[] = [];
    let committedHistory = false;

    const binding = createCanvasActionDispatchBinding({
      getRuntime: () => ({
        nodes: [],
        edges: [],
        currentFile: 'examples/current.tsx',
        sourceVersions: {},
        selectedNodeIds: [],
      }),
      applyRuntimeAction: (descriptor) => {
        appliedRuntimeActions.push(descriptor.actionId);
      },
      executeMutationDescriptor: async () => {
        throw new Error('mutation failed');
      },
      commitHistoryEffect: () => {
        committedHistory = true;
      },
      registerPendingActionRouting: (record) => {
        registeredPendingKeys.push(record.pendingKey);
      },
      clearPendingActionRouting: (pendingKey) => {
        clearedPendingKeys.push(pendingKey);
      },
      routeIntentImpl: () => ({
        ok: true,
        value: {
          intentId: 'node.create',
          steps: [
            {
              kind: 'canonical-mutation',
              actionId: 'node.create',
              payload: {
                filePath: 'examples/current.tsx',
                node: {
                  id: 'node-2',
                  type: 'shape',
                  props: {},
                  placement: { mode: 'canvas-absolute', x: 10, y: 20 },
                },
              },
              optimisticMeta: {
                pendingKey: 'pending-1',
                baseVersion: 'rev-1',
                intentId: 'node.create',
                surfaceId: 'toolbar',
                filePath: 'examples/current.tsx',
                rollbackSteps: [],
                startedAt: 1,
              },
            },
          ],
          rollbackSteps: [
            {
              kind: 'runtime-only-action',
              actionId: 'restore-node-data',
              payload: {
                nodeId: 'node-2',
                previousData: {},
              },
            },
          ],
        },
      }),
    });

    await expect(binding.executeBridgeIntent({
      surfaceId: 'toolbar',
      intentId: 'node.create',
      selectionRef: {
        selectedNodeIds: [],
        currentFile: 'examples/current.tsx',
      },
      rawPayload: {},
      optimistic: false,
    })).rejects.toThrow('mutation failed');

    expect(registeredPendingKeys).toEqual(['pending-1']);
    expect(clearedPendingKeys).toEqual(['pending-1']);
    expect(appliedRuntimeActions).toEqual(['restore-node-data']);
    expect(committedHistory).toBe(false);
  });
});

describe('WorkspaceClient bridge integration', () => {
  it('consumes the action-dispatch binding instead of owning bridge orchestration inline', async () => {
    const source = await Bun.file(new URL('./WorkspaceClient.tsx', import.meta.url)).text();

    expect(source).toContain("createCanvasActionDispatchBinding({");
    expect(source).toContain("resolveLegacyEntrypointSurface({");
    expect(source).toContain("dispatchActionRoutingIntentOrThrow({");
    expect(source).toContain("intent: 'style-update'");
    expect(source).toContain("intent: 'rename-node'");
    expect(source).toContain("'create-node'");
    expect(source).toContain("'create-mindmap-child'");
    expect(source).toContain("'create-mindmap-sibling'");
    expect(source).not.toContain('const executeBridgeIntent = useCallback');
    expect(source).not.toContain('const dispatchActionRoutingIntentOrThrow = useCallback');
    expect(source).not.toContain('routeIntent({');
    expect(source).not.toContain('buildCreateCommand(');
    expect(source).not.toContain('buildRenameCommand(');
    expect(source).not.toContain('buildStyleUpdateCommand(');
  });
});
