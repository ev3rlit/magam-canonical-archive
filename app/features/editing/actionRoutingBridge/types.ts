import type { Edge, Node } from 'reactflow';
import type { CreatePayload } from '@/features/editing/commands';
import type { EditMeta } from '@/features/editing/editability';
import type { UpdateNodeCommandType } from '@/hooks/useFileSync.shared';

export type ActionRoutingSurfaceId =
  | 'toolbar'
  | 'selection-floating-menu'
  | 'pane-context-menu'
  | 'node-context-menu';

export type ActionRoutingErrorCode =
  | 'INTENT_NOT_REGISTERED'
  | 'INTENT_SURFACE_NOT_ALLOWED'
  | 'INTENT_GATING_DENIED'
  | 'INTENT_PAYLOAD_INVALID'
  | 'DISPATCH_PLAN_INVALID'
  | 'OPTIMISTIC_CONFLICT';

export interface ActionRoutingError {
  code: ActionRoutingErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export type ActionRoutingResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: ActionRoutingError };

export interface ActionRoutingSelectionRef {
  selectedNodeIds: string[];
  currentFile: string | null;
}

export interface ActionRoutingTargetRef {
  renderedNodeId?: string;
  filePath?: string;
  scopeId?: string;
  frameScope?: string;
}

export interface UIIntentEnvelope {
  surfaceId: ActionRoutingSurfaceId;
  intentId: string;
  selectionRef: ActionRoutingSelectionRef;
  targetRef?: ActionRoutingTargetRef;
  rawPayload: Record<string, unknown>;
  optimistic: boolean;
}

export interface ActionRoutingContext {
  nodes: Node[];
  edges: Edge[];
  currentFile: string | null;
  sourceVersions: Record<string, string>;
  now?: number;
}

export interface ActionRoutingResolvedTarget {
  renderedNodeId: string;
  sourceId: string;
  filePath: string;
  scopeId?: string;
  frameScope?: string;
  editMeta?: EditMeta;
  node: Node;
}

export type DispatchKind =
  | 'canonical-mutation'
  | 'canonical-query'
  | 'runtime-only-action';

export type RuntimeActionId =
  | 'apply-node-data-patch'
  | 'restore-node-data'
  | 'fit-view'
  | 'select-node-group';

export interface RuntimeActionPayloadMap {
  'apply-node-data-patch': {
    nodeId: string;
    patch: Record<string, unknown>;
  };
  'restore-node-data': {
    nodeId: string;
    previousData: Record<string, unknown>;
  };
  'fit-view': Record<string, never>;
  'select-node-group': {
    groupId: string;
    anchorNodeId?: string;
  };
}

export interface ActionRoutingHistoryEffect {
  eventType:
    | 'CONTENT_UPDATED'
    | 'STYLE_UPDATED'
    | 'NODE_RENAMED'
    | 'NODE_CREATED'
    | 'NODE_REPARENTED'
    | 'NODE_DELETED'
    | 'NODE_LOCK_TOGGLED';
  nodeId: string;
  filePath: string;
  baseVersion: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  reloadGraphOnSuccess?: boolean;
  pendingSelectionRenderedId?: string;
}

export interface ActionRoutingPendingRecord {
  pendingKey: string;
  baseVersion: string;
  intentId: string;
  surfaceId: ActionRoutingSurfaceId;
  filePath: string;
  nodeId?: string;
  rollbackSteps: DispatchDescriptor[];
  startedAt: number;
}

export interface ActionRoutingOptimisticMeta extends ActionRoutingPendingRecord {}

export type MutationActionId =
  | 'node.update'
  | 'node.create'
  | 'node.delete'
  | 'node.reparent';

export interface MutationActionPayloadMap {
  'node.update': {
    nodeId: string;
    filePath: string;
    props: Record<string, unknown>;
    commandType?: UpdateNodeCommandType;
  };
  'node.create': {
    filePath: string;
    node: {
      id: string;
      type: CreatePayload['nodeType'];
      props: Record<string, unknown>;
      placement: CreatePayload['placement'];
    };
  };
  'node.delete': {
    nodeId: string;
    filePath: string;
  };
  'node.reparent': {
    nodeId: string;
    filePath: string;
    newParentId: string | null;
  };
}

interface DispatchDescriptorBase {
  kind: DispatchKind;
  historyEffect?: ActionRoutingHistoryEffect;
  optimisticMeta?: ActionRoutingOptimisticMeta;
}

export type RuntimeActionDescriptor<TActionId extends RuntimeActionId = RuntimeActionId> =
  TActionId extends RuntimeActionId
    ? DispatchDescriptorBase & {
      kind: 'runtime-only-action';
      actionId: TActionId;
      payload: RuntimeActionPayloadMap[TActionId];
    }
    : never;

export type MutationDispatchDescriptor<TActionId extends MutationActionId = MutationActionId> =
  TActionId extends MutationActionId
    ? DispatchDescriptorBase & {
      kind: 'canonical-mutation';
      actionId: TActionId;
      payload: MutationActionPayloadMap[TActionId];
    }
    : never;

export interface QueryDispatchDescriptor extends DispatchDescriptorBase {
  kind: 'canonical-query';
  actionId: string;
  payload: Record<string, unknown>;
}

export type DispatchDescriptor =
  | RuntimeActionDescriptor
  | MutationDispatchDescriptor
  | QueryDispatchDescriptor;

export interface OrderedDispatchPlan {
  intentId: string;
  steps: DispatchDescriptor[];
  rollbackSteps: DispatchDescriptor[];
}

export interface ActionRoutingRegistryEntry<TNormalized extends Record<string, unknown> = Record<string, unknown>> {
  intentId: string;
  supportedSurfaces: ActionRoutingSurfaceId[];
  isEnabled(input: {
    envelope: UIIntentEnvelope;
    context: ActionRoutingContext;
  }): ActionRoutingResult<true>;
  normalizePayload(input: {
    envelope: UIIntentEnvelope;
    context: ActionRoutingContext;
  }): ActionRoutingResult<TNormalized>;
  buildDispatch(input: {
    envelope: UIIntentEnvelope;
    context: ActionRoutingContext;
    normalized: TNormalized;
  }): ActionRoutingResult<OrderedDispatchPlan>;
}

export type DeferredNodeContextMenuIntentId =
  | 'node.duplicate'
  | 'node.delete'
  | 'node.lock.toggle'
  | 'node.group.select';

export interface DeferredNodeContextMenuIntent {
  intentId: DeferredNodeContextMenuIntentId;
  supportedSurfaces: Extract<ActionRoutingSurfaceId, 'node-context-menu'>[];
  message: string;
}

export function createActionRoutingError(
  code: ActionRoutingErrorCode,
  message: string,
  details?: Record<string, unknown>,
): ActionRoutingError {
  return { code, message, details };
}

export function ok<T>(value: T): ActionRoutingResult<T> {
  return { ok: true, value };
}

export function fail<T>(
  code: ActionRoutingErrorCode,
  message: string,
  details?: Record<string, unknown>,
): ActionRoutingResult<T> {
  return {
    ok: false,
    error: createActionRoutingError(code, message, details),
  };
}

export function isActionRoutingSurfaceId(value: unknown): value is ActionRoutingSurfaceId {
  return value === 'toolbar'
    || value === 'selection-floating-menu'
    || value === 'pane-context-menu'
    || value === 'node-context-menu';
}

export function isActionRoutingError(value: unknown): value is ActionRoutingError {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const maybe = value as Partial<ActionRoutingError>;
  return typeof maybe.code === 'string' && typeof maybe.message === 'string';
}
