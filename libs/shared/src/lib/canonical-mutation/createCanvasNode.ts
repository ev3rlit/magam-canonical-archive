import { randomUUID } from 'node:crypto';
import type { CanonicalObjectAlias, CanonicalObjectRecord } from '../canonical-object-contract';
import type { HeadlessServiceContext } from '../canonical-cli';
import { cliError, persistenceFailureToCliError } from '../canonical-cli';
import type { CanvasNodeRecord, ObjectRelationRecord } from '../canonical-persistence/records';
import {
  isBodyCapableNativeNodeType,
} from '../canonical-persistence/validators';
import { createBodyParagraphNode, createCanonicalBodyDocument, markdownToCanonicalBody } from '../canonical-body-document';
import { deriveCanonicalTextFromBody } from '../canonical-body-document';
import type { CanvasNodeCreateOperation, MutationChangedSet } from './types';

const DEFAULT_SURFACE_ID = 'main';
const CHILD_X_OFFSET = 220;
const CHILD_Y_OFFSET = 120;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneProps(props: Record<string, unknown> | undefined): Record<string, unknown> {
  return JSON.parse(JSON.stringify(props ?? {})) as Record<string, unknown>;
}

function readNumericLayoutValue(layout: Record<string, unknown>, key: string): number | null {
  const value = layout[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readRecordProp(props: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const value = props[key];
  return isRecord(value) ? value : null;
}

function pushChangedId(values: string[], id: string): void {
  if (!values.includes(id)) {
    values.push(id);
  }
}

function resolveSemanticDescriptor(input: {
  nodeType: CanvasNodeCreateOperation['nodeType'];
  placement: CanvasNodeCreateOperation['placement'];
}): {
  semanticRole: CanonicalObjectRecord['semanticRole'];
  publicAlias: CanonicalObjectAlias;
} {
  if (input.placement.mode === 'mindmap-child' || input.placement.mode === 'mindmap-sibling') {
    return {
      semanticRole: 'topic',
      publicAlias: 'Node',
    };
  }

  switch (input.nodeType) {
    case 'shape':
    case 'rectangle':
    case 'ellipse':
    case 'diamond':
    case 'line':
      return {
        semanticRole: 'shape',
        publicAlias: 'Shape',
      };
    case 'sticky':
      return {
        semanticRole: 'sticky-note',
        publicAlias: 'Sticky',
      };
    case 'markdown':
      return {
        semanticRole: 'topic',
        publicAlias: 'Markdown',
      };
    case 'image':
      return {
        semanticRole: 'image',
        publicAlias: 'Image',
      };
    case 'sticker':
      return {
        semanticRole: 'sticker',
        publicAlias: 'Sticker',
      };
    default:
      return {
        semanticRole: 'topic',
        publicAlias: 'Node',
      };
  }
}

function toSeededBody(input: {
  operation: CanvasNodeCreateOperation;
  props: Record<string, unknown>;
}): CanonicalObjectRecord['body'] | undefined {
  if (!isBodyCapableNativeNodeType(input.operation.nodeType)) {
    return undefined;
  }

  const content = typeof input.props['content'] === 'string' ? input.props['content'] : '';
  return content.length > 0
    ? markdownToCanonicalBody(content)
    : createCanonicalBodyDocument([createBodyParagraphNode()]);
}

function toCanonicalObjectRecord(input: {
  workspaceId: string;
  operation: CanvasNodeCreateOperation;
  props: Record<string, unknown>;
}): CanonicalObjectRecord {
  const descriptor = resolveSemanticDescriptor({
    nodeType: input.operation.nodeType,
    placement: input.operation.placement,
  });
  const seededBody = toSeededBody({
    operation: input.operation,
    props: input.props,
  });

  return {
    id: input.operation.nodeId,
    workspaceId: input.workspaceId,
    semanticRole: descriptor.semanticRole,
    publicAlias: descriptor.publicAlias,
    sourceMeta: {
      sourceId: input.operation.nodeId,
      kind: input.operation.placement.mode === 'canvas-absolute' ? 'canvas' : 'mindmap',
      ...(input.operation.placement.mode === 'mindmap-root'
        ? { scopeId: input.operation.placement.mindmapId }
        : {}),
    },
    capabilities: {},
    ...(seededBody ? { body: seededBody, bodySchemaVersion: 1 } : {}),
    primaryContentKind: seededBody ? 'document' : null,
    canonicalText: seededBody ? deriveCanonicalTextFromBody(seededBody) : '',
  };
}

function toCanvasNodeProps(input: {
  props: Record<string, unknown>;
  parentNodeId: string | null;
}): Record<string, unknown> {
  const props = { ...input.props };
  delete props['content'];
  delete props['x'];
  delete props['y'];
  delete props['from'];

  const size = readRecordProp(props, 'size');
  if (
    size
    && !('width' in props)
    && typeof size['width'] === 'number'
    && Number.isFinite(size['width'])
  ) {
    props['width'] = size['width'];
  }
  if (
    size
    && !('height' in props)
    && typeof size['height'] === 'number'
    && Number.isFinite(size['height'])
  ) {
    props['height'] = size['height'];
  }

  if (input.parentNodeId) {
    props['from'] = input.parentNodeId;
  }

  return props;
}

async function requireCanvasNode(input: {
  context: HeadlessServiceContext;
  canvasId: string;
  nodeId: string;
}): Promise<CanvasNodeRecord> {
  const result = await input.context.repository.getCanvasNode(input.canvasId, input.nodeId);
  if (!result.ok) {
    throw cliError('NODE_NOT_FOUND', `Canvas node ${input.nodeId} was not found in document ${input.canvasId}.`, {
      details: { canvasId: input.canvasId, nodeId: input.nodeId },
    });
  }
  return result.value;
}

async function resolvePlacement(input: {
  context: HeadlessServiceContext;
  canvasId: string;
  operation: CanvasNodeCreateOperation;
}): Promise<{
  layout: CanvasNodeRecord['layout'];
  parentNodeId: string | null;
  surfaceId: string;
  relation?: ObjectRelationRecord;
}> {
  if (input.operation.placement.mode === 'canvas-absolute') {
    return {
      layout: {
        x: input.operation.placement.x,
        y: input.operation.placement.y,
      },
      parentNodeId: null,
      surfaceId: DEFAULT_SURFACE_ID,
    };
  }

  if (input.operation.placement.mode === 'mindmap-root') {
    return {
      layout: {
        x: input.operation.placement.x,
        y: input.operation.placement.y,
      },
      parentNodeId: null,
      surfaceId: DEFAULT_SURFACE_ID,
    };
  }

  if (input.operation.placement.mode === 'mindmap-child') {
    const parentNode = await requireCanvasNode({
      context: input.context,
      canvasId: input.canvasId,
      nodeId: input.operation.placement.parentId,
    });
    const siblings = await input.context.repository.listCanvasNodes(input.canvasId, parentNode.surfaceId);
    const childCount = siblings.filter((candidate) => candidate.parentNodeId === parentNode.id).length;
    const parentX = readNumericLayoutValue(parentNode.layout, 'x') ?? 0;
    const parentY = readNumericLayoutValue(parentNode.layout, 'y') ?? 0;

    return {
      layout: {
        x: parentX + CHILD_X_OFFSET,
        y: parentY + (childCount * CHILD_Y_OFFSET),
      },
      parentNodeId: parentNode.id,
      surfaceId: parentNode.surfaceId,
      ...(parentNode.canonicalObjectId
        ? {
            relation: {
              id: `rel-${randomUUID()}`,
              workspaceId: input.context.defaultWorkspaceId,
              fromObjectId: parentNode.canonicalObjectId,
              toObjectId: input.operation.nodeId,
              relationType: 'mindmap-child',
              metadata: {
                canvasId: input.canvasId,
                surfaceId: parentNode.surfaceId,
              },
            },
          }
        : {}),
    };
  }

  const siblingNode = await requireCanvasNode({
    context: input.context,
    canvasId: input.canvasId,
    nodeId: input.operation.placement.siblingOf,
  });
  const parentNodeId = input.operation.placement.parentId ?? siblingNode.parentNodeId ?? null;
  let relation: ObjectRelationRecord | undefined;

  if (parentNodeId) {
    const parentNode = await requireCanvasNode({
      context: input.context,
      canvasId: input.canvasId,
      nodeId: parentNodeId,
    });
    if (parentNode.canonicalObjectId) {
      relation = {
        id: `rel-${randomUUID()}`,
        workspaceId: input.context.defaultWorkspaceId,
        fromObjectId: parentNode.canonicalObjectId,
        toObjectId: input.operation.nodeId,
        relationType: 'mindmap-child',
        metadata: {
          canvasId: input.canvasId,
          surfaceId: siblingNode.surfaceId,
        },
      };
    }
  }

  return {
    layout: {
      x: readNumericLayoutValue(siblingNode.layout, 'x') ?? 0,
      y: (readNumericLayoutValue(siblingNode.layout, 'y') ?? 0) + CHILD_Y_OFFSET,
    },
    parentNodeId,
    surfaceId: siblingNode.surfaceId,
    ...(relation ? { relation } : {}),
  };
}

export async function createCanvasNodeOperation(input: {
  context: HeadlessServiceContext;
  canvasId: string;
  operation: CanvasNodeCreateOperation;
  changed: MutationChangedSet;
  apply: boolean;
}): Promise<void> {
  const props = cloneProps(input.operation.props);
  const placement = await resolvePlacement({
    context: input.context,
    canvasId: input.canvasId,
    operation: input.operation,
  });
  const canonicalObject = toCanonicalObjectRecord({
    workspaceId: input.context.defaultWorkspaceId,
    operation: input.operation,
    props,
  });
  const nodeRecord: CanvasNodeRecord = {
    id: input.operation.nodeId,
    canvasId: input.canvasId,
    surfaceId: placement.surfaceId,
    nodeKind: 'native',
    nodeType: input.operation.nodeType,
    parentNodeId: placement.parentNodeId,
    canonicalObjectId: canonicalObject.id,
    props: toCanvasNodeProps({
      props,
      parentNodeId: placement.parentNodeId,
    }),
    layout: placement.layout,
    zIndex: await input.context.repository.getNextCanvasNodeZIndex(input.canvasId, placement.surfaceId),
  };

  if (!input.apply) {
    const objectValidation = input.context.repository.validateCanonicalObjectRecord(canonicalObject);
    if (!objectValidation.ok) {
      throw persistenceFailureToCliError(objectValidation);
    }

    const nodeValidation = input.context.repository.validateCanvasNodeRecord(nodeRecord);
    if (!nodeValidation.ok) {
      throw persistenceFailureToCliError(nodeValidation);
    }
  } else {
    const created = await input.context.repository.createNativeCanvasNodeComposition({
      object: canonicalObject,
      node: nodeRecord,
      relation: placement.relation,
    });
    if (!created.ok) {
      throw persistenceFailureToCliError(created);
    }
  }

  pushChangedId(input.changed.objects, canonicalObject.id);
  pushChangedId(input.changed.nodes, nodeRecord.id);
}
