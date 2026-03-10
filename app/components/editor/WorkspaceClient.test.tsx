import { describe, expect, it } from 'bun:test';
import type { Node } from 'reactflow';
import { mapDragToRelativeAttachmentUpdate } from '@/utils/relativeAttachmentMapping';
import {
  canCommitTextEdit,
  mapEditRpcErrorToToast,
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
});
