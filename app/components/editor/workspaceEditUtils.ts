import type { Node } from 'reactflow';
import type { CanonicalObject } from '@/features/render/canonicalObject';
import type { ActionRoutingResolvedContext } from '@/features/editing/actionRoutingBridge.types';
import {
  buildContentDraftPatch,
  type CreatePayload,
} from '@/features/editing/commands';
import { isImmediateEditCreateNodeType } from '@/features/editing/createDefaults';
import {
  EDIT_COMMAND_TYPES,
  getNodeEditMeta,
  isCommandAllowed,
  pickStylePatch,
  type EditCommandType,
  type EditMeta,
} from '@/features/editing/editability';

type RpcLikeError = {
  code?: number;
  message?: string;
  data?: unknown;
};

type NodeSourceMeta = {
  sourceId?: unknown;
  kind?: unknown;
  frameScope?: unknown;
};

export function resolveImmediateCreateEditMode(
  nodeType: CreatePayload['nodeType'],
): 'text' | 'markdown-wysiwyg' | null {
  return (isImmediateEditCreateNodeType(nodeType) || nodeType === 'shape') ? 'markdown-wysiwyg' : null;
}

export interface ResolvedNodeEditContext {
  target: {
    nodeId: string;
  };
  editMeta?: EditMeta;
  readOnlyReason?: string;
}

function getPrimaryContentKind(canonicalObject: CanonicalObject | undefined): string | undefined {
  const content = canonicalObject?.capabilities?.content;
  return content && typeof content.kind === 'string' ? content.kind : undefined;
}

function getCapabilityKeys(canonicalObject: CanonicalObject | undefined): string[] {
  if (!canonicalObject?.capabilities || typeof canonicalObject.capabilities !== 'object') {
    return [];
  }
  return Object.keys(canonicalObject.capabilities);
}

function getSourceKind(
  sourceMeta: {
    kind?: unknown;
  },
  canonicalObject: CanonicalObject | undefined,
): 'canvas' | 'mindmap' | undefined {
  const candidate = sourceMeta.kind ?? canonicalObject?.core?.sourceMeta?.kind;
  return candidate === 'canvas' || candidate === 'mindmap'
    ? candidate
    : undefined;
}

function getParentSourceId(canonicalObject: CanonicalObject | undefined): string | undefined {
  const parentSourceId = canonicalObject?.core?.relations?.from;
  return typeof parentSourceId === 'string' && parentSourceId.length > 0
    ? parentSourceId
    : undefined;
}

function deriveLocalSourceId(nodeId: string, frameScope: unknown): string {
  if (typeof frameScope !== 'string' || frameScope.length === 0) {
    return nodeId;
  }

  const prefix = `${frameScope}.`;
  return nodeId.startsWith(prefix) ? nodeId.slice(prefix.length) : nodeId;
}

export function resolveNodeEditTarget(
  node: Pick<Node, 'id' | 'data'>,
): { nodeId: string } {
  const sourceMeta = ((node.data || {}) as { sourceMeta?: NodeSourceMeta }).sourceMeta;
  const sourceId = typeof sourceMeta?.sourceId === 'string' && sourceMeta.sourceId.length > 0
    ? sourceMeta.sourceId
    : deriveLocalSourceId(node.id, sourceMeta?.frameScope);
  return {
    nodeId: sourceId,
  };
}

export function resolveNodeEditContext(
  node: Pick<Node, 'id' | 'data'>,
): ResolvedNodeEditContext {
  const target = resolveNodeEditTarget(node);
  const editMeta = getNodeEditMeta(node);
  return {
    target,
    editMeta,
    readOnlyReason: editMeta?.readOnlyReason,
  };
}

export function resolveNodeActionRoutingContext(
  node: Pick<Node, 'id' | 'data' | 'type'>,
  currentCanvasIdOrSelectedNodeIds: string | null,
  canvasOrSelectedNodeIds: string | null | string[],
  maybeSelectedNodeIds?: string[],
): ActionRoutingResolvedContext {
  const selectedNodeIds = Array.isArray(canvasOrSelectedNodeIds)
    ? canvasOrSelectedNodeIds
    : (maybeSelectedNodeIds ?? []);
  const currentCanvasId = Array.isArray(canvasOrSelectedNodeIds)
    ? currentCanvasIdOrSelectedNodeIds
    : currentCanvasIdOrSelectedNodeIds;
  const target = resolveNodeEditTarget(node);
  const editMeta = getNodeEditMeta(node);
  const data = (node.data || {}) as Record<string, unknown>;
  const sourceMeta = (data.sourceMeta || {}) as {
    scopeId?: unknown;
    frameScope?: unknown;
    kind?: unknown;
  };
  const canonicalObject = (data.canonicalObject || undefined) as CanonicalObject | undefined;
  const sourceKind = getSourceKind(sourceMeta, canonicalObject);
  const parentSourceId = getParentSourceId(canonicalObject);
  const groupId = typeof data.groupId === 'string' && data.groupId.length > 0
    ? data.groupId
    : undefined;
  const frameScope = typeof sourceMeta.frameScope === 'string' && sourceMeta.frameScope.length > 0
    ? sourceMeta.frameScope
    : undefined;

  return {
    surfaceId: currentCanvasId ?? undefined,
    selection: {
      nodeIds: selectedNodeIds,
      homogeneous: selectedNodeIds.length <= 1 || selectedNodeIds.every((nodeId) => nodeId === node.id),
    },
    target: {
      renderedNodeId: node.id,
      sourceId: target.nodeId,
      canvasId: currentCanvasId,
      nodeType: node.type,
      ...(typeof sourceMeta.scopeId === 'string' ? { scopeId: sourceMeta.scopeId } : {}),
      ...(typeof sourceMeta.frameScope === 'string' ? { frameScope: sourceMeta.frameScope } : {}),
    },
    metadata: {
      semanticRole: canonicalObject?.semanticRole,
      primaryContentKind: getPrimaryContentKind(canonicalObject),
      capabilities: getCapabilityKeys(canonicalObject),
    },
    relations: {
      ...(sourceKind ? { sourceKind } : {}),
      ...(parentSourceId ? { parentSourceId } : {}),
      ...(groupId ? { groupId } : {}),
      ...(frameScope ? { frameScope } : {}),
      hasParentRelation: Boolean(parentSourceId),
      isGroupMember: Boolean(groupId),
      isMindmapMember: sourceKind === 'mindmap',
      isFrameScoped: Boolean(frameScope),
    },
    editability: {
      canMutate: !editMeta?.readOnlyReason,
      allowedCommands: EDIT_COMMAND_TYPES.filter((commandType) => isCommandAllowed(editMeta, commandType)),
      styleEditableKeys: editMeta?.styleEditableKeys ?? [],
      reason: editMeta?.readOnlyReason,
      editMeta,
    },
  };
}

export function createPaneActionRoutingContext(input: {
  currentCanvasId: string | null;
  selectedNodeIds: string[];
}): ActionRoutingResolvedContext {
  const hasMutableTarget = typeof input.currentCanvasId === 'string' && input.currentCanvasId.length > 0;
  return {
    surfaceId: input.currentCanvasId ?? undefined,
    selection: {
      nodeIds: input.selectedNodeIds,
      homogeneous: input.selectedNodeIds.length <= 1,
    },
    metadata: {
      capabilities: [],
    },
    ...(input.currentCanvasId
      ? {
          target: {
            canvasId: input.currentCanvasId,
          },
        }
      : {}),
    relations: {
      hasParentRelation: false,
      isGroupMember: false,
      isMindmapMember: false,
      isFrameScoped: false,
    },
    editability: {
      canMutate: hasMutableTarget,
      allowedCommands: hasMutableTarget ? ['node.create'] : [],
      styleEditableKeys: [],
      ...(hasMutableTarget ? {} : { reason: 'SOURCE_VERSION_NOT_READY' }),
    },
  };
}

export function canRunNodeCommand(
  node: Pick<Node, 'id' | 'data'>,
  commandType: EditCommandType,
): boolean {
  return isCommandAllowed(getNodeEditMeta(node), commandType);
}

export function getAllowedNodeStylePatch(
  node: Pick<Node, 'data'>,
  patch: Record<string, unknown>,
): {
  patch: Record<string, unknown>;
  rejectedKeys: string[];
} {
  const editMeta = getNodeEditMeta(node);
  const { allowedPatch, rejectedKeys } = pickStylePatch(
    patch,
    editMeta?.styleEditableKeys ?? [],
  );
  return {
    patch: allowedPatch,
    rejectedKeys,
  };
}

export function mapEditRpcErrorToToast(error: unknown): string | null {
  const rpc = error as RpcLikeError;
  if (rpc.message === 'WebSocket not connected') {
    return '편집 서버 연결이 아직 준비되지 않았습니다. 잠시 후 다시 시도해주세요.';
  }
  if (typeof rpc.message === 'string' && rpc.message.startsWith('Request timeout:')) {
    return '편집 저장 응답이 지연되고 있습니다. 연결 상태를 확인한 뒤 다시 시도해주세요.';
  }
  if (rpc.code === 40901 || rpc.message === 'VERSION_CONFLICT') {
    return '외부 수정 감지: 최신 상태로 다시 동기화 후 다시 시도해주세요.';
  }
  if (rpc.code === 40903 || rpc.message === 'ID_COLLISION') {
    return 'ID 중복 감지: 중복 식별자를 먼저 해결해주세요.';
  }
  if (rpc.code === 40902 || rpc.message === 'MINDMAP_CYCLE') {
    return 'MindMap 구조 변경이 사이클을 만들 수 있어 반영되지 않았습니다.';
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
  if (rpc.code === 42201 || rpc.message === 'EDIT_NOT_ALLOWED') {
    const reason = (rpc.data as { reason?: unknown } | undefined)?.reason;
    if (reason === 'LOCKED') {
      return '잠금된 오브젝트라서 변경할 수 없습니다.';
    }
    if (reason === 'NO_VALID_PARENT') {
      return 'MindMap 노드는 다른 MindMap 노드 위에 놓아 부모를 바꿔야 합니다.';
    }
    return '이 오브젝트는 현재 웹 편집 범위에서 안전하게 수정할 수 없습니다.';
  }
  if (rpc.code === 42208 || rpc.message === 'CONTENT_CONTRACT_VIOLATION') {
    return '이 오브젝트의 content 계약과 맞지 않는 편집이라 반영되지 않았습니다.';
  }
  if (rpc.code === 42211 || rpc.message === 'PATCH_SURFACE_VIOLATION') {
    return '허용되지 않은 편집 surface라서 변경을 적용할 수 없습니다.';
  }
  if (rpc.message === 'INVALID_INTENT') {
    return '이 UI 진입점에서는 지원되지 않는 액션입니다.';
  }
  if (rpc.message === 'INTENT_NOT_REGISTERED') {
    return '등록되지 않은 UI intent라서 실행할 수 없습니다.';
  }
  if (rpc.code === 42212) {
    return '이 UI 진입점에서는 지원되지 않는 액션입니다.';
  }
  if (rpc.message === 'NORMALIZATION_FAILED') {
    return '편집 대상을 canonical 기준으로 해석하지 못했습니다. 최신 상태를 확인해주세요.';
  }
  if (rpc.message === 'INTENT_SURFACE_NOT_ALLOWED') {
    return '이 surface에서는 해당 intent를 실행할 수 없습니다.';
  }
  if (rpc.message === 'INTENT_GATING_DENIED') {
    return '현재 선택 상태에서는 이 intent를 실행할 수 없습니다.';
  }
  if (rpc.message === 'GATE_BLOCKED') {
    return '현재 selection/context에서는 이 액션을 실행할 수 없습니다.';
  }
  if (rpc.code === 42213) {
    return '편집 대상을 canonical 기준으로 해석하지 못했습니다. 최신 상태를 확인해주세요.';
  }
  if (rpc.message === 'INTENT_PAYLOAD_INVALID') {
    return 'UI payload가 bridge 계약과 맞지 않아 실행할 수 없습니다.';
  }
  if (rpc.code === 42214) {
    return '현재 선택 상태에서는 이 intent를 실행할 수 없습니다.';
  }
  if (rpc.message === 'DISPATCH_PLAN_INVALID') {
    return 'bridge dispatch plan이 유효하지 않아 실행할 수 없습니다.';
  }
  if (rpc.code === 40904 || rpc.message === 'OPTIMISTIC_CONFLICT') {
    return 'optimistic 편집 상태가 충돌해서 요청을 다시 시도해야 합니다.';
  }
  if (rpc.code === 50002 || rpc.message === 'EXECUTION_FAILED') {
    return '공통 action bridge 실행에 실패했습니다. 잠시 후 다시 시도해주세요.';
  }
  if (rpc.code === 50003 || rpc.message === 'ADOPTION_VIOLATION') {
    return '허용되지 않은 편집 경로가 감지되었습니다.';
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
  return buildContentDraftPatch(nodeType, draft);
}
