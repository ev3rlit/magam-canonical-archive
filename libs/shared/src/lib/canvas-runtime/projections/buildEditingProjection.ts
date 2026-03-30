import { readContentBlocks } from '../../canonical-object-contract';
import type { CanonicalObjectRecord } from '../../canonical-object-contract';
import {
  contentBlocksToCanonicalBody,
  contentCapabilityToCanonicalBody,
  getBodyBlockIdAtIndex,
  getTopLevelBodyNodes,
  readCanonicalBody,
} from '../../canonical-body-document';
import type {
  CanvasEditingProjectionRequestV1,
  CanvasEditingProjectionResponseV1,
  CanvasRuntimeCommandNameV1,
  InteractionCapabilitiesV1,
} from '../contracts';
import type { CanvasRuntimeServiceContext } from '../application/serviceContext';

function createNodeSelectionKey(nodeId: string): string {
  return `node:${nodeId}`;
}

function createBodySelectionKey(objectId: string, blockId: string, index: number): string {
  return `object:${objectId}:body:${index}:${blockId}`;
}

function createAnchorId(nodeId: string, kind: string, suffix?: string): string {
  return suffix ? `node:${nodeId}:${kind}:${suffix}` : `node:${nodeId}:${kind}`;
}

function deriveInteractionCapabilities(input: {
  nodeKind: string;
  nodeType?: string | null;
  locked: boolean;
  objectRecord: CanonicalObjectRecord | null;
}): InteractionCapabilitiesV1 {
  if (input.locked) {
    return {
      selectable: true,
      movable: false,
      reparentable: false,
      renamable: false,
      deletable: false,
      zOrderEditable: false,
      objectContentEditable: false,
      objectCapabilityPatchable: false,
      bodyEntrySupported: false,
    };
  }

  const bodyBlocks = readContentBlocks(input.objectRecord ?? {}) ?? [];
  const body = readCanonicalBody(input.objectRecord ?? {})
    ?? (bodyBlocks.length > 0 ? contentBlocksToCanonicalBody(bodyBlocks) : null)
    ?? (input.objectRecord?.capabilities.content ? contentCapabilityToCanonicalBody(input.objectRecord.capabilities.content) : null);
  const bodyEntrySupported = Boolean(body) || input.objectRecord?.primaryContentKind === 'document';

  return {
    selectable: true,
    movable: true,
    reparentable: true,
    renamable: true,
    deletable: true,
    zOrderEditable: true,
    objectContentEditable: Boolean(input.objectRecord),
    objectCapabilityPatchable: Boolean(input.objectRecord),
    bodyEntrySupported,
  };
}

function deriveAllowedCommands(input: {
  nodeId: string;
  canonicalObjectId: string | null;
  parentNodeId: string | null;
  capabilities: InteractionCapabilitiesV1;
}): CanvasRuntimeCommandNameV1[] {
  const commands: CanvasRuntimeCommandNameV1[] = [];
  if (input.capabilities.movable) {
    commands.push('canvas.node.move');
  }
  if (input.capabilities.reparentable) {
    commands.push('canvas.node.reparent');
  }
  if (input.capabilities.zOrderEditable) {
    commands.push('canvas.node.z-order.update');
    commands.push('canvas.node.resize');
    commands.push('canvas.node.rotate');
    commands.push('canvas.node.presentation-style.update');
    commands.push('canvas.node.render-profile.update');
    commands.push('canvas.node.rename');
  }
  if (input.capabilities.deletable) {
    commands.push('canvas.node.delete');
  }
  if (input.capabilities.objectContentEditable && input.canonicalObjectId) {
    commands.push('object.content.update');
    commands.push('object.capability.patch');
  }
  if (input.capabilities.bodyEntrySupported && input.canonicalObjectId) {
    commands.push('object.body.replace');
    commands.push('object.body.block.insert');
    commands.push('object.body.block.update');
    commands.push('object.body.block.remove');
    commands.push('object.body.block.reorder');
  }
  return [...new Set(commands)];
}

function toBodyBlockKind(blockType: string): import('../contracts').BodyBlockKindV1 {
  switch (blockType) {
    case 'text':
      return 'paragraph';
    case 'markdown':
      return 'callout';
    default:
      if (blockType.includes('image')) {
        return 'image';
      }
      if (blockType.includes('code')) {
        return 'code';
      }
      return 'custom';
  }
}

function toBodyBlockKindFromNode(nodeType: string): import('../contracts').BodyBlockKindV1 {
  switch (nodeType) {
    case 'paragraph':
      return 'paragraph';
    case 'heading':
      return 'heading';
    case 'bulletList':
    case 'orderedList':
    case 'taskList':
      return 'checklist';
    case 'blockquote':
      return 'quote';
    case 'codeBlock':
      return 'code';
    case 'horizontalRule':
      return 'divider';
    case 'image':
      return 'image';
    default:
      return 'custom';
  }
}

function previewTextForBlock(block: NonNullable<ReturnType<typeof readContentBlocks>>[number] | undefined): string | null {
  if (!block) {
    return null;
  }
  if (block.blockType === 'text') {
    return block.text.slice(0, 120);
  }
  if (block.blockType === 'markdown') {
    return block.source.slice(0, 120);
  }
  return typeof block.textualProjection === 'string' ? block.textualProjection.slice(0, 120) : null;
}

export async function buildEditingProjection(
  context: CanvasRuntimeServiceContext,
  request: CanvasEditingProjectionRequestV1,
): Promise<CanvasEditingProjectionResponseV1> {
  const workspaceId = request.workspaceId ?? context.headless.defaultWorkspaceId;
  const allNodes = await context.repository.listCanvasNodes(request.canvasId, request.surfaceId);
  const canvasRevision = typeof context.repository.getLatestCanvasRevision === 'function'
    ? await context.repository.getLatestCanvasRevision(request.canvasId)
    : 0;
  const nodes = request.nodeIds?.length
    ? allNodes.filter((node) => request.nodeIds?.includes(node.id))
    : allNodes;
  const objects = await context.repository.listCanonicalObjects(workspaceId);
  const objectsById = new Map(objects.map((record) => [record.id, record]));

  return {
    canvasId: request.canvasId,
    canvasRevision,
    workspaceId,
    surfaceId: request.surfaceId ?? null,
    nodes: nodes.map((node) => {
      const objectRecord = node.canonicalObjectId ? objectsById.get(node.canonicalObjectId) ?? null : null;
      const bodyBlocks = readContentBlocks(objectRecord ?? {}) ?? [];
      const body = readCanonicalBody(objectRecord ?? {})
        ?? (bodyBlocks.length > 0 ? contentBlocksToCanonicalBody(bodyBlocks) : null)
        ?? (objectRecord?.capabilities.content ? contentCapabilityToCanonicalBody(objectRecord.capabilities.content) : null);
      const topLevelNodes = body ? getTopLevelBodyNodes(body) : [];
      const locked = node.props?.['locked'] === true;
      const interactionCapabilities = deriveInteractionCapabilities({
        nodeKind: node.nodeKind,
        nodeType: node.nodeType,
        locked,
        objectRecord,
      });
      const allowedCommands = deriveAllowedCommands({
        nodeId: node.id,
        canonicalObjectId: node.canonicalObjectId ?? null,
        parentNodeId: node.parentNodeId ?? null,
        capabilities: interactionCapabilities,
      });

      return {
        nodeId: node.id,
        surfaceId: node.surfaceId,
        canonicalObjectId: node.canonicalObjectId ?? null,
        pluginInstanceId: node.pluginInstanceId ?? null,
        selectionKey: createNodeSelectionKey(node.id),
        allowedCommands,
        interactionCapabilities,
        bodyEntry: {
          supported: interactionCapabilities.bodyEntrySupported,
          targetObjectId: node.canonicalObjectId ?? null,
          preferredCommandName: interactionCapabilities.bodyEntrySupported
            ? 'object.body.replace'
            : null,
          mode: interactionCapabilities.bodyEntrySupported ? 'object-body' : null,
        },
        body: body ?? null,
        bodySource: body
          ? (readCanonicalBody(objectRecord ?? {}) ? 'native' : 'legacy-converted')
          : null,
        anchors: [
          {
            anchorId: createAnchorId(node.id, 'shell'),
            anchorKind: 'node-shell',
            nodeId: node.id,
            surfaceId: node.surfaceId,
            canonicalObjectId: node.canonicalObjectId ?? null,
          },
          {
            anchorId: createAnchorId(node.id, 'label'),
            anchorKind: 'node-label',
            nodeId: node.id,
            surfaceId: node.surfaceId,
            canonicalObjectId: node.canonicalObjectId ?? null,
          },
          ...topLevelNodes.flatMap((block, index) => {
            const blockId = getBodyBlockIdAtIndex(index);
            return ([
            {
              anchorId: createAnchorId(node.id, 'body-before', blockId),
              anchorKind: 'body-block-before' as const,
              nodeId: node.id,
              surfaceId: node.surfaceId,
              canonicalObjectId: node.canonicalObjectId ?? null,
              bodyBlockId: blockId,
            },
            {
              anchorId: createAnchorId(node.id, 'body-content', blockId),
              anchorKind: 'body-block-content' as const,
              nodeId: node.id,
              surfaceId: node.surfaceId,
              canonicalObjectId: node.canonicalObjectId ?? null,
              bodyBlockId: blockId,
            },
            {
              anchorId: createAnchorId(node.id, 'body-after', blockId),
              anchorKind: 'body-block-after' as const,
              nodeId: node.id,
              surfaceId: node.surfaceId,
              canonicalObjectId: node.canonicalObjectId ?? null,
              bodyBlockId: blockId,
            },
          ]);
          }),
        ],
        bodyBlocks: topLevelNodes.map((block, index) => {
          const blockId = getBodyBlockIdAtIndex(index);
          return ({
          blockId,
          kind: toBodyBlockKindFromNode(block.type),
          index,
          selectionKey: createBodySelectionKey(node.canonicalObjectId ?? node.id, blockId, index),
          contentAnchorId: createAnchorId(node.id, 'body-content', blockId),
          beforeAnchorId: createAnchorId(node.id, 'body-before', blockId),
          afterAnchorId: createAnchorId(node.id, 'body-after', blockId),
          previewText: previewTextForBlock(bodyBlocks[index]),
        });
        }),
        selectedBodyBlockId: null,
      };
    }),
  };
}
