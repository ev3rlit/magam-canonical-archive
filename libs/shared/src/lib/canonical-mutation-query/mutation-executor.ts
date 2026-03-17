import {
  cloneContentBlocks,
  isNamespacedCustomBlockType,
  readContentBlocks,
  type CanonicalObjectRecord,
  type ContentBlock,
} from '../canonical-object-contract';
import { deriveCanonicalText, derivePrimaryContentKind } from '../canonical-persistence/mappers';
import {
  isEditableNoteLikeRecord,
  validateCanonicalObjectRecord,
  validateContentBlocks,
} from '../canonical-persistence/validators';
import type { PersistenceFailure, PersistenceResult } from '../canonical-persistence/records';
import type {
  AppliedOperationSummary,
  CanonicalMutationEnvelope,
  CanonicalMutationRepository,
  CanonicalMutationResultEnvelope,
  MutationChangedSet,
  MutationFailure,
  MutationFailureCode,
  MutationOperation,
} from './contracts';
import { validateCanonicalMutationEnvelope } from './validators';

type BlockMap = Map<string, ContentBlock>;

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toFailure(
  code: MutationFailureCode,
  message: string,
  path?: string,
  details?: Record<string, unknown>,
): MutationFailure {
  return {
    code,
    message,
    ...(path ? { path } : {}),
    ...(details ? { details } : {}),
  };
}

function mapPersistenceFailure(failure: PersistenceFailure): MutationFailure {
  const knownCodes = new Set<MutationFailureCode>([
    'INVALID_CAPABILITY',
    'INVALID_CAPABILITY_PAYLOAD',
    'CONTENT_CONTRACT_VIOLATION',
    'INVALID_CONTENT_BLOCK',
    'CONTENT_BODY_CONFLICT',
    'EDITABLE_OBJECT_REQUIRES_CLONE',
    'PATCH_SURFACE_VIOLATION',
    'RELATION_ENDPOINT_MISSING',
    'CANONICAL_CANVAS_BOUNDARY_VIOLATION',
    'CANONICAL_RECORD_NOT_FOUND',
    'CANONICAL_RECORD_TOMBSTONED',
    'VERSION_BASE_REQUIRED',
    'VERSION_CONFLICT',
    'INVALID_REVISION_TOKEN',
    'REVISION_APPEND_FAILED',
  ]);

  const code = knownCodes.has(failure.code as MutationFailureCode)
    ? (failure.code as MutationFailureCode)
    : 'INTERNAL_MUTATION_ERROR';

  return toFailure(
    code,
    failure.message,
    failure.path,
    failure.details
      ? { ...failure.details, persistenceCode: failure.code }
      : { persistenceCode: failure.code },
  );
}

function collectBlockIds(blocks: readonly ContentBlock[]): BlockMap {
  return new Map(blocks.map((block) => [block.id, block]));
}

function mergeContentBlock(existing: ContentBlock, patch: Partial<ContentBlock>): ContentBlock {
  const patchRecord = patch as Record<string, unknown>;
  const nextId = hasNonEmptyString(patchRecord.id) ? patchRecord.id : existing.id;
  const nextType = hasNonEmptyString(patchRecord.blockType) ? patchRecord.blockType : existing.blockType;

  if (nextType === 'text') {
    const nextText = typeof patchRecord.text === 'string'
      ? patchRecord.text
      : existing.blockType === 'text'
        ? existing.text
        : '';
    return { id: nextId, blockType: 'text', text: nextText };
  }

  if (nextType === 'markdown') {
    const nextSource = typeof patchRecord.source === 'string'
      ? patchRecord.source
      : existing.blockType === 'markdown'
        ? existing.source
        : '';
    return { id: nextId, blockType: 'markdown', source: nextSource };
  }

  if (!isNamespacedCustomBlockType(nextType)) {
    return existing;
  }

  const nextPayload = isRecord(patchRecord.payload)
    ? patchRecord.payload
    : existing.blockType !== 'text' && existing.blockType !== 'markdown'
      ? existing.payload
      : {};

  const nextTextualProjection = typeof patchRecord.textualProjection === 'string'
    ? patchRecord.textualProjection
    : existing.blockType !== 'text' && existing.blockType !== 'markdown'
      ? existing.textualProjection
      : undefined;

  const nextMetadata = isRecord(patchRecord.metadata)
    ? patchRecord.metadata
    : existing.blockType !== 'text' && existing.blockType !== 'markdown'
      ? existing.metadata
      : undefined;

  return {
    id: nextId,
    blockType: nextType,
    payload: nextPayload,
    ...(nextTextualProjection !== undefined ? { textualProjection: nextTextualProjection } : {}),
    ...(nextMetadata !== undefined ? { metadata: nextMetadata } : {}),
  };
}

function ensureBlockOrder(order: string[], blocks: ContentBlock[]): MutationFailure | null {
  if (order.length !== blocks.length) {
    return toFailure('INVALID_CONTENT_BLOCK', 'reorder list length must match current contentBlocks length.', 'operations.order');
  }

  const requested = new Set(order);
  if (requested.size !== order.length) {
    return toFailure('INVALID_CONTENT_BLOCK', 'reorder list must not contain duplicate block ids.', 'operations.order');
  }

  const currentIds = new Set(blocks.map((block) => block.id));
  for (const id of order) {
    if (!currentIds.has(id)) {
      return toFailure('INVALID_CONTENT_BLOCK', `reorder id ${id} does not exist in contentBlocks.`, 'operations.order');
    }
  }

  return null;
}

function ensureRevisionTokenShape(token: string): boolean {
  const parts = token.split(':');
  return parts.length === 4
    && parts[0] === 'rev'
    && hasNonEmptyString(parts[1])
    && /^\d+$/.test(parts[2] ?? '')
    && hasNonEmptyString(parts[3]);
}

function createRevisionToken(input: {
  documentId: string;
  revisionNo: number;
  revisionId: string;
}): string {
  return `rev:${input.documentId}:${input.revisionNo}:${input.revisionId}`;
}

export class CanonicalMutationExecutor {
  constructor(private readonly repository: CanonicalMutationRepository) {}

  async execute(envelope: CanonicalMutationEnvelope): Promise<CanonicalMutationResultEnvelope> {
    const envelopeValidation = validateCanonicalMutationEnvelope(envelope);
    if (!envelopeValidation.ok) {
      return { ok: false, ...envelopeValidation.error };
    }

    let beforeRevision = createRevisionToken({
      documentId: envelope.documentId,
      revisionNo: 0,
      revisionId: 'initial',
    });
    let beforeRevisionNo = 0;

    if (this.repository.ensureBaseRevision) {
      const ensured = await this.repository.ensureBaseRevision(envelope.documentId, envelope.baseRevision);
      if (!ensured.ok) {
        return { ok: false, ...mapPersistenceFailure(ensured) };
      }
      beforeRevision = ensured.value.headRevision;
      beforeRevisionNo = ensured.value.revisionNo;
    } else {
      if (!ensureRevisionTokenShape(envelope.baseRevision)) {
        return {
          ok: false,
          ...toFailure(
            'INVALID_REVISION_TOKEN',
            'baseRevision must follow rev:<documentId>:<revisionNo>:<revisionId> format.',
            'baseRevision',
          ),
        };
      }

      const revisionState = await this.repository.getRevisionState(envelope.documentId);
      beforeRevision = revisionState?.headRevision ?? beforeRevision;
      beforeRevisionNo = revisionState?.revisionNo ?? beforeRevisionNo;

      if (beforeRevision !== envelope.baseRevision) {
        return {
          ok: false,
          ...toFailure(
            'VERSION_CONFLICT',
            'baseRevision does not match current head revision.',
            'baseRevision',
            { expected: envelope.baseRevision, actual: beforeRevision },
          ),
        };
      }
    }

    const objectCache = new Map<string, CanonicalObjectRecord>();
    const appliedOperations: AppliedOperationSummary[] = [];
    const changedObjectIds = new Set<string>();
    const changedRelationIds = new Set<string>();
    const changedCanvasNodeIds = new Set<string>();

    const loadObject = async (objectId: string): Promise<PersistenceResult<CanonicalObjectRecord>> => {
      const cached = objectCache.get(objectId);
      if (cached) {
        return { ok: true, value: cached };
      }

      const result = await this.repository.getCanonicalObject(envelope.workspaceId, objectId);
      if (result.ok) {
        objectCache.set(objectId, result.value);
      }
      return result;
    };

    const saveObject = async (record: CanonicalObjectRecord): Promise<PersistenceResult<CanonicalObjectRecord>> => {
      const validation = validateCanonicalObjectRecord(record);
      if (!validation.ok) {
        return validation;
      }

      const upserted = await this.repository.upsertCanonicalObject(validation.value);
      if (upserted.ok) {
        objectCache.set(upserted.value.id, upserted.value);
      }
      return upserted;
    };

    for (let index = 0; index < envelope.operations.length; index += 1) {
      const operation = envelope.operations[index];
      const result = await this.applyOperation({
        envelope,
        operation,
        loadObject,
        saveObject,
        changedObjectIds,
        changedRelationIds,
        changedCanvasNodeIds,
      });

      if (!result.ok) {
        return { ok: false, ...result.error };
      }

      appliedOperations.push({
        index,
        op: operation.op,
        ...(operation.operationId ? { operationId: operation.operationId } : {}),
      });
    }

    const nextRevisionNo = beforeRevisionNo + 1;
    const nextRevisionId = `rev-${nextRevisionNo}`;
    const afterRevision = createRevisionToken({
      documentId: envelope.documentId,
      revisionNo: nextRevisionNo,
      revisionId: nextRevisionId,
    });
    const appendResult = await this.repository.appendDocumentRevision({
      id: nextRevisionId,
      documentId: envelope.documentId,
      revisionNo: nextRevisionNo,
      authorKind: envelope.actor.kind,
      authorId: envelope.actor.id,
      mutationBatch: {
        requestId: envelope.requestId ?? null,
        operations: envelope.operations.map((operation) => ({
          op: operation.op,
          operationId: operation.operationId ?? null,
        })),
      },
      snapshotRef: null,
    });

    if (!appendResult.ok) {
      return {
        ok: false,
        ...toFailure(
          'REVISION_APPEND_FAILED',
          appendResult.message,
          appendResult.path,
          appendResult.details
            ? { ...appendResult.details, persistenceCode: appendResult.code }
            : { persistenceCode: appendResult.code },
        ),
      };
    }

    const changedSet: MutationChangedSet = {
      objectIds: Array.from(changedObjectIds).sort(),
      relationIds: Array.from(changedRelationIds).sort(),
      canvasNodeIds: Array.from(changedCanvasNodeIds).sort(),
    };

    return {
      ok: true,
      appliedOperations,
      changedSet,
      revision: {
        before: beforeRevision,
        after: afterRevision,
      },
    };
  }

  private async applyOperation(input: {
    envelope: CanonicalMutationEnvelope;
    operation: MutationOperation;
    loadObject: (objectId: string) => Promise<PersistenceResult<CanonicalObjectRecord>>;
    saveObject: (record: CanonicalObjectRecord) => Promise<PersistenceResult<CanonicalObjectRecord>>;
    changedObjectIds: Set<string>;
    changedRelationIds: Set<string>;
    changedCanvasNodeIds: Set<string>;
  }): Promise<ValidationResult<void, MutationFailure>> {
    const {
      envelope,
      operation,
      loadObject,
      saveObject,
      changedObjectIds,
      changedRelationIds,
      changedCanvasNodeIds,
    } = input;

    if (operation.op === 'object.create') {
      if (!this.repository.createCanonicalObject) {
        return {
          ok: false,
          error: toFailure('INVALID_MUTATION_OPERATION', 'Repository does not support object.create.', 'operations'),
        };
      }

      if (
        operation.input.operation
        && operation.input.operation !== 'create'
        && isEditableNoteLikeRecord(operation.input.record)
        && (!hasNonEmptyString(operation.sourceId) || operation.sourceId === operation.input.record.id)
      ) {
        return {
          ok: false,
          error: toFailure(
            'EDITABLE_OBJECT_REQUIRES_CLONE',
            'Editable note-like duplicate/import operations require a distinct clone source id.',
            'operations.sourceId',
          ),
        };
      }

      const created = await this.repository.createCanonicalObject(operation.input);
      if (!created.ok) {
        return { ok: false, error: mapPersistenceFailure(created) };
      }

      changedObjectIds.add(created.value.id);
      return { ok: true, value: undefined };
    }

    if (operation.op === 'object.update-core') {
      const existing = await loadObject(operation.objectId);
      if (!existing.ok) {
        return { ok: false, error: mapPersistenceFailure(existing) };
      }

      const next: CanonicalObjectRecord = {
        ...existing.value,
        ...operation.patch,
      };
      const upserted = await saveObject(next);
      if (!upserted.ok) {
        return { ok: false, error: mapPersistenceFailure(upserted) };
      }

      changedObjectIds.add(operation.objectId);
      return { ok: true, value: undefined };
    }

    if (operation.op === 'object.update-content') {
      const existing = await loadObject(operation.objectId);
      if (!existing.ok) {
        return { ok: false, error: mapPersistenceFailure(existing) };
      }

      if ((readContentBlocks(existing.value)?.length ?? 0) > 0) {
        return {
          ok: false,
          error: toFailure(
            'CONTENT_BODY_CONFLICT',
            'object.update-content cannot target objects that already own contentBlocks.',
            'operations.content',
          ),
        };
      }

      const next: CanonicalObjectRecord = {
        ...existing.value,
        capabilities: {
          ...existing.value.capabilities,
          content: operation.content,
        },
        primaryContentKind: derivePrimaryContentKind({
          capabilities: { content: operation.content },
        }),
        canonicalText: deriveCanonicalText({
          capabilities: { content: operation.content },
        }),
      };

      const upserted = await saveObject(next);
      if (!upserted.ok) {
        return { ok: false, error: mapPersistenceFailure(upserted) };
      }

      changedObjectIds.add(operation.objectId);
      return { ok: true, value: undefined };
    }

    if (operation.op === 'object.patch-capability') {
      const existing = await loadObject(operation.objectId);
      if (!existing.ok) {
        return { ok: false, error: mapPersistenceFailure(existing) };
      }

      const nextCapabilities = {
        ...existing.value.capabilities,
        ...operation.patch,
      };

      const next: CanonicalObjectRecord = {
        ...existing.value,
        capabilities: nextCapabilities,
        primaryContentKind: derivePrimaryContentKind({
          capabilities: nextCapabilities,
          contentBlocks: readContentBlocks(existing.value),
        }),
        canonicalText: deriveCanonicalText({
          capabilities: nextCapabilities,
          contentBlocks: readContentBlocks(existing.value),
        }),
      };

      const upserted = await saveObject(next);
      if (!upserted.ok) {
        return { ok: false, error: mapPersistenceFailure(upserted) };
      }

      changedObjectIds.add(operation.objectId);
      return { ok: true, value: undefined };
    }

    if (
      operation.op === 'object.body.replace'
      || operation.op === 'object.body.block.insert'
      || operation.op === 'object.body.block.update'
      || operation.op === 'object.body.block.remove'
      || operation.op === 'object.body.block.reorder'
    ) {
      const existing = await loadObject(operation.objectId);
      if (!existing.ok) {
        return { ok: false, error: mapPersistenceFailure(existing) };
      }

      if (existing.value.capabilities.content) {
        return {
          ok: false,
          error: toFailure(
            'CONTENT_BODY_CONFLICT',
            'contentBlocks mutations are not allowed when direct capabilities.content exists.',
            'operations',
          ),
        };
      }

      const currentBlocks = cloneContentBlocks(readContentBlocks(existing.value) ?? []) ?? [];
      let nextBlocks: ContentBlock[] = currentBlocks;

      if (operation.op === 'object.body.replace') {
        nextBlocks = cloneContentBlocks(operation.blocks) ?? [];
      } else if (operation.op === 'object.body.block.insert') {
        nextBlocks = [...currentBlocks];
        nextBlocks.splice(operation.at, 0, cloneContentBlocks([operation.block])![0]);
      } else if (operation.op === 'object.body.block.update') {
        const blockIndex = currentBlocks.findIndex((block) => block.id === operation.blockId);
        if (blockIndex < 0) {
          return {
            ok: false,
            error: toFailure('INVALID_CONTENT_BLOCK', `content block ${operation.blockId} was not found.`, 'operations.blockId'),
          };
        }

        nextBlocks = [...currentBlocks];
        nextBlocks[blockIndex] = mergeContentBlock(currentBlocks[blockIndex], operation.patch);
      } else if (operation.op === 'object.body.block.remove') {
        if (!currentBlocks.some((block) => block.id === operation.blockId)) {
          return {
            ok: false,
            error: toFailure('INVALID_CONTENT_BLOCK', `content block ${operation.blockId} was not found.`, 'operations.blockId'),
          };
        }
        nextBlocks = currentBlocks.filter((block) => block.id !== operation.blockId);
      } else {
        const orderError = ensureBlockOrder(operation.order, currentBlocks);
        if (orderError) {
          return { ok: false, error: orderError };
        }

        const byId = collectBlockIds(currentBlocks);
        nextBlocks = operation.order.map((id) => byId.get(id)!);
      }

      const blockValidation = validateContentBlocks({ contentBlocks: nextBlocks });
      if (!blockValidation.ok) {
        return {
        ok: false,
        error: toFailure(
          blockValidation.code ?? 'INVALID_CONTENT_BLOCK',
          blockValidation.message ?? 'content blocks are invalid.',
          blockValidation.path ?? 'operations',
        ),
      };
      }

      const next: CanonicalObjectRecord = {
        ...existing.value,
        contentBlocks: nextBlocks,
        primaryContentKind: derivePrimaryContentKind({
          capabilities: existing.value.capabilities,
          contentBlocks: nextBlocks,
        }),
        canonicalText: deriveCanonicalText({
          capabilities: existing.value.capabilities,
          contentBlocks: nextBlocks,
        }),
      };

      const upserted = await saveObject(next);
      if (!upserted.ok) {
        return { ok: false, error: mapPersistenceFailure(upserted) };
      }

      changedObjectIds.add(operation.objectId);
      return { ok: true, value: undefined };
    }

    if (operation.op === 'object.relation.upsert') {
      const relation = await this.repository.createObjectRelation(operation.relation);
      if (!relation.ok) {
        return { ok: false, error: mapPersistenceFailure(relation) };
      }
      changedRelationIds.add(operation.relation.id);
      return { ok: true, value: undefined };
    }

    if (operation.op === 'object.relation.remove') {
      if (!this.repository.removeObjectRelation) {
        return {
          ok: false,
          error: toFailure('INVALID_MUTATION_OPERATION', 'Repository does not support relation removal.', 'operations'),
        };
      }
      const removed = await this.repository.removeObjectRelation({
        workspaceId: operation.workspaceId,
        relationId: operation.relationId,
      });
      if (!removed.ok) {
        return { ok: false, error: mapPersistenceFailure(removed) };
      }
      changedRelationIds.add(operation.relationId);
      return { ok: true, value: undefined };
    }

    if (operation.op === 'canvas-node.create') {
      const created = await this.repository.createCanvasNode(operation.node);
      if (!created.ok) {
        return { ok: false, error: mapPersistenceFailure(created) };
      }
      changedCanvasNodeIds.add(operation.node.id);
      return { ok: true, value: undefined };
    }

    if (operation.op === 'canvas-node.remove') {
      if (!this.repository.removeCanvasNode) {
        return {
          ok: false,
          error: toFailure('INVALID_MUTATION_OPERATION', 'Repository does not support canvas-node.remove.', 'operations'),
        };
      }
      const removed = await this.repository.removeCanvasNode({
        documentId: operation.documentId,
        nodeId: operation.nodeId,
      });
      if (!removed.ok) {
        return { ok: false, error: mapPersistenceFailure(removed) };
      }
      changedCanvasNodeIds.add(operation.nodeId);
      return { ok: true, value: undefined };
    }

    if (operation.op === 'canvas-node.move' || operation.op === 'canvas-node.reparent') {
      if (!this.repository.getCanvasNode || !this.repository.updateCanvasNode) {
        return {
          ok: false,
          error: toFailure(
            'INVALID_MUTATION_OPERATION',
            'Repository does not support canvas node update primitives.',
            'operations',
          ),
        };
      }

      const found = await this.repository.getCanvasNode({
        documentId: operation.documentId,
        nodeId: operation.nodeId,
      });

      if (!found.ok) {
        return { ok: false, error: mapPersistenceFailure(found) };
      }

      const nextNode = operation.op === 'canvas-node.move'
        ? {
            ...found.value,
            layout: {
              ...found.value.layout,
              ...operation.nextLayout,
            },
          }
        : {
            ...found.value,
            parentNodeId: operation.parentNodeId,
          };

      const updated = await this.repository.updateCanvasNode(nextNode);
      if (!updated.ok) {
        return { ok: false, error: mapPersistenceFailure(updated) };
      }
      changedCanvasNodeIds.add(operation.nodeId);
      return { ok: true, value: undefined };
    }

    const unsupportedOp = (operation as { op: string }).op;
    return {
      ok: false,
      error: toFailure('INVALID_MUTATION_OPERATION', `Unsupported operation ${unsupportedOp}.`, 'operations'),
    };
  }
}

type ValidationSuccess<T> = { ok: true; value: T };
type ValidationFailure<E> = { ok: false; error: E };
type ValidationResult<T, E> = ValidationSuccess<T> | ValidationFailure<E>;
