import { randomUUID } from 'node:crypto';
import type { HeadlessServiceContext } from '../canonical-cli';
import { cliError, persistenceFailureToCliError } from '../canonical-cli';
import type { CanvasRevisionRecord } from '../canonical-persistence/records';
import { getCurrentCanvasRevision } from '../canonical-query/workspace-canvas';
import {
  applyCanvasNodeMove,
  applyCanvasNodeReparent,
  applyCanvasNodeUpdate,
  applyCanvasNodeZOrderUpdate,
  getCanvasNode,
  persistCanvasNode,
} from './canvas-node';
import { createCanvasNodeOperation } from './createCanvasNode';
import {
  applyObjectBodyBlockInsert,
  applyObjectBodyBlockRemove,
  applyObjectBodyBlockReorder,
  applyObjectBodyBlockUpdate,
  applyObjectBodyReplace,
  applyObjectCapabilityPatch,
  applyObjectContentUpdate,
} from './object';
import type {
  MutationBatch,
  MutationChangedSet,
  MutationExecutionResult,
  MutationOperation,
} from './types';

function createChangedSet(): MutationChangedSet {
  return {
    objects: [],
    nodes: [],
    edges: [],
    bindings: [],
    pluginInstances: [],
  };
}

function pushChangedId(values: string[], id: string): void {
  if (!values.includes(id)) {
    values.push(id);
  }
}

function resolveActor(batch: MutationBatch): { kind: 'agent' | 'user' | 'system'; id: string } {
  return batch.actor ?? {
    kind: 'agent',
    id: 'magam-cli',
  };
}

function ensureOperations(batch: MutationBatch): void {
  if (!Array.isArray(batch.operations) || batch.operations.length === 0) {
    throw cliError('INVALID_ARGUMENT', 'Mutation batch requires at least one operation.', {
      details: { path: 'operations' },
    });
  }
}

async function upsertObject(
  context: HeadlessServiceContext,
  record: Parameters<typeof applyObjectContentUpdate>[0]['record'],
): Promise<void> {
  const result = await context.repository.upsertCanonicalObject(record);
  if (!result.ok) {
    throw persistenceFailureToCliError(result);
  }
}

async function persistObjectRecord(
  context: HeadlessServiceContext,
  record: Parameters<typeof applyObjectContentUpdate>[0]['record'],
): Promise<void> {
  await upsertObject(context, record);
}

async function applyOperation(input: {
  context: HeadlessServiceContext;
  batch: MutationBatch;
  operation: MutationOperation;
  changed: MutationChangedSet;
  apply: boolean;
}): Promise<void> {
  const { context, batch, operation, changed, apply } = input;

  switch (operation.op) {
    case 'object.content.update': {
      const current = await context.repository.getCanonicalObject(batch.workspaceRef, operation.objectId);
      if (!current.ok) {
        throw cliError('OBJECT_NOT_FOUND', `Object ${operation.objectId} was not found in workspace ${batch.workspaceRef}.`, {
          details: { workspaceId: batch.workspaceRef, objectId: operation.objectId },
        });
      }

      if (
        operation.expectedContentKind
        && current.value.primaryContentKind
        && current.value.primaryContentKind !== operation.expectedContentKind
        && !operation.kind
      ) {
        throw cliError(
          'CONTENT_CONTRACT_VIOLATION',
          `Object ${operation.objectId} expected ${operation.expectedContentKind} content but has ${current.value.primaryContentKind}.`,
          {
            details: {
              objectId: operation.objectId,
              expectedContentKind: operation.expectedContentKind,
              actualContentKind: current.value.primaryContentKind,
            },
          },
        );
      }

      const kind = operation.kind ?? operation.expectedContentKind;
      if (!kind) {
        throw cliError('INVALID_ARGUMENT', 'object.content.update requires kind or expectedContentKind.', {
          details: { objectId: operation.objectId },
        });
      }

      const next = applyObjectContentUpdate({
        record: current.value,
        kind,
        patch: operation.patch,
      });
      if (apply) {
        await persistObjectRecord(context, next);
      }
      pushChangedId(changed.objects, operation.objectId);
      return;
    }

    case 'object.capability.patch': {
      const current = await context.repository.getCanonicalObject(batch.workspaceRef, operation.objectId);
      if (!current.ok) {
        throw cliError('OBJECT_NOT_FOUND', `Object ${operation.objectId} was not found in workspace ${batch.workspaceRef}.`, {
          details: { workspaceId: batch.workspaceRef, objectId: operation.objectId },
        });
      }

      const next = applyObjectCapabilityPatch({
        record: current.value,
        capability: operation.capability,
        patch: operation.patch,
      });
      if (apply) {
        await persistObjectRecord(context, next);
      }
      pushChangedId(changed.objects, operation.objectId);
      return;
    }

    case 'object.body.replace': {
      const current = await context.repository.getCanonicalObject(batch.workspaceRef, operation.objectId);
      if (!current.ok) {
        throw cliError('OBJECT_NOT_FOUND', `Object ${operation.objectId} was not found in workspace ${batch.workspaceRef}.`, {
          details: { workspaceId: batch.workspaceRef, objectId: operation.objectId },
        });
      }

      const next = applyObjectBodyReplace({
        record: current.value,
        blocks: operation.blocks,
      });
      if (apply) {
        await persistObjectRecord(context, next);
      }
      pushChangedId(changed.objects, operation.objectId);
      return;
    }

    case 'object.body.block.insert': {
      const current = await context.repository.getCanonicalObject(batch.workspaceRef, operation.objectId);
      if (!current.ok) {
        throw cliError('OBJECT_NOT_FOUND', `Object ${operation.objectId} was not found in workspace ${batch.workspaceRef}.`, {
          details: { workspaceId: batch.workspaceRef, objectId: operation.objectId },
        });
      }

      const next = applyObjectBodyBlockInsert({
        record: current.value,
        block: operation.block,
        index: operation.index,
        afterBlockId: operation.afterBlockId,
      });
      if (apply) {
        await persistObjectRecord(context, next);
      }
      pushChangedId(changed.objects, operation.objectId);
      return;
    }

    case 'canvas.node.create': {
      const canvasId = batch.canvasRef;
      if (!canvasId) {
        throw cliError('INVALID_ARGUMENT', 'canvas.node.create requires canvasRef.', {
          details: { op: operation.op },
        });
      }

      await createCanvasNodeOperation({
        context,
        canvasId,
        operation,
        changed,
        apply,
      });
      return;
    }

    case 'object.body.block.update': {
      const current = await context.repository.getCanonicalObject(batch.workspaceRef, operation.objectId);
      if (!current.ok) {
        throw cliError('OBJECT_NOT_FOUND', `Object ${operation.objectId} was not found in workspace ${batch.workspaceRef}.`, {
          details: { workspaceId: batch.workspaceRef, objectId: operation.objectId },
        });
      }

      const next = applyObjectBodyBlockUpdate({
        record: current.value,
        blockId: operation.blockId,
        patch: operation.patch,
      });
      if (apply) {
        await persistObjectRecord(context, next);
      }
      pushChangedId(changed.objects, operation.objectId);
      return;
    }

    case 'object.body.block.remove': {
      const current = await context.repository.getCanonicalObject(batch.workspaceRef, operation.objectId);
      if (!current.ok) {
        throw cliError('OBJECT_NOT_FOUND', `Object ${operation.objectId} was not found in workspace ${batch.workspaceRef}.`, {
          details: { workspaceId: batch.workspaceRef, objectId: operation.objectId },
        });
      }

      const next = applyObjectBodyBlockRemove({
        record: current.value,
        blockId: operation.blockId,
      });
      if (apply) {
        await persistObjectRecord(context, next);
      }
      pushChangedId(changed.objects, operation.objectId);
      return;
    }

    case 'object.body.block.reorder': {
      const current = await context.repository.getCanonicalObject(batch.workspaceRef, operation.objectId);
      if (!current.ok) {
        throw cliError('OBJECT_NOT_FOUND', `Object ${operation.objectId} was not found in workspace ${batch.workspaceRef}.`, {
          details: { workspaceId: batch.workspaceRef, objectId: operation.objectId },
        });
      }

      const next = applyObjectBodyBlockReorder({
        record: current.value,
        blockId: operation.blockId,
        toIndex: operation.toIndex,
      });
      if (apply) {
        await persistObjectRecord(context, next);
      }
      pushChangedId(changed.objects, operation.objectId);
      return;
    }

    case 'canvas.node.move': {
      const canvasId = batch.canvasRef;
      if (!canvasId) {
        throw cliError('INVALID_ARGUMENT', 'canvas.node.move requires canvasRef.', {
          details: { op: operation.op },
        });
      }

      const current = await getCanvasNode(context, canvasId, operation.nodeId);
      const next = applyCanvasNodeMove(current, operation.patch);
      if (apply) {
        await persistCanvasNode(context, next);
      }
      pushChangedId(changed.nodes, operation.nodeId);
      return;
    }

    case 'canvas.node.reparent': {
      const canvasId = batch.canvasRef;
      if (!canvasId) {
        throw cliError('INVALID_ARGUMENT', 'canvas.node.reparent requires canvasRef.', {
          details: { op: operation.op },
        });
      }

      const current = await getCanvasNode(context, canvasId, operation.nodeId);
      const next = applyCanvasNodeReparent(current, operation.parentNodeId);
      if (apply) {
        await persistCanvasNode(context, next);
      }
      pushChangedId(changed.nodes, operation.nodeId);
      return;
    }

    case 'canvas.node.update': {
      const canvasId = batch.canvasRef;
      if (!canvasId) {
        throw cliError('INVALID_ARGUMENT', 'canvas.node.update requires canvasRef.', {
          details: { op: operation.op },
        });
      }

      const current = await getCanvasNode(context, canvasId, operation.nodeId);
      const next = applyCanvasNodeUpdate(current, {
        propsPatch: operation.propsPatch,
        stylePatch: operation.stylePatch,
      });
      if (apply) {
        const result = await context.repository.updateCanvasNode(next);
        if (!result.ok) {
          throw persistenceFailureToCliError(result);
        }
      }
      pushChangedId(changed.nodes, operation.nodeId);
      return;
    }

    case 'canvas.node.rename': {
      const canvasId = batch.canvasRef;
      if (!canvasId) {
        throw cliError('INVALID_ARGUMENT', 'canvas.node.rename requires canvasRef.', {
          details: { op: operation.op },
        });
      }

      const current = await getCanvasNode(context, canvasId, operation.nodeId);
      if (apply) {
        const renameNodeResult = await context.repository.renameCanvasNode({
          canvasId,
          nodeId: operation.nodeId,
          nextNodeId: operation.nextNodeId,
        });
        if (!renameNodeResult.ok) {
          throw persistenceFailureToCliError(renameNodeResult);
        }

        if (current.nodeKind === 'native' && current.canonicalObjectId) {
          const renameObjectResult = await context.repository.renameCanonicalObject({
            workspaceId: context.defaultWorkspaceId,
            objectId: current.canonicalObjectId,
            nextObjectId: operation.nextNodeId,
          });
          if (!renameObjectResult.ok) {
            throw persistenceFailureToCliError(renameObjectResult);
          }
        }
      }
      pushChangedId(changed.nodes, operation.nodeId);
      pushChangedId(changed.nodes, operation.nextNodeId);
      if (current.nodeKind === 'native' && current.canonicalObjectId) {
        pushChangedId(changed.objects, current.canonicalObjectId);
        pushChangedId(changed.objects, operation.nextNodeId);
      }
      return;
    }

    case 'canvas.node.delete': {
      const canvasId = batch.canvasRef;
      if (!canvasId) {
        throw cliError('INVALID_ARGUMENT', 'canvas.node.delete requires canvasRef.', {
          details: { op: operation.op },
        });
      }

      const current = await getCanvasNode(context, canvasId, operation.nodeId);
      const canonicalObjectId = current.nodeKind === 'native'
        ? current.id
        : current.canonicalObjectId;
      if (apply) {
        const deleteNodeResult = await context.repository.deleteCanvasNode(canvasId, operation.nodeId);
        if (!deleteNodeResult.ok) {
          throw persistenceFailureToCliError(deleteNodeResult);
        }

        if (canonicalObjectId) {
          await context.repository.deleteObjectRelationsByObjectId({
            workspaceId: context.defaultWorkspaceId,
            objectId: canonicalObjectId,
          });
          const tombstoneResult = await context.repository.tombstoneCanonicalObject(
            context.defaultWorkspaceId,
            canonicalObjectId,
          );
          if (!tombstoneResult.ok) {
            throw persistenceFailureToCliError(tombstoneResult);
          }
        }
      }
      pushChangedId(changed.nodes, operation.nodeId);
      if (canonicalObjectId) {
        pushChangedId(changed.objects, canonicalObjectId);
      }
      return;
    }

    case 'canvas.node.z-order.update': {
      const canvasId = batch.canvasRef;
      if (!canvasId) {
        throw cliError('INVALID_ARGUMENT', 'canvas.node.z-order.update requires canvasRef.', {
          details: { op: operation.op },
        });
      }

      const current = await getCanvasNode(context, canvasId, operation.nodeId);
      const next = applyCanvasNodeZOrderUpdate(current, operation.zIndex);
      if (apply) {
        const result = await context.repository.updateCanvasNode(next);
        if (!result.ok) {
          throw persistenceFailureToCliError(result);
        }
      }
      pushChangedId(changed.nodes, operation.nodeId);
      return;
    }

    default:
      throw cliError('UNSUPPORTED_MUTATION_OPERATION', `Unsupported mutation operation ${(operation as { op: string }).op}.`);
  }
}

export async function executeMutationBatch(input: {
  context: HeadlessServiceContext;
  batch: MutationBatch;
  dryRun?: boolean;
}): Promise<MutationExecutionResult> {
  const { context, batch, dryRun = false } = input;
  ensureOperations(batch);

  const currentRevision = batch.canvasRef
    ? await getCurrentCanvasRevision(context, batch.canvasRef)
    : 0;

  if (
    batch.canvasRef
    && batch.preconditions?.canvasRevision !== undefined
    && batch.preconditions.canvasRevision !== currentRevision
  ) {
    throw cliError(
      'DOCUMENT_REVISION_CONFLICT',
      `expected revision ${batch.preconditions.canvasRevision} but current revision is ${currentRevision}`,
      {
        retryable: true,
        details: {
          expected: batch.preconditions.canvasRevision,
          actual: currentRevision,
          canvasId: batch.canvasRef,
        },
      },
    );
  }

  const changed = createChangedSet();
  for (const operation of batch.operations) {
    await applyOperation({
      context,
      batch,
      operation,
      changed,
      apply: !dryRun,
    });
  }

  const nextRevision = batch.canvasRef ? currentRevision + 1 : null;
  if (!dryRun && batch.canvasRef) {
    const actor = resolveActor(batch);
    const revision: CanvasRevisionRecord = {
      id: randomUUID(),
      canvasId: batch.canvasRef,
      revisionNo: nextRevision!,
      authorKind: actor.kind,
      authorId: actor.id,
      mutationBatch: batch as unknown as Record<string, unknown>,
    };
    const appended = await context.repository.appendCanvasRevision(revision);
    if (!appended.ok) {
      throw persistenceFailureToCliError(appended);
    }
  }

  return {
    mutationId: randomUUID(),
    canvasRevisionBefore: batch.canvasRef ? currentRevision : null,
    canvasRevisionAfter: batch.canvasRef ? nextRevision : null,
    changed,
    warnings: [],
    dryRun,
  };
}
