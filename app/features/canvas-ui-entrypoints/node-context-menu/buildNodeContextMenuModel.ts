import type { EditCommandType } from '@/features/editing/editability';
import { buildNodeRelationSummary } from './buildNodeRelationSummary';
import type {
  NodeContextMenuActionId,
  NodeContextMenuActionState,
  NodeContextMenuDisabledReason,
  NodeContextMenuModel,
  NodeContextSnapshot,
} from './types';

function enabled(): NodeContextMenuActionState {
  return { visibility: 'enabled' };
}

function hidden(): NodeContextMenuActionState {
  return { visibility: 'hidden' };
}

function disabled(reason: NodeContextMenuDisabledReason): NodeContextMenuActionState {
  return {
    visibility: 'disabled',
    disabledReason: reason,
  };
}

function resolveSelectionReason(snapshot: NodeContextSnapshot): NodeContextMenuDisabledReason | null {
  const homogeneous = snapshot.nodeContext?.selection.homogeneous ?? snapshot.selectedNodeIds.length <= 1;
  if (!homogeneous) {
    return {
      code: 'SELECTION_NOT_SINGULAR',
      message: '단일 노드 selection에서만 실행할 수 있습니다.',
    };
  }
  return null;
}

function resolveReadOnlyReason(snapshot: NodeContextSnapshot): NodeContextMenuDisabledReason | null {
  if (!snapshot.nodeContext) {
    return {
      code: 'NODE_CONTEXT_MISSING',
      message: 'canonical node context를 아직 해석하지 못했습니다.',
    };
  }

  if (!snapshot.nodeContext.editability.canMutate) {
    return {
      code: 'READ_ONLY',
      message: snapshot.nodeContext.editability.reason === 'LOCKED'
        ? '잠금된 오브젝트라서 변경할 수 없습니다.'
        : (snapshot.nodeContext.editability.reason ?? '이 노드는 현재 수정할 수 없습니다.'),
    };
  }

  return null;
}

function resolveCommandReason(
  snapshot: NodeContextSnapshot,
  commandType: EditCommandType,
): NodeContextMenuDisabledReason | null {
  if (!snapshot.nodeContext) {
    return {
      code: 'NODE_CONTEXT_MISSING',
      message: 'canonical node context를 아직 해석하지 못했습니다.',
    };
  }

  const selectionReason = resolveSelectionReason(snapshot);
  if (selectionReason) {
    return selectionReason;
  }

  const readOnlyReason = resolveReadOnlyReason(snapshot);
  if (readOnlyReason) {
    return readOnlyReason;
  }

  if (!snapshot.nodeContext.editability.allowedCommands.includes(commandType)) {
    return {
      code: 'COMMAND_NOT_ALLOWED',
      message: '현재 canonical metadata에서는 이 명령을 허용하지 않습니다.',
    };
  }

  return null;
}

function resolveStructuralCommandReason(
  snapshot: NodeContextSnapshot,
  commandType: Extract<EditCommandType, 'node.group.update' | 'node.z-order.update'>,
): NodeContextMenuDisabledReason | null {
  if (!snapshot.nodeContext) {
    return {
      code: 'NODE_CONTEXT_MISSING',
      message: 'canonical node context를 아직 해석하지 못했습니다.',
    };
  }

  const readOnlyReason = resolveReadOnlyReason(snapshot);
  if (readOnlyReason) {
    return readOnlyReason;
  }

  if (!snapshot.nodeContext.editability.allowedCommands.includes(commandType)) {
    return {
      code: 'COMMAND_NOT_ALLOWED',
      message: '현재 canonical metadata에서는 이 명령을 허용하지 않습니다.',
    };
  }

  return null;
}

function isDuplicableNodeType(nodeType: unknown): boolean {
  return nodeType === 'shape'
    || nodeType === 'text'
    || nodeType === 'markdown'
    || nodeType === 'sticky'
    || nodeType === 'sticker'
    || nodeType === 'washi-tape'
    || nodeType === 'image';
}

function resolveDeleteReason(snapshot: NodeContextSnapshot): NodeContextMenuDisabledReason | null {
  const selectionReason = resolveSelectionReason(snapshot);
  if (selectionReason) {
    return selectionReason;
  }

  return resolveReadOnlyReason(snapshot);
}

function resolveDuplicateReason(snapshot: NodeContextSnapshot): NodeContextMenuDisabledReason | null {
  const deleteReason = resolveDeleteReason(snapshot);
  if (deleteReason) {
    return deleteReason;
  }

  const nodeType = snapshot.nodeContext?.target?.nodeType;
  if (!isDuplicableNodeType(nodeType)) {
    return {
      code: 'UNSUPPORTED_NODE_TYPE',
      message: '현재 node type에서는 duplicate를 지원하지 않습니다.',
    };
  }

  return null;
}

function resolveLockReason(snapshot: NodeContextSnapshot): NodeContextMenuDisabledReason | null {
  if (!snapshot.nodeContext) {
    return {
      code: 'NODE_CONTEXT_MISSING',
      message: 'canonical node context를 아직 해석하지 못했습니다.',
    };
  }

  const selectionReason = resolveSelectionReason(snapshot);
  if (selectionReason) {
    return selectionReason;
  }

  const readOnlyReason = snapshot.nodeContext.editability.reason;
  if (readOnlyReason && readOnlyReason !== 'LOCKED') {
    return {
      code: 'READ_ONLY',
      message: readOnlyReason,
    };
  }

  return null;
}

function resolveGroupSelectReason(snapshot: NodeContextSnapshot): NodeContextMenuDisabledReason | null {
  if (!snapshot.nodeContext) {
    return snapshot.nodeFamily === 'mindmap-member'
      ? {
          code: 'NODE_CONTEXT_MISSING',
          message: 'group context를 아직 해석하지 못했습니다.',
        }
      : {
          code: 'GROUP_CONTEXT_REQUIRED',
          message: 'group context가 있는 노드에서만 실행할 수 있습니다.',
        };
  }

  const groupId = snapshot.nodeContext.relations?.groupId;
  if (typeof groupId !== 'string' || groupId.length === 0) {
    return {
      code: 'GROUP_CONTEXT_REQUIRED',
      message: 'group context가 있는 노드에서만 실행할 수 있습니다.',
    };
  }

  return null;
}

function toVisibleActionState(reason: NodeContextMenuDisabledReason | null): NodeContextMenuActionState {
  return reason ? disabled(reason) : enabled();
}

export function resolveNodeContextMenuActionState(
  snapshot: NodeContextSnapshot,
  actionId: NodeContextMenuActionId,
): NodeContextMenuActionState {
  const relations = buildNodeRelationSummary(snapshot);

  switch (actionId) {
    case 'copy-as-png':
    case 'export-selection':
      return enabled();
    case 'rename-node':
      return toVisibleActionState(resolveCommandReason(snapshot, 'node.rename'));
    case 'mindmap-add-child':
      return relations.isMindmapMember
        ? toVisibleActionState(resolveCommandReason(snapshot, 'mindmap.child.create'))
        : hidden();
    case 'mindmap-add-sibling':
      return relations.isMindmapMember
        ? toVisibleActionState(resolveCommandReason(snapshot, 'mindmap.sibling.create'))
        : hidden();
    case 'select-group':
      return relations.isGroupMember || relations.isMindmapMember || snapshot.nodeFamily === 'mindmap-member'
        ? toVisibleActionState(resolveGroupSelectReason(snapshot))
        : hidden();
    case 'enter-group':
      return relations.isGroupMember
        ? enabled()
        : hidden();
    case 'group-selection':
      return snapshot.selectedNodeIds.length > 1
        ? toVisibleActionState(resolveStructuralCommandReason(snapshot, 'node.group.update'))
        : hidden();
    case 'ungroup-selection':
      return relations.isGroupMember
        ? toVisibleActionState(resolveStructuralCommandReason(snapshot, 'node.group.update'))
        : hidden();
    case 'bring-to-front':
    case 'send-to-back':
      return toVisibleActionState(resolveStructuralCommandReason(snapshot, 'node.z-order.update'));
    case 'duplicate-node':
      return toVisibleActionState(resolveDuplicateReason(snapshot));
    case 'delete-node':
      return toVisibleActionState(resolveDeleteReason(snapshot));
    case 'lock-node':
      return toVisibleActionState(resolveLockReason(snapshot));
    default:
      return hidden();
  }
}

export function resolveNodeContextMenuActionLabel(
  snapshot: NodeContextSnapshot,
  actionId: NodeContextMenuActionId,
): string | undefined {
  if (actionId !== 'lock-node') {
    return undefined;
  }

  return snapshot.nodeContext?.editability.reason === 'LOCKED'
    ? '잠금 해제'
    : '잠금';
}

export function buildNodeContextMenuModel(snapshot: NodeContextSnapshot): NodeContextMenuModel {
  return {
    'copy-as-png': resolveNodeContextMenuActionState(snapshot, 'copy-as-png'),
    'export-selection': resolveNodeContextMenuActionState(snapshot, 'export-selection'),
    'rename-node': resolveNodeContextMenuActionState(snapshot, 'rename-node'),
    'mindmap-add-child': resolveNodeContextMenuActionState(snapshot, 'mindmap-add-child'),
    'mindmap-add-sibling': resolveNodeContextMenuActionState(snapshot, 'mindmap-add-sibling'),
    'select-group': resolveNodeContextMenuActionState(snapshot, 'select-group'),
    'enter-group': resolveNodeContextMenuActionState(snapshot, 'enter-group'),
    'group-selection': resolveNodeContextMenuActionState(snapshot, 'group-selection'),
    'ungroup-selection': resolveNodeContextMenuActionState(snapshot, 'ungroup-selection'),
    'bring-to-front': resolveNodeContextMenuActionState(snapshot, 'bring-to-front'),
    'send-to-back': resolveNodeContextMenuActionState(snapshot, 'send-to-back'),
    'duplicate-node': resolveNodeContextMenuActionState(snapshot, 'duplicate-node'),
    'delete-node': resolveNodeContextMenuActionState(snapshot, 'delete-node'),
    'lock-node': resolveNodeContextMenuActionState(snapshot, 'lock-node'),
  };
}
