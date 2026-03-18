import {
  buildContentDraftPatch,
  buildContentUpdateCommand,
  buildCreateCommand,
  buildRenameCommand,
  buildStyleUpdateCommand,
  toCreateNodeInput,
  toUpdateNodeProps,
  type CreatePayload,
} from '@/features/editing/commands';
import { createUniqueNodeId, getCreateDefaults } from '@/features/editing/createDefaults';
import {
  getNodeEditMeta,
  isCommandAllowed,
  pickStylePatch,
  type EditCommandType,
  type EditMeta,
} from '@/features/editing/editability';
import {
  createApplyNodePatchStep,
  createOptimisticMeta,
  createRestoreNodeDataStep,
} from '@/features/editing/actionRoutingBridge/optimistic';
import {
  fail,
  ok,
  type ActionRoutingContext,
  type ActionRoutingRegistryEntry,
  type MutationActionPayloadMap,
  type OrderedDispatchPlan,
  type UIIntentEnvelope,
} from '@/features/editing/actionRoutingBridge/types';
import type { Node } from 'reactflow';

type ResolvedTarget = {
  renderedNodeId: string;
  sourceId: string;
  filePath: string;
  scopeId?: string;
  frameScope?: string;
  editMeta?: EditMeta;
  node: Node;
};

type StyleNormalized = {
  target: ResolvedTarget;
  patch: Record<string, unknown>;
  previous: Record<string, unknown>;
  previousData: Record<string, unknown>;
  baseVersion: string;
};

type ContentNormalized = {
  target: ResolvedTarget;
  nextContent: string;
  previousContent: string;
  previousData: Record<string, unknown>;
  baseVersion: string;
};

type RenameNormalized = {
  target: ResolvedTarget;
  previousId: string;
  nextId: string;
  baseVersion: string;
};

type CreateNormalized = {
  targetFile: string;
  sourceId: string;
  scopeId?: string;
  frameScope?: string;
  nodeType: CreatePayload['nodeType'];
  placement: CreatePayload['placement'];
  createInput: ReturnType<typeof toCreateNodeInput>;
  baseVersion: string;
  renderedId: string;
};

type DuplicateNormalized = {
  target: ResolvedTarget;
  targetFile: string;
  sourceId: string;
  scopeId?: string;
  frameScope?: string;
  createInput: MutationActionPayloadMap['node.create']['node'];
  baseVersion: string;
  renderedId: string;
};

type DeleteNormalized = {
  target: ResolvedTarget;
  recreateInput: MutationActionPayloadMap['node.create']['node'];
  baseVersion: string;
};

type LockToggleNormalized = {
  target: ResolvedTarget;
  previousLocked: boolean;
  nextLocked: boolean;
  baseVersion: string;
};

type GroupSelectNormalized = {
  target: ResolvedTarget;
  groupId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deriveLocalSourceId(nodeId: string, frameScope: unknown): string {
  if (typeof frameScope !== 'string' || frameScope.length === 0) {
    return nodeId;
  }
  const prefix = `${frameScope}.`;
  return nodeId.startsWith(prefix) ? nodeId.slice(prefix.length) : nodeId;
}

function resolveRenderedNode(context: ActionRoutingContext, envelope: UIIntentEnvelope): Node | undefined {
  const renderedNodeId = envelope.targetRef?.renderedNodeId;
  if (!renderedNodeId) {
    return undefined;
  }
  return context.nodes.find((node) => node.id === renderedNodeId);
}

function resolveTarget(
  context: ActionRoutingContext,
  envelope: UIIntentEnvelope,
): ResolvedTarget | null {
  const node = resolveRenderedNode(context, envelope);
  if (!node) {
    return null;
  }

  const data = ((node.data || {}) as Record<string, unknown>);
  const sourceMeta = isRecord(data.sourceMeta) ? data.sourceMeta : {};
  const sourceId = typeof sourceMeta.sourceId === 'string' && sourceMeta.sourceId.length > 0
    ? sourceMeta.sourceId
    : deriveLocalSourceId(node.id, sourceMeta.frameScope);
  const filePath = typeof sourceMeta.filePath === 'string' && sourceMeta.filePath.length > 0
    ? sourceMeta.filePath
    : context.currentFile;

  if (!filePath) {
    return null;
  }

  return {
    renderedNodeId: node.id,
    sourceId,
    filePath,
    scopeId: typeof sourceMeta.scopeId === 'string' ? sourceMeta.scopeId : undefined,
    frameScope: typeof sourceMeta.frameScope === 'string' ? sourceMeta.frameScope : undefined,
    editMeta: getNodeEditMeta(node),
    node,
  };
}

function requireBaseVersion(context: ActionRoutingContext, filePath: string) {
  const baseVersion = context.sourceVersions[filePath];
  if (!baseVersion) {
    return fail<string>(
      'OPTIMISTIC_CONFLICT',
      'SOURCE_VERSION_NOT_READY',
      { filePath },
    );
  }
  return ok(baseVersion);
}

function hasMutableTarget(target: ResolvedTarget): boolean {
  return !target.editMeta?.readOnlyReason;
}

function canToggleLock(target: ResolvedTarget): boolean {
  return !target.editMeta?.readOnlyReason || target.editMeta.readOnlyReason === 'LOCKED';
}

function requirePatch(rawPayload: Record<string, unknown>) {
  const patch = rawPayload.patch;
  if (!isRecord(patch)) {
    return fail<Record<string, unknown>>(
      'INTENT_PAYLOAD_INVALID',
      'style patch is required',
    );
  }
  return ok(patch);
}

function requireContent(rawPayload: Record<string, unknown>) {
  const content = rawPayload.content;
  if (typeof content !== 'string') {
    return fail<string>(
      'INTENT_PAYLOAD_INVALID',
      'content must be a string',
    );
  }
  return ok(content);
}

function requireNextId(rawPayload: Record<string, unknown>) {
  const nextId = typeof rawPayload.nextId === 'string' ? rawPayload.nextId.trim() : '';
  if (nextId.length === 0) {
    return fail<string>(
      'INTENT_PAYLOAD_INVALID',
      'nextId is required',
    );
  }
  return ok(nextId);
}

function requireCreatePlacement(rawPayload: Record<string, unknown>): ReturnType<typeof ok<{
  nodeType: CreatePayload['nodeType'];
  placement: CreatePayload['placement'];
}>> | ReturnType<typeof fail<{
  nodeType: CreatePayload['nodeType'];
  placement: CreatePayload['placement'];
}>> {
  const nodeType = rawPayload.nodeType;
  const placement = rawPayload.placement;

  if (
    nodeType !== 'shape'
    && nodeType !== 'text'
    && nodeType !== 'markdown'
    && nodeType !== 'sticky'
    && nodeType !== 'sticker'
    && nodeType !== 'washi-tape'
    && nodeType !== 'image'
  ) {
    return fail<{
      nodeType: CreatePayload['nodeType'];
      placement: CreatePayload['placement'];
    }>('INTENT_PAYLOAD_INVALID', 'nodeType is invalid');
  }

  if (!isRecord(placement) || typeof placement.mode !== 'string') {
    return fail<{
      nodeType: CreatePayload['nodeType'];
      placement: CreatePayload['placement'];
    }>('INTENT_PAYLOAD_INVALID', 'placement is invalid');
  }

  const validNodeType: CreatePayload['nodeType'] = nodeType;
  const casted = placement as Record<string, unknown>;
  if (casted.mode === 'canvas-absolute' && typeof casted.x === 'number' && typeof casted.y === 'number') {
    return ok({
      nodeType: validNodeType,
      placement: {
        mode: 'canvas-absolute',
        x: casted.x,
        y: casted.y,
      },
    });
  }

  if (casted.mode === 'mindmap-child' && typeof casted.parentId === 'string') {
    return ok({
      nodeType: validNodeType,
      placement: {
        mode: 'mindmap-child',
        parentId: casted.parentId,
      },
    });
  }

  if (casted.mode === 'mindmap-sibling' && typeof casted.siblingOf === 'string') {
    return ok({
      nodeType: validNodeType,
      placement: {
        mode: 'mindmap-sibling',
        siblingOf: casted.siblingOf,
        parentId: casted.parentId === null
          ? null
          : typeof casted.parentId === 'string'
            ? casted.parentId
            : null,
      },
    });
  }

  return fail<{
    nodeType: CreatePayload['nodeType'];
    placement: CreatePayload['placement'];
  }>('INTENT_PAYLOAD_INVALID', 'placement is invalid');
}

function buildRenderedNodeId(input: {
  sourceId: string;
  scopeId?: string;
  frameScope?: string;
}): string {
  return [input.scopeId, input.frameScope, input.sourceId]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .join('.') || input.sourceId;
}

function isSupportedCreateNodeType(value: unknown): value is CreatePayload['nodeType'] {
  return value === 'shape'
    || value === 'text'
    || value === 'markdown'
    || value === 'sticky'
    || value === 'sticker'
    || value === 'washi-tape'
    || value === 'image';
}

function resolveNodeContent(node: Node): string | undefined {
  const data = (node.data || {}) as Record<string, unknown>;
  const canonicalObject = isRecord(data.canonicalObject) ? data.canonicalObject : {};
  const capabilities = isRecord(canonicalObject.capabilities) ? canonicalObject.capabilities : {};
  const contentCapability = isRecord(capabilities.content) ? capabilities.content : {};

  if (contentCapability.kind === 'markdown' && typeof contentCapability.source === 'string') {
    return contentCapability.source;
  }

  if (contentCapability.kind === 'text' && typeof contentCapability.value === 'string') {
    return contentCapability.value;
  }

  return typeof data.label === 'string' && data.label.length > 0
    ? data.label
    : undefined;
}

function clonePersistedNodeProps(node: Node): Record<string, unknown> {
  const data = (node.data || {}) as Record<string, unknown>;
  const omittedKeys = new Set([
    'canonicalObject',
    'canonicalValidation',
    'editMeta',
    'groupId',
    'children',
    'resolvedGeometry',
    'seed',
    'sourceMeta',
    'label',
  ]);

  return Object.entries(data).reduce<Record<string, unknown>>((acc, [key, value]) => {
    if (omittedKeys.has(key) || value === undefined) {
      return acc;
    }
    acc[key] = value;
    return acc;
  }, {});
}

function buildCreateInputFromNode(input: {
  target: ResolvedTarget;
  sourceId: string;
  placement: CreatePayload['placement'];
}): MutationActionPayloadMap['node.create']['node'] | null {
  if (!isSupportedCreateNodeType(input.target.node.type)) {
    return null;
  }

  const props = clonePersistedNodeProps(input.target.node);
  const content = resolveNodeContent(input.target.node);

  return {
    id: input.sourceId,
    type: input.target.node.type,
    props: {
      ...props,
      ...(content ? { content } : {}),
    },
    placement: input.placement,
  };
}

function resolveDuplicatePlacement(target: ResolvedTarget): CreatePayload['placement'] {
  const data = (target.node.data || {}) as Record<string, unknown>;
  const canonicalObject = isRecord(data.canonicalObject) ? data.canonicalObject : {};
  const core = isRecord(canonicalObject.core) ? canonicalObject.core : {};
  const relations = isRecord(core.relations) ? core.relations : {};
  const parentSourceId = typeof relations.from === 'string' ? relations.from : null;

  if (target.editMeta?.family === 'mindmap-member') {
    return {
      mode: 'mindmap-sibling',
      siblingOf: target.sourceId,
      parentId: parentSourceId,
    };
  }

  return {
    mode: 'canvas-absolute',
    x: target.node.position.x + 48,
    y: target.node.position.y + 48,
  };
}

function resolveDeleteRecreatePlacement(target: ResolvedTarget): CreatePayload['placement'] | null {
  const data = (target.node.data || {}) as Record<string, unknown>;
  const canonicalObject = isRecord(data.canonicalObject) ? data.canonicalObject : {};
  const core = isRecord(canonicalObject.core) ? canonicalObject.core : {};
  const relations = isRecord(core.relations) ? core.relations : {};
  const parentSourceId = typeof relations.from === 'string' ? relations.from : null;

  if (target.editMeta?.family === 'mindmap-member') {
    return parentSourceId
      ? {
          mode: 'mindmap-child',
          parentId: parentSourceId,
        }
      : null;
  }

  return {
    mode: 'canvas-absolute',
    x: target.node.position.x,
    y: target.node.position.y,
  };
}

function getExistingSourceIds(nodes: Node[]): string[] {
  return nodes.map((node) => {
    const data = (node.data || {}) as Record<string, unknown>;
    const sourceMeta = isRecord(data.sourceMeta) ? data.sourceMeta : {};
    return typeof sourceMeta.sourceId === 'string' && sourceMeta.sourceId.length > 0
      ? sourceMeta.sourceId
      : node.id;
  });
}

function buildStylePlan(input: {
  envelope: UIIntentEnvelope;
  normalized: StyleNormalized;
}): OrderedDispatchPlan {
  const command = buildStyleUpdateCommand({
    target: {
      sourceId: input.normalized.target.sourceId,
      filePath: input.normalized.target.filePath,
      renderedId: input.normalized.target.renderedNodeId,
      editMeta: input.normalized.target.editMeta,
    },
    previous: input.normalized.previous,
    patch: input.normalized.patch,
  });
  const rollbackSteps = [
    createRestoreNodeDataStep({
      nodeId: input.normalized.target.renderedNodeId,
      previousData: input.normalized.previousData,
    }),
  ];
  const optimisticMeta = createOptimisticMeta({
    intentId: input.envelope.intentId,
    surfaceId: input.envelope.surfaceId,
    baseVersion: input.normalized.baseVersion,
    filePath: input.normalized.target.filePath,
    nodeId: input.normalized.target.sourceId,
    rollbackSteps,
  });

  return {
    intentId: input.envelope.intentId,
    steps: [
      createApplyNodePatchStep({
        nodeId: input.normalized.target.renderedNodeId,
        patch: input.normalized.patch,
      }),
      {
        kind: 'canonical-mutation',
        actionId: 'node.update',
        payload: {
          nodeId: command.target.sourceId,
          filePath: command.target.filePath,
          props: toUpdateNodeProps(command),
          commandType: command.type,
        },
        optimisticMeta,
        historyEffect: {
          eventType: 'STYLE_UPDATED',
          nodeId: command.target.sourceId,
          filePath: command.target.filePath,
          baseVersion: input.normalized.baseVersion,
          before: command.payload.previous,
          after: command.payload.patch,
        },
      },
    ],
    rollbackSteps,
  };
}

function buildContentPlan(input: {
  envelope: UIIntentEnvelope;
  normalized: ContentNormalized;
}): OrderedDispatchPlan {
  const targetNode = input.normalized.target.node;
  const command = buildContentUpdateCommand({
    target: {
      sourceId: input.normalized.target.sourceId,
      filePath: input.normalized.target.filePath,
      renderedId: input.normalized.target.renderedNodeId,
      editMeta: input.normalized.target.editMeta,
    },
    carrier: input.normalized.target.editMeta?.contentCarrier
      ?? (targetNode.type === 'markdown' ? 'markdown-child' : 'text-child'),
    previousContent: input.normalized.previousContent,
    nextContent: input.normalized.nextContent,
  });
  const rollbackSteps = [
    createRestoreNodeDataStep({
      nodeId: input.normalized.target.renderedNodeId,
      previousData: input.normalized.previousData,
    }),
  ];
  const optimisticMeta = createOptimisticMeta({
    intentId: input.envelope.intentId,
    surfaceId: input.envelope.surfaceId,
    baseVersion: input.normalized.baseVersion,
    filePath: input.normalized.target.filePath,
    nodeId: input.normalized.target.sourceId,
    rollbackSteps,
  });

  return {
    intentId: input.envelope.intentId,
    steps: [
      createApplyNodePatchStep({
        nodeId: input.normalized.target.renderedNodeId,
        patch: buildContentDraftPatch(
          input.normalized.target.node.type,
          input.normalized.nextContent,
        ),
      }),
      {
        kind: 'canonical-mutation',
        actionId: 'node.update',
        payload: {
          nodeId: command.target.sourceId,
          filePath: command.target.filePath,
          props: toUpdateNodeProps(command),
          commandType: command.type,
        },
        optimisticMeta,
        historyEffect: {
          eventType: 'CONTENT_UPDATED',
          nodeId: command.target.sourceId,
          filePath: command.target.filePath,
          baseVersion: input.normalized.baseVersion,
          before: command.payload.previous,
          after: command.payload.next,
        },
      },
    ],
    rollbackSteps,
  };
}

function buildRenamePlan(input: {
  envelope: UIIntentEnvelope;
  normalized: RenameNormalized;
}): OrderedDispatchPlan {
  const command = buildRenameCommand({
    target: {
      sourceId: input.normalized.target.sourceId,
      filePath: input.normalized.target.filePath,
      renderedId: input.normalized.target.renderedNodeId,
      editMeta: input.normalized.target.editMeta,
    },
    previousId: input.normalized.previousId,
    nextId: input.normalized.nextId,
  });

  return {
    intentId: input.envelope.intentId,
    steps: [
      {
        kind: 'canonical-mutation',
        actionId: 'node.update',
        payload: {
          nodeId: command.target.sourceId,
          filePath: command.target.filePath,
          props: toUpdateNodeProps(command),
          commandType: command.type,
        },
        historyEffect: {
          eventType: 'NODE_RENAMED',
          nodeId: command.target.sourceId,
          filePath: command.target.filePath,
          baseVersion: input.normalized.baseVersion,
          before: command.payload.previous,
          after: command.payload.next,
          reloadGraphOnSuccess: true,
        },
      },
    ],
    rollbackSteps: [],
  };
}

function buildCreatePlan(input: {
  normalized: CreateNormalized;
  intentId: string;
}): OrderedDispatchPlan {
  return {
    intentId: input.intentId,
    steps: [
      {
        kind: 'canonical-mutation',
        actionId: 'node.create',
        payload: {
          filePath: input.normalized.targetFile,
          node: input.normalized.createInput,
        },
        historyEffect: {
          eventType: 'NODE_CREATED',
          nodeId: input.normalized.sourceId,
          filePath: input.normalized.targetFile,
          baseVersion: input.normalized.baseVersion,
          before: { created: false },
          after: {
            create: input.normalized.createInput,
            renderedId: input.normalized.renderedId,
          },
          reloadGraphOnSuccess: true,
          pendingSelectionRenderedId: input.normalized.renderedId,
        },
      },
    ],
    rollbackSteps: [],
  };
}

function buildDuplicatePlan(input: {
  envelope: UIIntentEnvelope;
  normalized: DuplicateNormalized;
}): OrderedDispatchPlan {
  return {
    intentId: input.envelope.intentId,
    steps: [
      {
        kind: 'canonical-mutation',
        actionId: 'node.create',
        payload: {
          filePath: input.normalized.targetFile,
          node: input.normalized.createInput,
        },
        historyEffect: {
          eventType: 'NODE_CREATED',
          nodeId: input.normalized.sourceId,
          filePath: input.normalized.targetFile,
          baseVersion: input.normalized.baseVersion,
          before: { created: false },
          after: {
            create: input.normalized.createInput,
            renderedId: input.normalized.renderedId,
          },
          reloadGraphOnSuccess: true,
          pendingSelectionRenderedId: input.normalized.renderedId,
        },
      },
    ],
    rollbackSteps: [],
  };
}

function buildDeletePlan(input: {
  envelope: UIIntentEnvelope;
  normalized: DeleteNormalized;
}): OrderedDispatchPlan {
  return {
    intentId: input.envelope.intentId,
    steps: [
      {
        kind: 'canonical-mutation',
        actionId: 'node.delete',
        payload: {
          nodeId: input.normalized.target.sourceId,
          filePath: input.normalized.target.filePath,
        },
        historyEffect: {
          eventType: 'NODE_DELETED',
          nodeId: input.normalized.target.sourceId,
          filePath: input.normalized.target.filePath,
          baseVersion: input.normalized.baseVersion,
          before: {
            create: input.normalized.recreateInput,
          },
          after: {
            deleted: true,
          },
          reloadGraphOnSuccess: true,
        },
      },
    ],
    rollbackSteps: [],
  };
}

function buildLockTogglePlan(input: {
  envelope: UIIntentEnvelope;
  normalized: LockToggleNormalized;
}): OrderedDispatchPlan {
  return {
    intentId: input.envelope.intentId,
    steps: [
      {
        kind: 'canonical-mutation',
        actionId: 'node.update',
        payload: {
          nodeId: input.normalized.target.sourceId,
          filePath: input.normalized.target.filePath,
          props: {
            locked: input.normalized.nextLocked,
          },
        },
        historyEffect: {
          eventType: 'NODE_LOCK_TOGGLED',
          nodeId: input.normalized.target.sourceId,
          filePath: input.normalized.target.filePath,
          baseVersion: input.normalized.baseVersion,
          before: {
            locked: input.normalized.previousLocked,
          },
          after: {
            locked: input.normalized.nextLocked,
          },
          reloadGraphOnSuccess: true,
        },
      },
    ],
    rollbackSteps: [],
  };
}

function buildGroupSelectPlan(input: {
  envelope: UIIntentEnvelope;
  normalized: GroupSelectNormalized;
}): OrderedDispatchPlan {
  return {
    intentId: input.envelope.intentId,
    steps: [
      {
        kind: 'runtime-only-action',
        actionId: 'select-node-group',
        payload: {
          groupId: input.normalized.groupId,
          anchorNodeId: input.normalized.target.renderedNodeId,
        },
      },
    ],
    rollbackSteps: [],
  };
}

const styleUpdateEntry: ActionRoutingRegistryEntry<StyleNormalized> = {
  intentId: 'selection.style.update',
  supportedSurfaces: ['selection-floating-menu'],
  isEnabled: ({ envelope, context }) => {
    const target = resolveTarget(context, envelope);
    if (!target) {
      return fail('INTENT_GATING_DENIED', 'editable target is required');
    }
    if (!isCommandAllowed(target.editMeta, 'node.style.update')) {
      return fail('INTENT_GATING_DENIED', 'style update is not allowed', {
        nodeId: target.renderedNodeId,
      });
    }
    return ok(true);
  },
  normalizePayload: ({ envelope, context }) => {
    const target = resolveTarget(context, envelope);
    if (!target) {
      return fail('INTENT_PAYLOAD_INVALID', 'target node is required');
    }
    const patchResult = requirePatch(envelope.rawPayload);
    if (!patchResult.ok) {
      return patchResult;
    }
    const previousData = ((target.node.data || {}) as Record<string, unknown>);
    const { allowedPatch, rejectedKeys } = pickStylePatch(
      patchResult.value,
      target.editMeta?.styleEditableKeys ?? [],
    );
    if (rejectedKeys.length > 0 || Object.keys(allowedPatch).length === 0) {
      return fail('INTENT_PAYLOAD_INVALID', 'style patch contains disallowed keys', {
        rejectedKeys,
      });
    }
    const previous = Object.keys(allowedPatch).reduce<Record<string, unknown>>((acc, key) => {
      if (key in previousData) {
        acc[key] = previousData[key];
      }
      return acc;
    }, {});
    const versionResult = requireBaseVersion(context, target.filePath);
    if (!versionResult.ok) {
      return versionResult;
    }
    return ok({
      target,
      patch: allowedPatch,
      previous,
      previousData,
      baseVersion: versionResult.value,
    });
  },
  buildDispatch: ({ envelope, normalized }) => ok(buildStylePlan({ envelope, normalized })),
};

const contentUpdateEntry: ActionRoutingRegistryEntry<ContentNormalized> = {
  intentId: 'selection.content.update',
  supportedSurfaces: ['selection-floating-menu'],
  isEnabled: ({ envelope, context }) => {
    const target = resolveTarget(context, envelope);
    if (!target) {
      return fail('INTENT_GATING_DENIED', 'editable target is required');
    }
    if (!isCommandAllowed(target.editMeta, 'node.content.update')) {
      return fail('INTENT_GATING_DENIED', 'content update is not allowed', {
        nodeId: target.renderedNodeId,
      });
    }
    return ok(true);
  },
  normalizePayload: ({ envelope, context }) => {
    const target = resolveTarget(context, envelope);
    if (!target) {
      return fail('INTENT_PAYLOAD_INVALID', 'target node is required');
    }
    const contentResult = requireContent(envelope.rawPayload);
    if (!contentResult.ok) {
      return contentResult;
    }
    const previousData = ((target.node.data || {}) as Record<string, unknown>);
    const previousContent = typeof previousData.label === 'string' ? previousData.label : '';
    const versionResult = requireBaseVersion(context, target.filePath);
    if (!versionResult.ok) {
      return versionResult;
    }
    return ok({
      target,
      nextContent: contentResult.value,
      previousContent,
      previousData,
      baseVersion: versionResult.value,
    });
  },
  buildDispatch: ({ envelope, normalized }) => ok(buildContentPlan({ envelope, normalized })),
};

const renameEntry: ActionRoutingRegistryEntry<RenameNormalized> = {
  intentId: 'node.rename',
  supportedSurfaces: ['node-context-menu'],
  isEnabled: ({ envelope, context }) => {
    const target = resolveTarget(context, envelope);
    if (!target) {
      return fail('INTENT_GATING_DENIED', 'editable target is required');
    }
    if (!isCommandAllowed(target.editMeta, 'node.rename')) {
      return fail('INTENT_GATING_DENIED', 'rename is not allowed', {
        nodeId: target.renderedNodeId,
      });
    }
    return ok(true);
  },
  normalizePayload: ({ envelope, context }) => {
    const target = resolveTarget(context, envelope);
    if (!target) {
      return fail('INTENT_PAYLOAD_INVALID', 'target node is required');
    }
    const nextIdResult = requireNextId(envelope.rawPayload);
    if (!nextIdResult.ok) {
      return nextIdResult;
    }
    if (nextIdResult.value === target.sourceId) {
      return fail('INTENT_PAYLOAD_INVALID', 'nextId must differ from the current id');
    }
    const versionResult = requireBaseVersion(context, target.filePath);
    if (!versionResult.ok) {
      return versionResult;
    }
    return ok({
      target,
      previousId: target.sourceId,
      nextId: nextIdResult.value,
      baseVersion: versionResult.value,
    });
  },
  buildDispatch: ({ envelope, normalized }) => ok(buildRenamePlan({ envelope, normalized })),
};

const createEntry: ActionRoutingRegistryEntry<CreateNormalized> = {
  intentId: 'node.create',
  supportedSurfaces: ['toolbar', 'pane-context-menu', 'node-context-menu'],
  isEnabled: ({ envelope, context }) => {
    const createResult = requireCreatePlacement(envelope.rawPayload);
    if (!createResult.ok) {
      return createResult;
    }
    const { placement } = createResult.value;
    if (placement.mode === 'canvas-absolute') {
      return ok(true);
    }

    const target = resolveTarget(context, envelope);
    if (!target) {
      return fail('INTENT_GATING_DENIED', 'mindmap target is required');
    }

    const commandType: EditCommandType = placement.mode === 'mindmap-child'
      ? 'mindmap.child.create'
      : 'mindmap.sibling.create';
    if (!isCommandAllowed(target.editMeta, commandType)) {
      return fail('INTENT_GATING_DENIED', 'mindmap create is not allowed', {
        nodeId: target.renderedNodeId,
        commandType,
      });
    }
    return ok(true);
  },
  normalizePayload: ({ envelope, context }) => {
    const createResult = requireCreatePlacement(envelope.rawPayload);
    if (!createResult.ok) {
      return createResult;
    }
    const target = resolveTarget(context, envelope);
    const targetFile = envelope.targetRef?.filePath
      ?? target?.filePath
      ?? context.currentFile;
    if (!targetFile) {
      return fail('INTENT_PAYLOAD_INVALID', 'target file is required');
    }
    const versionResult = requireBaseVersion(context, targetFile);
    if (!versionResult.ok) {
      return versionResult;
    }
    const nextId = createUniqueNodeId(
      createResult.value.nodeType,
      getExistingSourceIds(context.nodes),
    );
    const defaults = getCreateDefaults(createResult.value.nodeType);
    const command = buildCreateCommand({
      type: createResult.value.placement.mode === 'canvas-absolute'
        ? 'node.create'
        : createResult.value.placement.mode === 'mindmap-child'
          ? 'mindmap.child.create'
          : 'mindmap.sibling.create',
      target: {
        sourceId: nextId,
        filePath: targetFile,
        scopeId: envelope.targetRef?.scopeId ?? target?.scopeId,
        frameScope: envelope.targetRef?.frameScope ?? target?.frameScope,
      },
      payload: {
        nodeType: createResult.value.nodeType,
        id: nextId,
        initialProps: defaults.initialProps,
        initialContent: defaults.initialContent,
        placement: createResult.value.placement,
      },
    });
    const renderedId = buildRenderedNodeId({
      sourceId: nextId,
      scopeId: envelope.targetRef?.scopeId ?? target?.scopeId,
      frameScope: envelope.targetRef?.frameScope ?? target?.frameScope,
    });
    return ok({
      targetFile,
      sourceId: nextId,
      scopeId: envelope.targetRef?.scopeId ?? target?.scopeId,
      frameScope: envelope.targetRef?.frameScope ?? target?.frameScope,
      nodeType: createResult.value.nodeType,
      placement: createResult.value.placement,
      createInput: toCreateNodeInput(command),
      baseVersion: versionResult.value,
      renderedId,
    });
  },
  buildDispatch: ({ envelope, normalized }) => ok(buildCreatePlan({
    normalized,
    intentId: envelope.intentId,
  })),
};

const fitViewEntry: ActionRoutingRegistryEntry<Record<string, never>> = {
  intentId: 'pane.fit-view',
  supportedSurfaces: ['pane-context-menu'],
  isEnabled: () => ok(true),
  normalizePayload: () => ok({}),
  buildDispatch: ({ envelope }) => ok({
    intentId: envelope.intentId,
    steps: [
      {
        kind: 'runtime-only-action',
        actionId: 'fit-view',
        payload: {},
      },
    ],
    rollbackSteps: [],
  }),
};

const duplicateEntry: ActionRoutingRegistryEntry<DuplicateNormalized> = {
  intentId: 'node.duplicate',
  supportedSurfaces: ['node-context-menu'],
  isEnabled: ({ envelope, context }) => {
    const target = resolveTarget(context, envelope);
    if (!target) {
      return fail('INTENT_GATING_DENIED', 'duplicable target is required');
    }
    if (!hasMutableTarget(target)) {
      return fail('INTENT_GATING_DENIED', 'duplicate is not allowed', {
        nodeId: target.renderedNodeId,
        reason: target.editMeta?.readOnlyReason,
      });
    }
    if (!isSupportedCreateNodeType(target.node.type)) {
      return fail('INTENT_GATING_DENIED', 'duplicate is not supported for this node type', {
        nodeId: target.renderedNodeId,
        nodeType: target.node.type,
      });
    }
    return ok(true);
  },
  normalizePayload: ({ envelope, context }) => {
    const target = resolveTarget(context, envelope);
    if (!target) {
      return fail('INTENT_PAYLOAD_INVALID', 'target node is required');
    }
    const versionResult = requireBaseVersion(context, target.filePath);
    if (!versionResult.ok) {
      return versionResult;
    }
    const placement = resolveDuplicatePlacement(target);
    const nextId = createUniqueNodeId(
      target.node.type as CreatePayload['nodeType'],
      getExistingSourceIds(context.nodes),
      target.sourceId,
    );
    const createInput = buildCreateInputFromNode({
      target,
      sourceId: nextId,
      placement,
    });
    if (!createInput) {
      return fail('INTENT_PAYLOAD_INVALID', 'duplicate is not supported for this node type', {
        nodeType: target.node.type,
      });
    }
    const renderedId = buildRenderedNodeId({
      sourceId: nextId,
      scopeId: target.scopeId,
      frameScope: target.frameScope,
    });
    return ok({
      target,
      targetFile: target.filePath,
      sourceId: nextId,
      scopeId: target.scopeId,
      frameScope: target.frameScope,
      createInput,
      baseVersion: versionResult.value,
      renderedId,
    });
  },
  buildDispatch: ({ envelope, normalized }) => ok(buildDuplicatePlan({ envelope, normalized })),
};

const deleteEntry: ActionRoutingRegistryEntry<DeleteNormalized> = {
  intentId: 'node.delete',
  supportedSurfaces: ['node-context-menu'],
  isEnabled: ({ envelope, context }) => {
    const target = resolveTarget(context, envelope);
    if (!target) {
      return fail('INTENT_GATING_DENIED', 'deletable target is required');
    }
    if (!hasMutableTarget(target)) {
      return fail('INTENT_GATING_DENIED', 'delete is not allowed', {
        nodeId: target.renderedNodeId,
        reason: target.editMeta?.readOnlyReason,
      });
    }
    if (!resolveDeleteRecreatePlacement(target)) {
      return fail('INTENT_GATING_DENIED', 'delete is not supported for this structural context', {
        nodeId: target.renderedNodeId,
      });
    }
    return ok(true);
  },
  normalizePayload: ({ envelope, context }) => {
    const target = resolveTarget(context, envelope);
    if (!target) {
      return fail('INTENT_PAYLOAD_INVALID', 'target node is required');
    }
    const versionResult = requireBaseVersion(context, target.filePath);
    if (!versionResult.ok) {
      return versionResult;
    }
    const placement = resolveDeleteRecreatePlacement(target);
    if (!placement) {
      return fail('INTENT_PAYLOAD_INVALID', 'delete rollback snapshot is not supported for this structural context', {
        nodeType: target.node.type,
      });
    }
    const recreateInput = buildCreateInputFromNode({
      target,
      sourceId: target.sourceId,
      placement,
    });
    if (!recreateInput) {
      return fail('INTENT_PAYLOAD_INVALID', 'delete rollback snapshot is not supported for this node type', {
        nodeType: target.node.type,
      });
    }
    return ok({
      target,
      recreateInput,
      baseVersion: versionResult.value,
    });
  },
  buildDispatch: ({ envelope, normalized }) => ok(buildDeletePlan({ envelope, normalized })),
};

const lockToggleEntry: ActionRoutingRegistryEntry<LockToggleNormalized> = {
  intentId: 'node.lock.toggle',
  supportedSurfaces: ['node-context-menu'],
  isEnabled: ({ envelope, context }) => {
    const target = resolveTarget(context, envelope);
    if (!target) {
      return fail('INTENT_GATING_DENIED', 'lock target is required');
    }
    if (!canToggleLock(target)) {
      return fail('INTENT_GATING_DENIED', 'lock toggle is not allowed', {
        nodeId: target.renderedNodeId,
        reason: target.editMeta?.readOnlyReason,
      });
    }
    return ok(true);
  },
  normalizePayload: ({ envelope, context }) => {
    const target = resolveTarget(context, envelope);
    if (!target) {
      return fail('INTENT_PAYLOAD_INVALID', 'target node is required');
    }
    const versionResult = requireBaseVersion(context, target.filePath);
    if (!versionResult.ok) {
      return versionResult;
    }
    const previousLocked = ((target.node.data || {}) as Record<string, unknown>).locked === true;
    return ok({
      target,
      previousLocked,
      nextLocked: !previousLocked,
      baseVersion: versionResult.value,
    });
  },
  buildDispatch: ({ envelope, normalized }) => ok(buildLockTogglePlan({ envelope, normalized })),
};

const groupSelectEntry: ActionRoutingRegistryEntry<GroupSelectNormalized> = {
  intentId: 'node.group.select',
  supportedSurfaces: ['node-context-menu'],
  isEnabled: ({ envelope, context }) => {
    const target = resolveTarget(context, envelope);
    if (!target) {
      return fail('INTENT_GATING_DENIED', 'group target is required');
    }
    const groupId = ((target.node.data || {}) as Record<string, unknown>).groupId;
    if (typeof groupId !== 'string' || groupId.length === 0) {
      return fail('INTENT_GATING_DENIED', 'group context is required', {
        nodeId: target.renderedNodeId,
      });
    }
    return ok(true);
  },
  normalizePayload: ({ envelope, context }) => {
    const target = resolveTarget(context, envelope);
    if (!target) {
      return fail('INTENT_PAYLOAD_INVALID', 'target node is required');
    }
    const groupId = ((target.node.data || {}) as Record<string, unknown>).groupId;
    if (typeof groupId !== 'string' || groupId.length === 0) {
      return fail('INTENT_PAYLOAD_INVALID', 'group context is required');
    }
    return ok({
      target,
      groupId,
    });
  },
  buildDispatch: ({ envelope, normalized }) => ok(buildGroupSelectPlan({ envelope, normalized })),
};

export function createActionRoutingRegistry(): Record<string, ActionRoutingRegistryEntry> {
  return {
    [styleUpdateEntry.intentId]: styleUpdateEntry,
    [contentUpdateEntry.intentId]: contentUpdateEntry,
    [renameEntry.intentId]: renameEntry,
    [createEntry.intentId]: createEntry,
    [duplicateEntry.intentId]: duplicateEntry,
    [deleteEntry.intentId]: deleteEntry,
    [lockToggleEntry.intentId]: lockToggleEntry,
    [groupSelectEntry.intentId]: groupSelectEntry,
    [fitViewEntry.intentId]: fitViewEntry,
  };
}
