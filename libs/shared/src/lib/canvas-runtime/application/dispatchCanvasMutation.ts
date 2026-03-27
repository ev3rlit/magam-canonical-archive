import { executeMutationBatch, type MutationBatch, type MutationExecutionResult, type MutationOperation } from '../../canonical-mutation';
import { cloneContentBlocks, readContentBlocks, type CanonicalObjectRecord, type ContentBlock } from '../../canonical-object-contract';
import type {
  BodyBlockEntityV1,
  CanvasHistoryEntryV1,
  CanvasHistoryReplayBatchV1,
  CanvasHistoryReplayCommandV1,
  CanvasMutationBatchV1,
  CanvasRuntimeCommandV1,
  MutationFailureCodeV1,
  MutationResultEnvelopeV1,
} from '../contracts';
import { createMutationFailureEnvelope, createMutationSuccessEnvelope } from './mutationEnvelope';
import { publishRuntimeEvents } from './publishRuntimeEvents';
import type { RuntimeCanvasNodeRecord, RuntimeCanvasRevisionRecord } from './repositoryPorts';
import type { CanvasRuntimeServiceContext } from './serviceContext';
import { resolveBodyBlockPosition, resolveBodyBlockTarget } from '../history/resolveBodyBlockTargets';

export interface DispatchCanvasMutationResult {
  envelope: MutationResultEnvelopeV1;
  historyEntry: CanvasHistoryEntryV1 | null;
  events: ReturnType<typeof publishRuntimeEvents>;
}

interface TranslatedCommand {
  command: CanvasRuntimeCommandV1;
  operations: MutationOperation[];
  bodyBlockIds: string[];
}

type CommandSnapshot =
  | { command: Extract<CanvasRuntimeCommandV1, { name: 'canvas.node.create' }> }
  | { command: Extract<CanvasRuntimeCommandV1, { name: 'canvas.node.move' }>; node: RuntimeCanvasNodeRecord }
  | { command: Extract<CanvasRuntimeCommandV1, { name: 'canvas.node.reparent' }>; node: RuntimeCanvasNodeRecord }
  | { command: Extract<CanvasRuntimeCommandV1, { name: 'canvas.node.resize' }>; node: RuntimeCanvasNodeRecord }
  | { command: Extract<CanvasRuntimeCommandV1, { name: 'canvas.node.rotate' }>; node: RuntimeCanvasNodeRecord }
  | { command: Extract<CanvasRuntimeCommandV1, { name: 'canvas.node.presentation-style.update' }>; node: RuntimeCanvasNodeRecord }
  | { command: Extract<CanvasRuntimeCommandV1, { name: 'canvas.node.render-profile.update' }>; node: RuntimeCanvasNodeRecord }
  | { command: Extract<CanvasRuntimeCommandV1, { name: 'canvas.node.rename' }>; node: RuntimeCanvasNodeRecord }
  | { command: Extract<CanvasRuntimeCommandV1, { name: 'canvas.node.delete' }>; node: RuntimeCanvasNodeRecord; object: CanonicalObjectRecord | null }
  | { command: Extract<CanvasRuntimeCommandV1, { name: 'canvas.node.z-order.update' }>; node: RuntimeCanvasNodeRecord }
  | { command: Extract<CanvasRuntimeCommandV1, { name: 'object.content.update' }>; object: CanonicalObjectRecord }
  | { command: Extract<CanvasRuntimeCommandV1, { name: 'object.capability.patch' }>; object: CanonicalObjectRecord }
  | { command: Extract<CanvasRuntimeCommandV1, { name: 'object.body.block.insert' }>; object: CanonicalObjectRecord }
  | {
      command: Extract<CanvasRuntimeCommandV1, { name: 'object.body.block.update' }>;
      object: CanonicalObjectRecord;
      blockId: string;
      blockIndex: number;
      previousBlock: ContentBlock;
    }
  | {
      command: Extract<CanvasRuntimeCommandV1, { name: 'object.body.block.remove' }>;
      object: CanonicalObjectRecord;
      blockId: string;
      blockIndex: number;
      previousBlock: ContentBlock;
    }
  | {
      command: Extract<CanvasRuntimeCommandV1, { name: 'object.body.block.reorder' }>;
      object: CanonicalObjectRecord;
      blockId: string;
      previousIndex: number;
      nextIndex: number;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

function toBodyBlockEntity(block: ContentBlock): BodyBlockEntityV1 {
  if (block.blockType === 'text') {
    return {
      blockId: block.id,
      kind: 'paragraph',
      props: { text: block.text },
    };
  }

  if (block.blockType === 'markdown') {
    return {
      blockId: block.id,
      kind: 'callout',
      props: { source: block.source },
    };
  }

  return {
    blockId: block.id,
    kind: 'custom',
    props: {
      ...block.payload,
      ...(typeof block.textualProjection === 'string' ? { textualProjection: block.textualProjection } : {}),
      ...(isRecord(block.metadata) ? { metadata: block.metadata } : {}),
      blockType: block.blockType,
    },
  };
}

function toBodyBlockPatch(block: ContentBlock): Record<string, unknown> {
  if (block.blockType === 'text') {
    return { text: block.text };
  }

  if (block.blockType === 'markdown') {
    return { source: block.source };
  }

  return {
    payload: block.payload,
    ...(typeof block.textualProjection === 'string' ? { textualProjection: block.textualProjection } : {}),
    ...(isRecord(block.metadata) ? { metadata: block.metadata } : {}),
  };
}

function toCanvasNodeType(nodeType?: string | null): string {
  if (!nodeType || nodeType === 'mindmap') {
    return 'shape';
  }
  return nodeType;
}

function toRuntimeNodeKind(nodeType?: string | null): Extract<CanvasRuntimeCommandV1, { name: 'canvas.node.create' }>['kind'] {
  return nodeType === 'sticker' ? 'sticker' : 'node';
}

function isBodyCapableNodeType(nodeType?: string | null): boolean {
  return nodeType === 'shape'
    || nodeType === 'text'
    || nodeType === 'markdown'
    || nodeType === 'sticky';
}

function readNodeRecordField(node: RuntimeCanvasNodeRecord, key: string): unknown {
  if (isRecord(node.style) && key in node.style) {
    return node.style[key];
  }
  if (isRecord(node.props) && key in node.props) {
    return node.props[key];
  }
  return undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function toPresentationStyleFromNode(node: RuntimeCanvasNodeRecord): Partial<Extract<CanvasRuntimeCommandV1, { name: 'canvas.node.presentation-style.update' }>['presentationStyle']> {
  return {
    ...(readOptionalString(readNodeRecordField(node, 'fill')) ? { fillColor: readNodeRecordField(node, 'fill') as string } : {}),
    ...(readOptionalString(readNodeRecordField(node, 'stroke')) ? { strokeColor: readNodeRecordField(node, 'stroke') as string } : {}),
    ...(readOptionalNumber(readNodeRecordField(node, 'strokeWidth')) !== undefined ? { strokeWidth: readNodeRecordField(node, 'strokeWidth') as number } : {}),
    ...(readOptionalNumber(readNodeRecordField(node, 'opacity')) !== undefined ? { opacity: readNodeRecordField(node, 'opacity') as number } : {}),
    ...(readOptionalString(readNodeRecordField(node, 'color')) ? { textColor: readNodeRecordField(node, 'color') as string } : {}),
    ...(readOptionalString(readNodeRecordField(node, 'fontFamily')) ? { fontFamily: readNodeRecordField(node, 'fontFamily') as string } : {}),
    ...(readOptionalNumber(readNodeRecordField(node, 'fontSize')) !== undefined ? { fontSize: readNodeRecordField(node, 'fontSize') as number } : {}),
  };
}

function toRenderProfileFromNode(node: RuntimeCanvasNodeRecord): Partial<Extract<CanvasRuntimeCommandV1, { name: 'canvas.node.render-profile.update' }>['renderProfile']> {
  return {
    ...(readOptionalNumber(readNodeRecordField(node, 'roughness')) !== undefined ? { roughness: readNodeRecordField(node, 'roughness') as number } : {}),
    ...(readOptionalNumber(readNodeRecordField(node, 'wobble')) !== undefined ? { wobble: readNodeRecordField(node, 'wobble') as number } : {}),
    ...(readOptionalNumber(readNodeRecordField(node, 'pressureVariance')) !== undefined ? { pressureVariance: readNodeRecordField(node, 'pressureVariance') as number } : {}),
    ...(readOptionalNumber(readNodeRecordField(node, 'angleVariance')) !== undefined ? { angleVariance: readNodeRecordField(node, 'angleVariance') as number } : {}),
    ...(readOptionalString(readNodeRecordField(node, 'inkProfile')) ? { inkProfile: readNodeRecordField(node, 'inkProfile') as NonNullable<Extract<CanvasRuntimeCommandV1, { name: 'canvas.node.render-profile.update' }>['renderProfile']['inkProfile']> } : {}),
    ...(readOptionalString(readNodeRecordField(node, 'paperBlend')) ? { paperBlend: readNodeRecordField(node, 'paperBlend') as NonNullable<Extract<CanvasRuntimeCommandV1, { name: 'canvas.node.render-profile.update' }>['renderProfile']['paperBlend']> } : {}),
  };
}

function toTransformFromNode(
  node: RuntimeCanvasNodeRecord,
): NonNullable<Extract<CanvasRuntimeCommandV1, { name: 'canvas.node.create' }>['transform']> {
  const width = readOptionalNumber(readNodeRecordField(node, 'width'));
  const height = readOptionalNumber(readNodeRecordField(node, 'height'));
  const rotation = readOptionalNumber(readNodeRecordField(node, 'rotation'));

  return {
    ...(width !== undefined ? { width } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(rotation !== undefined ? { rotation } : {}),
  };
}

function toContentPatchFromCapability(content: NonNullable<CanonicalObjectRecord['capabilities']['content']>): Record<string, unknown> {
  switch (content.kind) {
    case 'text':
      return { text: content.value, value: content.value };
    case 'markdown':
      return { source: content.source, value: content.source };
    case 'media':
      return {
        src: content.src,
        ...(typeof content.alt === 'string' ? { alt: content.alt } : {}),
        ...(typeof content.fit === 'string' ? { fit: content.fit } : {}),
        ...(typeof content.width === 'number' ? { width: content.width } : {}),
        ...(typeof content.height === 'number' ? { height: content.height } : {}),
      };
    case 'sequence':
      return {
        participants: content.participants,
        messages: content.messages,
      };
    default:
      return {};
  }
}

function toCanvasMutationOperation(command: CanvasRuntimeCommandV1): MutationOperation | null {
  switch (command.name) {
    case 'canvas.node.create':
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
  batch: Pick<CanvasMutationBatchV1, 'workspaceId' | 'canvasId'>,
  command: CanvasRuntimeCommandV1,
): Promise<TranslatedCommand> {
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
      command,
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
      command,
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
      command,
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
      command,
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
    command,
    operations: [operation],
    bodyBlockIds: [],
  };
}

async function captureCommandSnapshot(
  context: CanvasRuntimeServiceContext,
  batch: CanvasMutationBatchV1,
  command: CanvasRuntimeCommandV1,
  knownCreated: {
    nodeIds: Set<string>;
    objectIds: Set<string>;
  },
): Promise<CommandSnapshot | null> {
  if (command.name === 'canvas.node.create') {
    return { command };
  }

  if (
    command.name === 'canvas.node.move'
    || command.name === 'canvas.node.reparent'
    || command.name === 'canvas.node.resize'
    || command.name === 'canvas.node.rotate'
    || command.name === 'canvas.node.presentation-style.update'
    || command.name === 'canvas.node.render-profile.update'
    || command.name === 'canvas.node.rename'
    || command.name === 'canvas.node.delete'
    || command.name === 'canvas.node.z-order.update'
  ) {
    if (!batch.canvasId) {
      throw new Error('Canvas history capture requires canvasId.');
    }
    const nodeResult = await context.repository.getCanvasNode(batch.canvasId, command.nodeId);
    if (!nodeResult.ok) {
      if (knownCreated.nodeIds.has(command.nodeId)) {
        return null;
      }
      throw new Error(nodeResult.message);
    }

    if (command.name === 'canvas.node.delete') {
      const objectId = nodeResult.value.canonicalObjectId ?? command.nodeId;
      const objectResult = objectId
        ? await context.repository.getCanonicalObject(batch.workspaceId, objectId)
        : null;
      return {
        command,
        node: nodeResult.value,
        object: objectResult && objectResult.ok ? objectResult.value : null,
      };
    }

    return {
      command: command as Exclude<typeof command, Extract<CanvasRuntimeCommandV1, { name: 'canvas.node.delete' }>>,
      node: nodeResult.value,
    } as CommandSnapshot;
  }

  const objectResult = await context.repository.getCanonicalObject(batch.workspaceId, command.objectId);
  if (!objectResult.ok) {
    if (knownCreated.objectIds.has(command.objectId)) {
      return null;
    }
    throw new Error(objectResult.message);
  }

  if (command.name === 'object.body.block.insert') {
    return { command, object: objectResult.value };
  }

  if (command.name === 'object.body.block.update') {
    const target = resolveBodyBlockTarget({
      objectRecord: objectResult.value,
      target: command.target,
    });
    const blocks = readContentBlocks(objectResult.value) ?? [];
    const previousBlock = blocks[target.index];
    if (!previousBlock) {
      throw new Error(`Body block ${target.blockId} was not found.`);
    }

    return {
      command,
      object: objectResult.value,
      blockId: target.blockId,
      blockIndex: target.index,
      previousBlock,
    };
  }

  if (command.name === 'object.body.block.remove') {
    const target = resolveBodyBlockTarget({
      objectRecord: objectResult.value,
      target: command.target,
    });
    const blocks = readContentBlocks(objectResult.value) ?? [];
    const previousBlock = blocks[target.index];
    if (!previousBlock) {
      throw new Error(`Body block ${target.blockId} was not found.`);
    }

    return {
      command,
      object: objectResult.value,
      blockId: target.blockId,
      blockIndex: target.index,
      previousBlock,
    };
  }

  if (command.name === 'object.body.block.reorder') {
    const target = resolveBodyBlockTarget({
      objectRecord: objectResult.value,
      target: command.target,
    });
    const nextPosition = resolveBodyBlockPosition({
      objectRecord: objectResult.value,
      position: command.position,
    });
    return {
      command,
      object: objectResult.value,
      blockId: target.blockId,
      previousIndex: target.index,
      nextIndex: nextPosition.index,
    };
  }

  if (command.name === 'object.content.update') {
    return {
      command,
      object: objectResult.value,
    };
  }

  return {
    command,
    object: objectResult.value,
  };
}

function createResolvedPositionForInsertIndex(index: number, currentBlockIds: string[]) {
  if (index <= 0 || currentBlockIds.length === 0) {
    return { mode: 'start' } as const;
  }

  if (index >= currentBlockIds.length) {
    return { mode: 'end' } as const;
  }

  return {
    mode: 'before-block',
    blockId: currentBlockIds[index] as string,
  } as const;
}

function createResolvedPositionForReorderIndex(index: number, currentBlockIds: string[], blockId: string) {
  const withoutTarget = currentBlockIds.filter((candidate) => candidate !== blockId);
  return createResolvedPositionForInsertIndex(index, withoutTarget);
}

function simulateBlockReorder(blockIds: string[], blockId: string, toIndex: number): string[] {
  const next = [...blockIds];
  const currentIndex = next.indexOf(blockId);
  if (currentIndex < 0) {
    return next;
  }

  const [moved] = next.splice(currentIndex, 1);
  const boundedIndex = Math.max(0, Math.min(toIndex, next.length));
  next.splice(boundedIndex, 0, moved);
  return next;
}

function buildPresentationStyleInversePatch(
  node: RuntimeCanvasNodeRecord,
  command: Extract<CanvasRuntimeCommandV1, { name: 'canvas.node.presentation-style.update' }>,
): Extract<CanvasHistoryReplayCommandV1, { name: 'canvas.node.presentation-style.update' }>['presentationStyle'] {
  const previous = toPresentationStyleFromNode(node);
  return {
    fillColor: previous.fillColor ?? null,
    strokeColor: previous.strokeColor ?? null,
    strokeWidth: previous.strokeWidth ?? null,
    opacity: previous.opacity ?? null,
    textColor: previous.textColor ?? null,
    fontFamily: previous.fontFamily ?? null,
    fontSize: previous.fontSize ?? null,
    ...Object.fromEntries(
      Object.keys(command.presentationStyle).map((key) => [key, (previous as Record<string, unknown>)[key] ?? null]),
    ),
  };
}

function buildRenderProfileInversePatch(
  node: RuntimeCanvasNodeRecord,
  command: Extract<CanvasRuntimeCommandV1, { name: 'canvas.node.render-profile.update' }>,
): Extract<CanvasHistoryReplayCommandV1, { name: 'canvas.node.render-profile.update' }>['renderProfile'] {
  const previous = toRenderProfileFromNode(node);
  return {
    roughness: previous.roughness ?? null,
    wobble: previous.wobble ?? null,
    pressureVariance: previous.pressureVariance ?? null,
    angleVariance: previous.angleVariance ?? null,
    inkProfile: previous.inkProfile ?? null,
    paperBlend: previous.paperBlend ?? null,
    ...Object.fromEntries(
      Object.keys(command.renderProfile).map((key) => [key, (previous as Record<string, unknown>)[key] ?? null]),
    ),
  };
}

function buildRestoreDeletedNodeCommands(input: {
  canvasId: string;
  node: RuntimeCanvasNodeRecord;
  object: CanonicalObjectRecord | null;
}): CanvasHistoryReplayCommandV1[] {
  const commands: CanvasHistoryReplayCommandV1[] = [];
  const x = readOptionalNumber((input.node.layout as Record<string, unknown>)?.x) ?? 0;
  const y = readOptionalNumber((input.node.layout as Record<string, unknown>)?.y) ?? 0;
  const transform = toTransformFromNode(input.node);
  const presentationStyle = toPresentationStyleFromNode(input.node);
  const renderProfile = toRenderProfileFromNode(input.node);

  commands.push({
    name: 'canvas.node.create',
    canvasId: input.canvasId,
    nodeId: input.node.id,
    kind: toRuntimeNodeKind(input.node.nodeType),
    nodeType: toCanvasNodeType(input.node.nodeType),
    placement: {
      mode: 'canvas-absolute',
      x,
      y,
    },
    ...(Object.keys(transform).length > 0 ? { transform } : {}),
    ...(Object.keys(presentationStyle).length > 0 ? { presentationStyle } : {}),
    ...(Object.keys(renderProfile).length > 0 ? { renderProfile } : {}),
    ...(input.node.canonicalObjectId && input.node.canonicalObjectId !== input.node.id
      ? {
          objectLink: {
            canonicalObjectId: input.node.canonicalObjectId,
          },
        }
      : {}),
  });

  if (input.node.parentNodeId) {
    commands.push({
      name: 'canvas.node.reparent',
      canvasId: input.canvasId,
      nodeId: input.node.id,
      parentNodeId: input.node.parentNodeId,
    });
  }

  commands.push({
    name: 'canvas.node.z-order.update',
    canvasId: input.canvasId,
    nodeId: input.node.id,
    zIndex: input.node.zIndex,
  });

  if (!input.object) {
    return commands;
  }

  const contentBlocks = cloneContentBlocks(readContentBlocks(input.object)) ?? [];
  if (contentBlocks.length > 0 && isBodyCapableNodeType(input.node.nodeType)) {
    const firstBlock = contentBlocks[0];
    if (firstBlock?.blockType === 'text' || firstBlock?.blockType === 'markdown') {
      commands.push({
        name: 'object.content.update',
        objectId: input.object.id,
        kind: firstBlock.blockType === 'text' ? 'text' : 'markdown',
        patch: firstBlock.blockType === 'text'
          ? { text: firstBlock.text, value: firstBlock.text }
          : { source: firstBlock.source, value: firstBlock.source },
        expectedContentKind: firstBlock.blockType === 'text' ? 'text' : 'markdown',
      });
      for (const block of contentBlocks.slice(1)) {
        commands.push({
          name: 'object.body.block.insert',
          objectId: input.object.id,
          block: toBodyBlockEntity(block),
          position: { mode: 'end' },
        });
      }
    }
  } else if (input.object.capabilities.content) {
    commands.push({
      name: 'object.content.update',
      objectId: input.object.id,
      kind: input.object.capabilities.content.kind,
      patch: toContentPatchFromCapability(input.object.capabilities.content),
      expectedContentKind: input.object.capabilities.content.kind,
    });
  }

  for (const [capability, payload] of Object.entries(input.object.capabilities)) {
    if (capability === 'content' || payload === undefined) {
      continue;
    }
    commands.push({
      name: 'object.capability.patch',
      objectId: input.object.id,
      capability: capability as Extract<CanvasRuntimeCommandV1, { name: 'object.capability.patch' }>['capability'],
      patch: isRecord(payload) ? payload : null,
    });
  }

  return commands;
}

function buildInverseCommandsFromSnapshot(
  snapshot: CommandSnapshot,
  batch: CanvasMutationBatchV1,
): CanvasHistoryReplayCommandV1[] {
  switch (snapshot.command.name) {
    case 'canvas.node.create':
      return [{
        name: 'canvas.node.delete',
        canvasId: batch.canvasId as string,
        nodeId: snapshot.command.nodeId,
      }];

    case 'canvas.node.move': {
      const moveSnapshot = snapshot as Extract<CommandSnapshot, { command: { name: 'canvas.node.move' } }>;
      const x = readOptionalNumber((moveSnapshot.node.layout as Record<string, unknown>)?.x) ?? 0;
      const y = readOptionalNumber((moveSnapshot.node.layout as Record<string, unknown>)?.y) ?? 0;
      return [{
        name: 'canvas.node.move',
        canvasId: batch.canvasId as string,
        nodeId: moveSnapshot.command.nodeId,
        x,
        y,
      }];
    }

    case 'canvas.node.reparent': {
      const reparentSnapshot = snapshot as Extract<CommandSnapshot, { command: { name: 'canvas.node.reparent' } }>;
      return [{
        name: 'canvas.node.reparent',
        canvasId: batch.canvasId as string,
        nodeId: reparentSnapshot.command.nodeId,
        parentNodeId: reparentSnapshot.node.parentNodeId ?? null,
      }];
    }

    case 'canvas.node.resize': {
      const resizeSnapshot = snapshot as Extract<CommandSnapshot, { command: { name: 'canvas.node.resize' } }>;
      const width = readOptionalNumber(readNodeRecordField(resizeSnapshot.node, 'width')) ?? resizeSnapshot.command.nextSize.width;
      const height = readOptionalNumber(readNodeRecordField(resizeSnapshot.node, 'height')) ?? resizeSnapshot.command.nextSize.height;
      return [{
        name: 'canvas.node.resize',
        canvasId: batch.canvasId as string,
        nodeId: resizeSnapshot.command.nodeId,
        handle: resizeSnapshot.command.handle,
        nextSize: { width, height },
        ...(resizeSnapshot.command.constraint ? { constraint: resizeSnapshot.command.constraint } : {}),
      }];
    }

    case 'canvas.node.rotate': {
      const rotateSnapshot = snapshot as Extract<CommandSnapshot, { command: { name: 'canvas.node.rotate' } }>;
      const previousRotation = readOptionalNumber(readNodeRecordField(rotateSnapshot.node, 'rotation')) ?? 0;
      return [{
        name: 'canvas.node.rotate',
        canvasId: batch.canvasId as string,
        nodeId: rotateSnapshot.command.nodeId,
        nextRotation: previousRotation,
      }];
    }

    case 'canvas.node.presentation-style.update': {
      const styleSnapshot = snapshot as Extract<CommandSnapshot, { command: { name: 'canvas.node.presentation-style.update' } }>;
      return [{
        name: 'canvas.node.presentation-style.update',
        canvasId: batch.canvasId as string,
        nodeId: styleSnapshot.command.nodeId,
        presentationStyle: buildPresentationStyleInversePatch(styleSnapshot.node, styleSnapshot.command),
      }];
    }

    case 'canvas.node.render-profile.update': {
      const renderSnapshot = snapshot as Extract<CommandSnapshot, { command: { name: 'canvas.node.render-profile.update' } }>;
      return [{
        name: 'canvas.node.render-profile.update',
        canvasId: batch.canvasId as string,
        nodeId: renderSnapshot.command.nodeId,
        renderProfile: buildRenderProfileInversePatch(renderSnapshot.node, renderSnapshot.command),
      }];
    }

    case 'canvas.node.rename': {
      const renameSnapshot = snapshot as Extract<CommandSnapshot, { command: { name: 'canvas.node.rename' } }>;
      const previousLabel = readOptionalString(readNodeRecordField(renameSnapshot.node, 'label')) ?? '';
      return [{
        name: 'canvas.node.rename',
        canvasId: batch.canvasId as string,
        nodeId: renameSnapshot.command.nodeId,
        nextDisplayName: previousLabel,
      }];
    }

    case 'canvas.node.delete': {
      const deleteSnapshot = snapshot as Extract<CommandSnapshot, { command: { name: 'canvas.node.delete' } }>;
      return buildRestoreDeletedNodeCommands({
        canvasId: batch.canvasId as string,
        node: deleteSnapshot.node,
        object: deleteSnapshot.object,
      });
    }

    case 'canvas.node.z-order.update': {
      const zOrderSnapshot = snapshot as Extract<CommandSnapshot, { command: { name: 'canvas.node.z-order.update' } }>;
      return [{
        name: 'canvas.node.z-order.update',
        canvasId: batch.canvasId as string,
        nodeId: zOrderSnapshot.command.nodeId,
        zIndex: zOrderSnapshot.node.zIndex,
      }];
    }

    case 'object.content.update': {
      const contentSnapshot = snapshot as Extract<CommandSnapshot, { command: { name: 'object.content.update' } }>;
      const previousBlocks = cloneContentBlocks(readContentBlocks(contentSnapshot.object)) ?? [];
      if (previousBlocks.length > 0) {
        const firstBlock = previousBlocks[0];
        if (firstBlock?.blockType !== 'text' && firstBlock?.blockType !== 'markdown') {
          return [];
        }

        const restoreCommands: CanvasHistoryReplayCommandV1[] = [{
          name: 'object.content.update',
          objectId: contentSnapshot.object.id,
          kind: firstBlock.blockType === 'text' ? 'text' : 'markdown',
          patch: firstBlock.blockType === 'text'
            ? { text: firstBlock.text, value: firstBlock.text }
            : { source: firstBlock.source, value: firstBlock.source },
          expectedContentKind: firstBlock.blockType === 'text' ? 'text' : 'markdown',
        }];

        for (const block of previousBlocks.slice(1)) {
          restoreCommands.push({
            name: 'object.body.block.insert',
            objectId: contentSnapshot.object.id,
            block: toBodyBlockEntity(block),
            position: { mode: 'end' },
          });
        }
        return restoreCommands;
      }

      if (contentSnapshot.object.capabilities.content) {
        return [{
          name: 'object.content.update',
          objectId: contentSnapshot.object.id,
          kind: contentSnapshot.object.capabilities.content.kind,
          patch: toContentPatchFromCapability(contentSnapshot.object.capabilities.content),
          expectedContentKind: contentSnapshot.object.capabilities.content.kind,
        }];
      }

      return [];
    }

    case 'object.capability.patch': {
      const capabilitySnapshot = snapshot as Extract<CommandSnapshot, { command: { name: 'object.capability.patch' } }>;
      if (capabilitySnapshot.command.capability === 'custom') {
        return [];
      }
      const previousCapability = capabilitySnapshot.object.capabilities[
        capabilitySnapshot.command.capability as keyof CanonicalObjectRecord['capabilities']
      ];
      if (!previousCapability) {
        return [{
          name: 'object.capability.patch',
          objectId: capabilitySnapshot.object.id,
          capability: capabilitySnapshot.command.capability,
          patch: null,
        }];
      }

      return [
        {
          name: 'object.capability.patch',
          objectId: capabilitySnapshot.object.id,
          capability: capabilitySnapshot.command.capability,
          patch: null,
        },
        {
          name: 'object.capability.patch',
          objectId: capabilitySnapshot.object.id,
          capability: capabilitySnapshot.command.capability,
          patch: isRecord(previousCapability) ? previousCapability : null,
        },
      ];
    }

    case 'object.body.block.insert': {
      const insertSnapshot = snapshot as Extract<CommandSnapshot, { command: { name: 'object.body.block.insert' } }>;
      return [{
        name: 'object.body.block.remove',
        objectId: insertSnapshot.command.objectId,
        target: {
          mode: 'block-id',
          blockId: insertSnapshot.command.block.blockId,
        },
      }];
    }

    case 'object.body.block.update': {
      const updateSnapshot = snapshot as Extract<CommandSnapshot, { command: { name: 'object.body.block.update' } }>;
      return [{
        name: 'object.body.block.update',
        objectId: updateSnapshot.command.objectId,
        target: {
          mode: 'block-id',
          blockId: updateSnapshot.blockId,
        },
        props: toBodyBlockPatch(updateSnapshot.previousBlock),
      }];
    }

    case 'object.body.block.remove': {
      const removeSnapshot = snapshot as Extract<CommandSnapshot, { command: { name: 'object.body.block.remove' } }>;
      const currentBlockIds = (readContentBlocks(removeSnapshot.object) ?? [])
        .map((block) => block.id)
        .filter((blockId) => blockId !== removeSnapshot.blockId);
      return [{
        name: 'object.body.block.insert',
        objectId: removeSnapshot.command.objectId,
        block: toBodyBlockEntity(removeSnapshot.previousBlock),
        position: createResolvedPositionForInsertIndex(removeSnapshot.blockIndex, currentBlockIds),
      }];
    }

    case 'object.body.block.reorder': {
      const reorderSnapshot = snapshot as Extract<CommandSnapshot, { command: { name: 'object.body.block.reorder' } }>;
      const currentBlockIds = (readContentBlocks(reorderSnapshot.object) ?? []).map((block) => block.id);
      const postForwardIds = simulateBlockReorder(currentBlockIds, reorderSnapshot.blockId, reorderSnapshot.nextIndex);
      return [{
        name: 'object.body.block.reorder',
        objectId: reorderSnapshot.command.objectId,
        target: {
          mode: 'block-id',
          blockId: reorderSnapshot.blockId,
        },
        position: createResolvedPositionForReorderIndex(reorderSnapshot.previousIndex, postForwardIds, reorderSnapshot.blockId),
      }];
    }

    default:
      return [];
  }
}

async function executeTranslatedBatch(input: {
  context: CanvasRuntimeServiceContext;
  batch: CanvasMutationBatchV1;
  translated: TranslatedCommand[];
}): Promise<{ result: MutationExecutionResult; bodyBlockIds: string[] }> {
  const operations = input.translated.flatMap((entry) => entry.operations);
  const bodyBlockIds = input.translated.flatMap((entry) => entry.bodyBlockIds);

  const result = await executeMutationBatch({
    context: input.context.headless,
    dryRun: input.batch.dryRun ?? false,
    appendRevision: false,
    batch: {
      workspaceRef: input.batch.workspaceId,
      canvasRef: input.batch.canvasId,
      ...(input.batch.actor
        ? {
            actor: {
              kind: input.batch.actor.kind,
              id: input.batch.actor.id,
            },
          }
        : {}),
      ...(input.batch.reason ? { reason: input.batch.reason } : {}),
      ...(input.batch.preconditions ? { preconditions: input.batch.preconditions } : {}),
      operations,
    } satisfies MutationBatch,
  });

  return {
    result,
    bodyBlockIds,
  };
}

function createHistoryEntry(input: {
  context: CanvasRuntimeServiceContext;
  batch: CanvasMutationBatchV1;
  result: MutationExecutionResult;
  mutationId: string;
  bodyBlockIds: string[];
  forwardCommands: CanvasHistoryReplayCommandV1[];
  inverseCommands: CanvasHistoryReplayCommandV1[];
  undoable?: boolean;
}): CanvasHistoryEntryV1 | null {
  if (input.batch.dryRun || !input.batch.canvasId) {
    return null;
  }

  const sessionId = input.batch.sessionId ?? input.batch.actor?.id;
  return {
    historyEntryId: input.context.createId(),
    canvasId: input.batch.canvasId,
    ...(input.batch.actor ? { actor: input.batch.actor } : {}),
    ...(sessionId ? { sessionId } : {}),
    mutationId: input.mutationId,
    forwardMutation: {
      workspaceId: input.batch.workspaceId,
      canvasId: input.batch.canvasId,
      ...(input.batch.actor ? { actor: input.batch.actor } : {}),
      ...(sessionId ? { sessionId } : {}),
      ...(input.batch.reason ? { reason: input.batch.reason } : {}),
      commands: input.forwardCommands,
      normalization: {
        source: 'resolved-before-commit',
        resolvedAgainstRevision: input.result.canvasRevisionAfter,
      },
    },
    ...(input.inverseCommands.length > 0
      ? {
          inverseMutation: {
            workspaceId: input.batch.workspaceId,
            canvasId: input.batch.canvasId,
            ...(input.batch.actor ? { actor: input.batch.actor } : {}),
            ...(sessionId ? { sessionId } : {}),
            ...(input.batch.reason ? { reason: input.batch.reason } : {}),
            commands: input.inverseCommands,
            normalization: {
              source: 'resolved-before-commit',
              resolvedAgainstRevision: input.result.canvasRevisionAfter,
            },
          },
        }
      : {}),
    revisionBefore: input.result.canvasRevisionBefore,
    revisionAfter: input.result.canvasRevisionAfter,
    changed: {
      canvases: input.batch.canvasId ? [input.batch.canvasId] : [],
      nodes: [...input.result.changed.nodes],
      objects: [...input.result.changed.objects],
      bodyBlocks: [...new Set(input.bodyBlockIds)],
      edges: [...input.result.changed.edges],
      pluginInstances: [...input.result.changed.pluginInstances],
    },
    undoable: input.undoable ?? true,
  };
}

function isRevisionConflict(error: unknown): error is { code: string; message: string; details?: { expected?: number; actual?: number } } {
  return typeof error === 'object'
    && error !== null
    && (error as { code?: string }).code === 'DOCUMENT_REVISION_CONFLICT';
}

function toFailureCode(error: unknown): MutationFailureCodeV1 {
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
  if (code.includes('VALID') || code.includes('ARGUMENT')) {
    return 'VALIDATION_FAILED';
  }
  return 'INTERNAL_ERROR';
}

async function appendRuntimeRevisionRecord(input: {
  context: CanvasRuntimeServiceContext;
  batch: CanvasMutationBatchV1;
  historyEntry: CanvasHistoryEntryV1;
  kind: 'mutation' | 'undo' | 'redo';
  sourceRevisionNo?: number | null;
  sourceHistoryEntryId?: string | null;
}): Promise<RuntimeCanvasRevisionRecord> {
  const actor = input.batch.actor ?? { kind: 'agent' as const, id: 'magam-cli' };
  const revisionNo = input.historyEntry.revisionAfter ?? 0;
  const record: RuntimeCanvasRevisionRecord = {
    id: input.context.createId(),
    canvasId: input.historyEntry.canvasId,
    revisionNo,
    authorKind: actor.kind,
    authorId: actor.id,
    sessionId: input.historyEntry.sessionId ?? null,
    mutationBatch: input.batch as unknown as Record<string, unknown>,
    runtimeHistory: {
      kind: input.kind,
      sourceRevisionNo: input.sourceRevisionNo ?? null,
      sourceHistoryEntryId: input.sourceHistoryEntryId ?? null,
      entry: input.historyEntry,
    },
    createdAt: input.context.now(),
  };
  const appended = await input.context.repository.appendCanvasRevision(record);
  if (!appended.ok) {
    throw new Error(appended.message);
  }
  return appended.value;
}

async function upsertCursorForMutation(input: {
  context: CanvasRuntimeServiceContext;
  historyEntry: CanvasHistoryEntryV1;
}): Promise<void> {
  if (!input.historyEntry.actor?.id || !input.historyEntry.sessionId || input.historyEntry.revisionAfter === null) {
    return;
  }

  const result = await input.context.repository.upsertCanvasHistoryCursor({
    canvasId: input.historyEntry.canvasId,
    actorId: input.historyEntry.actor.id,
    sessionId: input.historyEntry.sessionId,
    undoRevisionNo: input.historyEntry.revisionAfter,
    redoRevisionNo: null,
    updatedAt: input.context.now(),
  });
  if (!result.ok) {
    throw new Error(result.message);
  }
}

function toHistoryFailureEnvelope(error: unknown): MutationResultEnvelopeV1 {
  if (isRevisionConflict(error)) {
    return createMutationFailureEnvelope({
      code: 'VERSION_CONFLICT',
      message: (error as { message?: string }).message ?? 'Version conflict.',
      retryable: true,
      details: {
        expectedCanvasRevision: (error as { details?: { expected?: number } }).details?.expected ?? null,
        actualCanvasRevision: (error as { details?: { actual?: number } }).details?.actual ?? null,
      },
    });
  }

  return createMutationFailureEnvelope({
    code: toFailureCode(error),
    message: error instanceof Error ? error.message : 'Runtime mutation failed.',
    retryable: false,
  });
}

export async function dispatchCanvasHistoryReplay(input: {
  context: CanvasRuntimeServiceContext;
  batch: CanvasMutationBatchV1;
  historyKind: 'undo' | 'redo';
  sourceRevisionNo: number;
  sourceHistoryEntryId?: string | null;
  forwardCommands: CanvasHistoryReplayCommandV1[];
  inverseCommands: CanvasHistoryReplayCommandV1[];
}): Promise<DispatchCanvasMutationResult> {
  const translated = await Promise.all(
    input.batch.commands.map((command) => translateCommand(input.context, input.batch, command)),
  );
  const mutationId = input.context.createId();

  try {
    const execution = await executeTranslatedBatch({
      context: input.context,
      batch: input.batch,
      translated,
    });

    const historyEntry = createHistoryEntry({
      context: input.context,
      batch: input.batch,
      result: execution.result,
      mutationId,
      bodyBlockIds: execution.bodyBlockIds,
      forwardCommands: input.forwardCommands,
      inverseCommands: input.inverseCommands,
      undoable: false,
    });

    if (historyEntry) {
      await appendRuntimeRevisionRecord({
        context: input.context,
        batch: input.batch,
        historyEntry,
        kind: input.historyKind,
        sourceRevisionNo: input.sourceRevisionNo,
        sourceHistoryEntryId: input.sourceHistoryEntryId ?? null,
      });
    }

    const envelope = createMutationSuccessEnvelope({
      mutationId,
      result: execution.result,
      canvasId: input.batch.canvasId,
      bodyBlockIds: execution.bodyBlockIds,
      historyEntry,
    });

    return {
      envelope,
      historyEntry,
      events: publishRuntimeEvents({
        context: input.context,
        canvasId: input.batch.canvasId,
        result: envelope,
        causedByCommandName: input.batch.commands[0]?.name,
      }),
    };
  } catch (error) {
    const envelope = toHistoryFailureEnvelope(error);
    return {
      envelope,
      historyEntry: null,
      events: publishRuntimeEvents({
        context: input.context,
        canvasId: input.batch.canvasId,
        result: envelope,
        causedByCommandName: input.batch.commands[0]?.name,
      }),
    };
  }
}

export async function dispatchCanvasMutation(
  context: CanvasRuntimeServiceContext,
  batch: CanvasMutationBatchV1,
): Promise<DispatchCanvasMutationResult> {
  const translated = await Promise.all(batch.commands.map((command) => translateCommand(context, batch, command)));
  const snapshots: CommandSnapshot[] = [];
  if (!batch.dryRun) {
    const knownCreated = {
      nodeIds: new Set<string>(),
      objectIds: new Set<string>(),
    };
    for (const command of batch.commands) {
      const snapshot = await captureCommandSnapshot(context, batch, command, knownCreated);
      if (snapshot) {
        snapshots.push(snapshot);
      }
      if (command.name === 'canvas.node.create') {
        knownCreated.nodeIds.add(command.nodeId);
        knownCreated.objectIds.add(command.nodeId);
      }
    }
  }
  const mutationId = context.createId();

  try {
    const execution = await executeTranslatedBatch({
      context,
      batch,
      translated,
    });

    const forwardCommands = batch.commands as CanvasHistoryReplayCommandV1[];
    const inverseCommands = snapshots
      .slice()
      .reverse()
      .flatMap((snapshot) => buildInverseCommandsFromSnapshot(snapshot, batch));
    const historyEntry = createHistoryEntry({
      context,
      batch,
      result: execution.result,
      mutationId,
      bodyBlockIds: execution.bodyBlockIds,
      forwardCommands,
      inverseCommands,
    });

    if (historyEntry) {
      await appendRuntimeRevisionRecord({
        context,
        batch,
        historyEntry,
        kind: 'mutation',
      });
      await upsertCursorForMutation({
        context,
        historyEntry,
      });
    }

    const envelope = createMutationSuccessEnvelope({
      mutationId,
      result: execution.result,
      canvasId: batch.canvasId,
      bodyBlockIds: execution.bodyBlockIds,
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
    const envelope = toHistoryFailureEnvelope(error);
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
