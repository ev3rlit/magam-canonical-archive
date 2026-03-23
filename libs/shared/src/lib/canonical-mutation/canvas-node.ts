import { and, eq } from 'drizzle-orm';
import type { HeadlessServiceContext } from '../canonical-cli';
import { cliError } from '../canonical-cli';
import { validateCanvasNodeRecord } from '../canonical-persistence/validators';
import { canvasNodes } from '../canonical-persistence/schema';
import type { CanvasNodeRecord } from '../canonical-persistence/records';

function toCanvasNodeRecord(row: typeof canvasNodes.$inferSelect): CanvasNodeRecord {
  return {
    id: row.id,
    canvasId: row.canvasId,
    surfaceId: row.surfaceId,
    nodeKind: row.nodeKind,
    nodeType: row.nodeType ?? null,
    parentNodeId: row.parentNodeId ?? null,
    canonicalObjectId: row.canonicalObjectId ?? null,
    pluginInstanceId: row.pluginInstanceId ?? null,
    props: row.props ?? null,
    layout: row.layout,
    style: row.style ?? null,
    persistedState: row.persistedState ?? null,
    zIndex: row.zIndex,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getCanvasNode(
  context: HeadlessServiceContext,
  canvasId: string,
  nodeId: string,
): Promise<CanvasNodeRecord> {
  const row = await context.db.query.canvasNodes.findFirst({
    where: and(
      eq(canvasNodes.canvasId, canvasId),
      eq(canvasNodes.id, nodeId),
    ),
  });

  if (!row) {
    throw cliError('NODE_NOT_FOUND', `Canvas node ${nodeId} was not found in document ${canvasId}.`, {
      details: { canvasId, nodeId },
    });
  }

  return toCanvasNodeRecord(row);
}

export function applyCanvasNodeMove(
  node: CanvasNodeRecord,
  patch: { x: number; y: number },
): CanvasNodeRecord {
  const next: CanvasNodeRecord = {
    ...node,
    layout: {
      ...node.layout,
      x: patch.x,
      y: patch.y,
    },
    updatedAt: new Date(),
  };
  const validation = validateCanvasNodeRecord(next);
  if (!validation.ok) {
    throw cliError(validation.code, validation.message, {
      details: {
        ...(validation.path ? { path: validation.path } : {}),
      },
    });
  }

  return validation.value;
}

export function applyCanvasNodeReparent(
  node: CanvasNodeRecord,
  parentNodeId: string | null,
): CanvasNodeRecord {
  const next: CanvasNodeRecord = {
    ...node,
    parentNodeId,
    updatedAt: new Date(),
  };
  const validation = validateCanvasNodeRecord(next);
  if (!validation.ok) {
    throw cliError(validation.code, validation.message, {
      details: {
        ...(validation.path ? { path: validation.path } : {}),
      },
    });
  }

  return validation.value;
}

export async function persistCanvasNode(
  context: HeadlessServiceContext,
  node: CanvasNodeRecord,
): Promise<void> {
  await context.db
    .update(canvasNodes)
    .set({
      parentNodeId: node.parentNodeId ?? null,
      props: node.props ?? null,
      layout: node.layout,
      style: node.style ?? null,
      persistedState: node.persistedState ?? null,
      updatedAt: node.updatedAt ?? new Date(),
    })
    .where(
      and(
        eq(canvasNodes.canvasId, node.canvasId),
        eq(canvasNodes.id, node.id),
      ),
    );
}
