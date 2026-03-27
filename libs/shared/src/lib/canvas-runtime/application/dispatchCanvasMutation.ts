import { executeMutationBatch, type MutationBatch, type MutationExecutionResult, type MutationOperation } from '../../canonical-mutation';
import { readContentBlocks } from '../../canonical-object-contract';
import type {
  BodyBlockEntityV1,
  CanvasHistoryEntryV1,
  CanvasMutationBatchV1,
  CanvasRuntimeCommandV1,
  MutationResultEnvelopeV1,
} from '../contracts';
import { createMutationFailureEnvelope, createMutationSuccessEnvelope } from './mutationEnvelope';
import { publishRuntimeEvents } from './publishRuntimeEvents';
import type { CanvasRuntimeServiceContext } from './serviceContext';
import { normalizeReplayBatch } from '../history/normalizeReplay';
import { resolveBodyBlockPosition, resolveBodyBlockTarget } from '../history/resolveBodyBlockTargets';

export interface DispatchCanvasMutationResult {
  envelope: MutationResultEnvelopeV1;
  historyEntry: CanvasHistoryEntryV1 | null;
  events: ReturnType<typeof publishRuntimeEvents>;
}

function toLegacyBodyBlock(block: BodyBlockEntityV1) {
  switch (block.kind) {
    case 'paragraph':
      return {
        id: block.blockId,
        blockType: 'text' as const,
        text: typeof block.props.text === 'string' ? block.props.text : '',
      };
    case 'callout':
    case 'heading':
    case 'quote':
    case 'code':
      return {
        id: block.blockId,
        blockType: 'markdown' as const,
        source: typeof block.props.source === 'string'
          ? block.props.source
          : typeof block.props.text === 'string'
            ? block.props.text
            : '',
      };
    default:
      return {
        id: block.blockId,
        blockType: 'runtime.custom',
        payload: { ...block.props, kind: block.kind },
      } as const;
  }
}

function toCanvasNodeType(nodeType?: string | null): string {
  if (!nodeType || nodeType === 'mindmap') {
    return 'shape';
  }
  return nodeType;
}

function toCanvasMutationOperation(command: CanvasRuntimeCommandV1): MutationOperation | null {
  switch (command.name) {
    case 'canvas.node.create': {
      return {
        op: 'canvas.node.create',
        nodeId: command.nodeId,
        nodeType: toCanvasNodeType(command.nodeType) as MutationOperation extends infer T ? T extends { op: 'canvas.node.create'; nodeType: infer U } ? U : never : never,
        props: {
          ...(command.transform?.width !== undefined || command.transform?.height !== undefined
            ? {
                size: {
                  ...(command.transform?.width !== undefined ? { width: command.transform.width } : {}),
                  ...(command.transform?.height !== undefined ? { height: command.transform.height } : {}),
                },
              }
            : {}),
          ...(command.presentationStyle?.fillColor ? { fill: command.presentationStyle.fillColor } : {}),
          ...(command.presentationStyle?.strokeColor ? { stroke: command.presentationStyle.strokeColor } : {}),
          ...(command.presentationStyle?.strokeWidth !== undefined ? { strokeWidth: command.presentationStyle.strokeWidth } : {}),
          ...(command.presentationStyle?.textColor ? { color: command.presentationStyle.textColor } : {}),
          ...(command.presentationStyle?.fontSize !== undefined ? { fontSize: command.presentationStyle.fontSize } : {}),
          ...(command.presentationStyle?.fontFamily ? { fontFamily: command.presentationStyle.fontFamily } : {}),
          ...(command.renderProfile?.inkProfile ? { inkProfile: command.renderProfile.inkProfile } : {}),
          ...(command.renderProfile?.paperBlend ? { paperBlend: command.renderProfile.paperBlend } : {}),
          ...(command.objectLink?.canonicalObjectId ? { canonicalObjectId: command.objectLink.canonicalObjectId } : {}),
          ...(command.transform?.rotation !== undefined ? { rotation: command.transform.rotation } : {}),
        },
        placement: command.placement.mode === 'mindmap-child'
          ? { mode: 'mindmap-child', parentId: command.placement.parentNodeId }
          : command.placement.mode === 'mindmap-sibling'
            ? {
                mode: 'mindmap-sibling',
                siblingOf: command.placement.siblingOfNodeId,
                parentId: command.placement.parentNodeId,
              }
            : command.placement.mode === 'mindmap-root'
              ? {
                  mode: 'mindmap-root',
                  x: command.placement.x,
                  y: command.placement.y,
                  mindmapId: command.placement.mindmapId,
                }
              : {
                  mode: 'canvas-absolute',
                  x: command.placement.x,
                  y: command.placement.y,
                },
      };
    }

    case 'canvas.node.move':
      return {
        op: 'canvas.node.move',
        nodeId: command.nodeId,
        patch: { x: command.x, y: command.y },
      };

    case 'canvas.node.reparent':
      return {
        op: 'canvas.node.reparent',
        nodeId: command.nodeId,
        parentNodeId: command.parentNodeId,
      };

    case 'canvas.node.resize':
      return {
        op: 'canvas.node.update',
        nodeId: command.nodeId,
        propsPatch: {
          size: {
            width: command.nextSize.width,
            height: command.nextSize.height,
          },
          width: command.nextSize.width,
          height: command.nextSize.height,
        },
      };

    case 'canvas.node.rotate':
      return {
        op: 'canvas.node.update',
        nodeId: command.nodeId,
        stylePatch: {
          rotation: command.nextRotation,
        },
      };

    case 'canvas.node.presentation-style.update':
      return {
        op: 'canvas.node.update',
        nodeId: command.nodeId,
        stylePatch: {
          ...(command.presentationStyle.fillColor ? { fill: command.presentationStyle.fillColor } : {}),
          ...(command.presentationStyle.strokeColor ? { stroke: command.presentationStyle.strokeColor } : {}),
          ...(command.presentationStyle.strokeWidth !== undefined ? { strokeWidth: command.presentationStyle.strokeWidth } : {}),
          ...(command.presentationStyle.opacity !== undefined ? { opacity: command.presentationStyle.opacity } : {}),
          ...(command.presentationStyle.textColor ? { color: command.presentationStyle.textColor } : {}),
          ...(command.presentationStyle.fontFamily ? { fontFamily: command.presentationStyle.fontFamily } : {}),
          ...(command.presentationStyle.fontSize !== undefined ? { fontSize: command.presentationStyle.fontSize } : {}),
        },
      };

    case 'canvas.node.render-profile.update':
      return {
        op: 'canvas.node.update',
        nodeId: command.nodeId,
        stylePatch: {
          ...command.renderProfile,
        },
      };

    case 'canvas.node.rename':
      return {
        op: 'canvas.node.update',
        nodeId: command.nodeId,
        propsPatch: {
          label: command.nextDisplayName,
        },
      };

    case 'canvas.node.delete':
      return {
        op: 'canvas.node.delete',
        nodeId: command.nodeId,
      };

    case 'canvas.node.z-order.update':
      return {
        op: 'canvas.node.z-order.update',
        nodeId: command.nodeId,
        zIndex: command.zIndex,
      };

    case 'object.content.update':
      return {
        op: 'object.content.update',
        objectId: command.objectId,
        kind: command.kind === 'document' ? 'markdown' : command.kind,
        expectedContentKind: command.expectedContentKind === 'document' ? 'markdown' : command.expectedContentKind,
        patch: command.patch,
      };

    case 'object.capability.patch':
      if (command.capability === 'custom') {
        throw new Error('Custom capability patches require a dedicated runtime extension.');
      }
      return {
        op: 'object.capability.patch',
        objectId: command.objectId,
        capability: command.capability,
        patch: command.patch,
      };

    default:
      return null;
  }
}

async function translateCommand(
  context: CanvasRuntimeServiceContext,
  batch: CanvasMutationBatchV1,
  command: CanvasRuntimeCommandV1,
): Promise<{ operations: MutationOperation[]; bodyBlockIds: string[] }> {
  if (command.name === 'object.body.block.insert') {
    const object = await context.repository.getCanonicalObject(batch.workspaceId, command.objectId);
    if (!object.ok) {
      throw new Error(object.message);
    }
    const resolvedPosition = resolveBodyBlockPosition({
      objectRecord: object.value,
      position: command.position,
    });

    return {
      operations: [{
        op: 'object.body.block.insert',
        objectId: command.objectId,
        block: toLegacyBodyBlock(command.block),
        ...(resolvedPosition.index > 0
          ? {
              afterBlockId: (readContentBlocks(object.value) ?? [])[resolvedPosition.index - 1]?.id,
            }
          : { index: 0 }),
      }],
      bodyBlockIds: [command.block.blockId],
    };
  }

  if (command.name === 'object.body.block.update') {
    const object = await context.repository.getCanonicalObject(batch.workspaceId, command.objectId);
    if (!object.ok) {
      throw new Error(object.message);
    }
    const target = resolveBodyBlockTarget({
      objectRecord: object.value,
      target: command.target,
    });
    return {
      operations: [{
        op: 'object.body.block.update',
        objectId: command.objectId,
        blockId: target.blockId,
        patch: command.props,
      }],
      bodyBlockIds: [target.blockId],
    };
  }

  if (command.name === 'object.body.block.remove') {
    const object = await context.repository.getCanonicalObject(batch.workspaceId, command.objectId);
    if (!object.ok) {
      throw new Error(object.message);
    }
    const target = resolveBodyBlockTarget({
      objectRecord: object.value,
      target: command.target,
    });
    return {
      operations: [{
        op: 'object.body.block.remove',
        objectId: command.objectId,
        blockId: target.blockId,
      }],
      bodyBlockIds: [target.blockId],
    };
  }

  if (command.name === 'object.body.block.reorder') {
    const object = await context.repository.getCanonicalObject(batch.workspaceId, command.objectId);
    if (!object.ok) {
      throw new Error(object.message);
    }
    const target = resolveBodyBlockTarget({
      objectRecord: object.value,
      target: command.target,
    });
    const position = resolveBodyBlockPosition({
      objectRecord: object.value,
      position: command.position,
    });
    return {
      operations: [{
        op: 'object.body.block.reorder',
        objectId: command.objectId,
        blockId: target.blockId,
        toIndex: position.index,
      }],
      bodyBlockIds: [target.blockId],
    };
  }

  const operation = toCanvasMutationOperation(command);
  if (!operation) {
    throw new Error(`Unsupported runtime command ${command.name}.`);
  }
  return {
    operations: [operation],
    bodyBlockIds: [],
  };
}

function createHistoryEntry(input: {
  context: CanvasRuntimeServiceContext;
  batch: CanvasMutationBatchV1;
  result: MutationExecutionResult;
  mutationId: string;
  commands: CanvasRuntimeCommandV1[];
  bodyBlockIds: string[];
}): CanvasHistoryEntryV1 | null {
  if (input.batch.dryRun || !input.batch.canvasId) {
    return null;
  }

  return {
    historyEntryId: input.context.createId(),
    canvasId: input.batch.canvasId,
    ...(input.batch.actor ? { actor: input.batch.actor } : {}),
    mutationId: input.mutationId,
    forwardMutation: normalizeReplayBatch({
      workspaceId: input.batch.workspaceId,
      canvasId: input.batch.canvasId,
      actor: input.batch.actor,
      reason: input.batch.reason,
      commands: input.commands,
      resolvedAgainstRevision: input.result.canvasRevisionAfter,
    }),
    revisionBefore: input.result.canvasRevisionBefore,
    revisionAfter: input.result.canvasRevisionAfter,
    changed: {
      canvases: input.batch.canvasId ? [input.batch.canvasId] : [],
      nodes: [...input.result.changed.nodes],
      objects: [...input.result.changed.objects],
      bodyBlocks: [...input.bodyBlockIds],
      edges: [...input.result.changed.edges],
      pluginInstances: [...input.result.changed.pluginInstances],
    },
    undoable: true,
  };
}

function isRevisionConflict(error: unknown): error is { code: string; message: string; details?: { expected?: number; actual?: number } } {
  return typeof error === 'object'
    && error !== null
    && (error as { code?: string }).code === 'DOCUMENT_REVISION_CONFLICT';
}

function toFailureCode(error: unknown): import('../contracts').MutationFailureCodeV1 {
  if (isRevisionConflict(error)) {
    return 'VERSION_CONFLICT';
  }

  const message = error instanceof Error ? error.message : '';
  if (message.includes('Custom capability')) {
    return 'CAPABILITY_REJECTED';
  }

  const code = typeof (error as { code?: string })?.code === 'string'
    ? (error as { code: string }).code
    : '';

  if (code.includes('NOT_FOUND')) {
    return 'NOT_FOUND';
  }
  if (code.includes('VALID')) {
    return 'VALIDATION_FAILED';
  }
  return 'INTERNAL_ERROR';
}

export async function dispatchCanvasMutation(
  context: CanvasRuntimeServiceContext,
  batch: CanvasMutationBatchV1,
): Promise<DispatchCanvasMutationResult> {
  const translated = await Promise.all(batch.commands.map((command) => translateCommand(context, batch, command)));
  const operations = translated.flatMap((entry) => entry.operations);
  const bodyBlockIds = translated.flatMap((entry) => entry.bodyBlockIds);
  const mutationId = context.createId();

  try {
    const result = await executeMutationBatch({
      context: context.headless,
      dryRun: batch.dryRun ?? false,
      batch: {
        workspaceRef: batch.workspaceId,
        canvasRef: batch.canvasId,
        ...(batch.actor
          ? {
              actor: {
                kind: batch.actor.kind,
                id: batch.actor.id,
              },
            }
          : {}),
        ...(batch.reason ? { reason: batch.reason } : {}),
        ...(batch.preconditions ? { preconditions: batch.preconditions } : {}),
        operations,
      } satisfies MutationBatch,
    });
    const historyEntry = createHistoryEntry({
      context,
      batch,
      result,
      mutationId,
      commands: batch.commands,
      bodyBlockIds,
    });
    const envelope = createMutationSuccessEnvelope({
      mutationId,
      result,
      canvasId: batch.canvasId,
      bodyBlockIds,
      historyEntry,
    });

    return {
      envelope,
      historyEntry,
      events: publishRuntimeEvents({
        context,
        canvasId: batch.canvasId,
        result: envelope,
        causedByCommandName: batch.commands[0]?.name,
      }),
    };
  } catch (error) {
    const envelope = isRevisionConflict(error)
      ? createMutationFailureEnvelope({
          code: 'VERSION_CONFLICT',
          message: (error as { message?: string }).message ?? 'Version conflict.',
          retryable: true,
          details: {
            expectedCanvasRevision: (error as { details?: { expected?: number } }).details?.expected ?? null,
            actualCanvasRevision: (error as { details?: { actual?: number } }).details?.actual ?? null,
          },
        })
      : createMutationFailureEnvelope({
          code: toFailureCode(error),
          message: error instanceof Error ? error.message : 'Runtime mutation failed.',
          retryable: false,
        });

    return {
      envelope,
      historyEntry: null,
      events: publishRuntimeEvents({
        context,
        canvasId: batch.canvasId,
        result: envelope,
        causedByCommandName: batch.commands[0]?.name,
      }),
    };
  }
}
