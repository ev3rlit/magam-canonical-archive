import type { Node } from 'reactflow';
import type {
  CreatePayload,
  EditTarget,
} from './commands';
import type {
  EditCommandType,
  EditMeta,
} from './editability';
import type { RpcMutationResult, UpdateNodeMutationOptions } from '@/hooks/useFileSync.shared';
import type { EditCompletionEvent } from '@/store/graph';

export type EntryPointSurface =
  | 'canvas-toolbar'
  | 'selection-floating-menu'
  | 'pane-context-menu'
  | 'node-context-menu';

export type ActionRoutingIntent =
  | 'create-node'
  | 'rename-node'
  | 'create-mindmap-child'
  | 'create-mindmap-sibling'
  | 'style-update';

export type ActionIntentType = 'mutation' | 'query' | 'runtime-only';

export type ActionRoutingTriggerSource =
  | 'click'
  | 'hotkey'
  | 'menu'
  | 'inspector';

export interface ActionRoutingTrigger {
  source: ActionRoutingTriggerSource;
  actorId?: string;
}

export interface ActionRoutingSelectionSnapshot {
  nodeIds: string[];
  homogeneous: boolean;
}

export interface ActionRoutingTargetSnapshot {
  renderedNodeId?: string;
  sourceId?: string;
  filePath?: string | null;
  scopeId?: string;
  frameScope?: string;
}

export interface ActionRoutingMetadataSnapshot {
  semanticRole?: string;
  primaryContentKind?: string;
  capabilities: string[];
}

export interface ActionRoutingEditabilitySnapshot {
  canMutate: boolean;
  allowedCommands: EditCommandType[];
  styleEditableKeys: string[];
  reason?: string;
  editMeta?: EditMeta;
}

export interface ActionRoutingResolvedContext {
  surfaceId?: string;
  selection: ActionRoutingSelectionSnapshot;
  target?: ActionRoutingTargetSnapshot;
  metadata: ActionRoutingMetadataSnapshot;
  editability: ActionRoutingEditabilitySnapshot;
}

export interface ActionIntentCatalogEntry {
  surface: EntryPointSurface;
  intent: ActionRoutingIntent;
  intentType: ActionIntentType;
  dispatchRecipeId: string;
  gatingProfile: string;
}

export interface ActionDispatchStep {
  action: string;
  onFailure: 'stop' | 'continue';
}

export interface ActionDispatchRecipe {
  id: string;
  steps: ActionDispatchStep[];
  rollbackPolicy: 'none' | 'intent-scoped';
  requiresOptimistic: boolean;
}

export interface ActionRoutingBridgeRequest {
  surface: EntryPointSurface;
  intent: ActionRoutingIntent;
  resolvedContext: ActionRoutingResolvedContext;
  uiPayload: Record<string, unknown>;
  trigger: ActionRoutingTrigger;
}

export interface ActionRoutingCreateNodeInput {
  id: string;
  type: CreatePayload['nodeType'];
  props: Record<string, unknown>;
  placement: CreatePayload['placement'];
}

export interface NormalizedCreateNodePayload {
  kind: 'create-node';
  commandType: 'node.create' | 'mindmap.child.create' | 'mindmap.sibling.create';
  editTarget: EditTarget;
  baseVersion: string;
  nodeType: CreatePayload['nodeType'];
  initialProps: Record<string, unknown>;
  initialContent?: string;
  placement: CreatePayload['placement'];
  createInput: ActionRoutingCreateNodeInput;
  renderedId: string;
}

export interface NormalizedRenameNodePayload {
  kind: 'rename-node';
  commandType: 'node.rename';
  editTarget: EditTarget;
  baseVersion: string;
  previousId: string;
  nextId: string;
}

export interface NormalizedStyleUpdatePayload {
  kind: 'style-update';
  commandType: 'node.style.update';
  editTarget: EditTarget;
  baseVersion: string;
  renderedNodeId: string;
  patch: Record<string, unknown>;
  previousPatch: Record<string, unknown>;
  previousNodeData: Record<string, unknown>;
  targetNode: Node;
}

export type ActionRoutingNormalizedPayload =
  | NormalizedCreateNodePayload
  | NormalizedRenameNodePayload
  | NormalizedStyleUpdatePayload;

export interface ActionRoutingDispatchedAction {
  action: string;
  status: 'applied' | 'skipped' | 'failed';
}

export type ActionRoutingBridgeErrorCode =
  | 'INVALID_INTENT'
  | 'NORMALIZATION_FAILED'
  | 'GATE_BLOCKED'
  | 'PATCH_SURFACE_VIOLATION'
  | 'EXECUTION_FAILED'
  | 'ADOPTION_VIOLATION';

export interface ActionRoutingBridgeResponseError {
  code: ActionRoutingBridgeErrorCode;
  message: string;
  surface: EntryPointSurface;
  intent: ActionRoutingIntent;
  details?: Record<string, unknown>;
  rpcCode?: number;
}

export interface ActionRoutingBridgeResponse {
  dispatchedActions: ActionRoutingDispatchedAction[];
  optimisticToken?: string;
  rollbackToken?: string;
  error?: ActionRoutingBridgeResponseError;
  rawError?: unknown;
}

export interface ActionRoutingRuntimeSnapshot {
  currentFile: string | null;
  sourceVersions: Record<string, string>;
  nodes: Node[];
  selectedNodeIds: string[];
}

export interface ActionRoutingBridgeDependencies {
  runtime: ActionRoutingRuntimeSnapshot;
  updateNode: (
    nodeId: string,
    props: Record<string, unknown>,
    targetFilePath?: string | null,
    options?: UpdateNodeMutationOptions,
  ) => Promise<RpcMutationResult>;
  createNode: (
    node: Record<string, unknown>,
    targetFilePath?: string | null,
  ) => Promise<RpcMutationResult>;
  updateNodeData?: (nodeId: string, partialData: Record<string, unknown>) => void;
  restoreNodeData?: (nodeId: string, previousData: Record<string, unknown>) => void;
  pushEditCompletionEvent?: (event: EditCompletionEvent) => void;
  onFileChange?: () => void;
  setPendingSelectionNodeId?: (nodeId: string) => void;
  createId?: () => string;
  now?: () => number;
}

export interface ActionRoutingGateSuccess {
  patch?: Record<string, unknown>;
}

export interface ActionRoutingGateFailure {
  errorCode: Extract<ActionRoutingBridgeErrorCode, 'GATE_BLOCKED' | 'PATCH_SURFACE_VIOLATION'>;
  details?: Record<string, unknown>;
}

export interface ActionRoutingGateResult {
  ok: boolean;
  value?: ActionRoutingGateSuccess;
  error?: ActionRoutingGateFailure;
}

export interface ActionOptimisticLifecycleEvent {
  phase: 'apply' | 'commit' | 'reject';
  surface: EntryPointSurface;
  intent: ActionRoutingIntent;
  optimisticToken: string;
  rollbackToken?: string;
  reason?: string;
}
