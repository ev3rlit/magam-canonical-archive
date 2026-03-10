import type { Node } from 'reactflow';

type RpcLikeError = {
  code?: number;
  message?: string;
  data?: unknown;
};

type NodeSourceMeta = {
  sourceId?: unknown;
  filePath?: unknown;
  frameScope?: unknown;
};

function deriveLocalSourceId(nodeId: string, frameScope: unknown): string {
  if (typeof frameScope !== 'string' || frameScope.length === 0) {
    return nodeId;
  }

  const prefix = `${frameScope}.`;
  return nodeId.startsWith(prefix) ? nodeId.slice(prefix.length) : nodeId;
}

export function resolveNodeEditTarget(
  node: Pick<Node, 'id' | 'data'>,
  currentFile: string | null,
): { nodeId: string; filePath: string | null } {
  const sourceMeta = ((node.data || {}) as { sourceMeta?: NodeSourceMeta }).sourceMeta;
  const sourceId = typeof sourceMeta?.sourceId === 'string' && sourceMeta.sourceId.length > 0
    ? sourceMeta.sourceId
    : deriveLocalSourceId(node.id, sourceMeta?.frameScope);
  const filePath = typeof sourceMeta?.filePath === 'string' && sourceMeta.filePath.length > 0
    ? sourceMeta.filePath
    : currentFile;

  return {
    nodeId: sourceId,
    filePath,
  };
}

export function mapEditRpcErrorToToast(error: unknown): string | null {
  const rpc = error as RpcLikeError;
  if (rpc.code === 40901 || rpc.message === 'VERSION_CONFLICT') {
    return '외부 수정 감지: 최신 상태로 다시 동기화 후 다시 시도해주세요.';
  }
  if (rpc.code === 40903 || rpc.message === 'ID_COLLISION') {
    return 'ID 중복 감지: 중복 식별자를 먼저 해결해주세요.';
  }
  if (rpc.message === 'NODE_NOT_FOUND') {
    const reason = (rpc.data as { reason?: unknown } | undefined)?.reason;
    if (reason === 'MISSING_ATTACH_TARGET') {
      return 'Washi attach target을 찾을 수 없습니다. 부모/타겟을 확인해주세요.';
    }
    if (reason === 'MISSING_ANCHOR_TARGET') {
      return 'Sticker anchor 대상을 찾을 수 없습니다. 부모/타겟을 확인해주세요.';
    }
    return '편집 대상 노드를 찾지 못했습니다. 최신 상태로 새로고침해주세요.';
  }
  if (rpc.code === 50001 || rpc.message === 'PATCH_FAILED') {
    return '편집 반영에 실패했습니다. 잠시 후 다시 시도해주세요.';
  }
  return null;
}

export function canCommitTextEdit(input: {
  activeNodeId: string | null;
  requestNodeId: string;
  selectedNodeIds: string[];
}): boolean {
  return (
    input.activeNodeId === input.requestNodeId
    && input.selectedNodeIds.includes(input.requestNodeId)
  );
}

export function buildTextDraftPatch(nodeType: string | undefined, draft: string): Record<string, unknown> {
  if (nodeType === 'markdown') {
    return {
      label: draft,
      children: [{ type: 'graph-markdown', content: draft }],
    };
  }
  return {
    label: draft,
    children: [{ type: 'text', text: draft }],
  };
}
