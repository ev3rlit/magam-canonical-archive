import { desc, eq } from 'drizzle-orm';
import type { HeadlessServiceContext } from '../canonical-cli';
import { cliError } from '../canonical-cli';
import { canvasBindings, canvasNodes, canvasRevisions } from '../canonical-persistence/schema';

export interface WorkspaceSummary {
  id: string;
  targetDir: string;
  dataDir: string | null;
  objectCount: number;
  canvasCount: number;
  surfaceCount: number;
}

export interface CanvasSummary {
  id: string;
  surfaceIds: string[];
  nodeCount: number;
  bindingCount: number;
  latestRevision: number | null;
}

export interface WorkspaceCanvasShellSummary {
  canvasId: string;
  workspaceId: string;
  filePath: string | null;
  surfaceIds: string[];
  nodeCount: number;
  bindingCount: number;
  latestRevision: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readCanvasShellMetadata(
  mutationBatch: Record<string, unknown> | null | undefined,
): { workspaceId?: string; filePath?: string | null } | null {
  if (!isRecord(mutationBatch)) {
    return null;
  }

  const shell = isRecord(mutationBatch.canvasShell)
    ? mutationBatch.canvasShell
    : isRecord(mutationBatch.meta) && isRecord(mutationBatch.meta.canvasShell)
      ? mutationBatch.meta.canvasShell
      : null;

  if (!shell) {
    return null;
  }

  return {
    ...(typeof shell.workspaceId === 'string' ? { workspaceId: shell.workspaceId } : {}),
    ...(typeof shell.filePath === 'string' ? { filePath: shell.filePath } : { filePath: null }),
  };
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && value.length > 0))];
}

export async function listWorkspaceIds(context: HeadlessServiceContext): Promise<string[]> {
  const objects = await context.repository.listCanonicalObjects(context.defaultWorkspaceId);
  const fallbackIds = objects.map((record) => record.workspaceId);
  const allObjects = await context.db.query.canonicalObjects.findMany({
    columns: {
      workspaceId: true,
    },
  });

  return uniqueStrings([
    context.defaultWorkspaceId,
    ...fallbackIds,
    ...allObjects.map((row) => row.workspaceId),
  ]);
}

export async function listCanvasIds(context: HeadlessServiceContext): Promise<string[]> {
  const [nodes, bindings, revisions] = await Promise.all([
    context.db.query.canvasNodes.findMany({
      columns: { canvasId: true },
    }),
    context.db.query.canvasBindings.findMany({
      columns: { canvasId: true },
    }),
    context.db.query.canvasRevisions.findMany({
      columns: { canvasId: true },
    }),
  ]);

  return uniqueStrings([
    ...nodes.map((row) => row.canvasId),
    ...bindings.map((row) => row.canvasId),
    ...revisions.map((row) => row.canvasId),
  ]);
}

async function summarizeWorkspace(
  context: HeadlessServiceContext,
  workspaceId: string,
): Promise<WorkspaceSummary> {
  const objects = await context.repository.listCanonicalObjects(workspaceId);
  const canonicalObjectIds = new Set(objects.map((record) => record.id));
  const nodes = await context.db.query.canvasNodes.findMany({
    columns: {
      canvasId: true,
      surfaceId: true,
      canonicalObjectId: true,
    },
  });

  const matchingNodes = nodes.filter((node) => (
    typeof node.canonicalObjectId === 'string' && canonicalObjectIds.has(node.canonicalObjectId)
  ));

  return {
    id: workspaceId,
    targetDir: context.targetDir,
    dataDir: context.dataDir,
    objectCount: objects.length,
    canvasCount: uniqueStrings(matchingNodes.map((node) => node.canvasId)).length,
    surfaceCount: uniqueStrings(matchingNodes.map((node) => `${node.canvasId}:${node.surfaceId}`)).length,
  };
}

export async function listWorkspaces(context: HeadlessServiceContext): Promise<WorkspaceSummary[]> {
  const workspaceIds = await listWorkspaceIds(context);
  return Promise.all(workspaceIds.map((workspaceId) => summarizeWorkspace(context, workspaceId)));
}

export async function getWorkspace(
  context: HeadlessServiceContext,
  workspaceId: string,
): Promise<WorkspaceSummary> {
  const workspaceIds = await listWorkspaceIds(context);
  if (!workspaceIds.includes(workspaceId)) {
    throw cliError('WORKSPACE_NOT_FOUND', `Workspace ${workspaceId} was not found.`, {
      details: { workspaceId },
    });
  }

  return summarizeWorkspace(context, workspaceId);
}

export async function getCanvas(
  context: HeadlessServiceContext,
  canvasId: string,
): Promise<CanvasSummary> {
  const [nodes, bindings, revisions] = await Promise.all([
    context.db.query.canvasNodes.findMany({
      where: eq(canvasNodes.canvasId, canvasId),
      columns: {
        canvasId: true,
        surfaceId: true,
      },
    }),
    context.db.query.canvasBindings.findMany({
      where: eq(canvasBindings.canvasId, canvasId),
      columns: {
        id: true,
      },
    }),
    context.db.query.canvasRevisions.findMany({
      where: eq(canvasRevisions.canvasId, canvasId),
      columns: {
        revisionNo: true,
      },
      orderBy: [desc(canvasRevisions.revisionNo)],
    }),
  ]);

  if (nodes.length === 0 && bindings.length === 0 && revisions.length === 0) {
    throw cliError('DOCUMENT_NOT_FOUND', `Canvas ${canvasId} was not found.`, {
      details: { canvasId },
    });
  }

  return {
    id: canvasId,
    surfaceIds: uniqueStrings(nodes.map((node) => node.surfaceId)),
    nodeCount: nodes.length,
    bindingCount: bindings.length,
    latestRevision: revisions[0]?.revisionNo ?? null,
  };
}

export async function getWorkspaceCanvas(
  context: HeadlessServiceContext,
  canvasId: string,
  workspaceId = context.defaultWorkspaceId,
): Promise<WorkspaceCanvasShellSummary> {
  const [nodes, bindings, revisions] = await Promise.all([
    context.db.query.canvasNodes.findMany({
      where: eq(canvasNodes.canvasId, canvasId),
      columns: {
        canvasId: true,
        surfaceId: true,
      },
    }),
    context.db.query.canvasBindings.findMany({
      where: eq(canvasBindings.canvasId, canvasId),
      columns: {
        id: true,
      },
    }),
    context.db.query.canvasRevisions.findMany({
      where: eq(canvasRevisions.canvasId, canvasId),
      columns: {
        revisionNo: true,
        mutationBatch: true,
        createdAt: true,
      },
      orderBy: [desc(canvasRevisions.revisionNo)],
    }),
  ]);

  if (nodes.length === 0 && bindings.length === 0 && revisions.length === 0) {
    throw cliError('DOCUMENT_NOT_FOUND', `Canvas ${canvasId} was not found.`, {
      details: { canvasId },
    });
  }

  const latestMetadata = revisions
    .map((revision) => readCanvasShellMetadata(revision.mutationBatch))
    .find((metadata) => metadata !== null) ?? null;

  return {
    canvasId,
    workspaceId: latestMetadata?.workspaceId ?? workspaceId,
    filePath: latestMetadata?.filePath ?? null,
    surfaceIds: uniqueStrings(nodes.map((node) => node.surfaceId)),
    nodeCount: nodes.length,
    bindingCount: bindings.length,
    latestRevision: revisions[0]?.revisionNo ?? null,
    createdAt: revisions.length > 0 ? revisions[revisions.length - 1]?.createdAt ?? null : null,
    updatedAt: revisions[0]?.createdAt ?? null,
  };
}

export async function listWorkspaceCanvases(
  context: HeadlessServiceContext,
  workspaceId = context.defaultWorkspaceId,
): Promise<WorkspaceCanvasShellSummary[]> {
  const canvasIds = await listCanvasIds(context);
  const canvases = await Promise.all(
    canvasIds.map((canvasId) => getWorkspaceCanvas(context, canvasId, workspaceId)),
  );

  return canvases
    .filter((canvas) => canvas.workspaceId === workspaceId)
    .sort((left, right) => {
      const leftTime = left.updatedAt?.getTime() ?? 0;
      const rightTime = right.updatedAt?.getTime() ?? 0;
      if (rightTime !== leftTime) {
        return rightTime - leftTime;
      }
      return left.canvasId.localeCompare(right.canvasId);
    });
}

export async function getCurrentCanvasRevision(
  context: HeadlessServiceContext,
  canvasId: string,
): Promise<number> {
  const latest = await context.db.query.canvasRevisions.findFirst({
    where: eq(canvasRevisions.canvasId, canvasId),
    columns: {
      revisionNo: true,
    },
    orderBy: [desc(canvasRevisions.revisionNo)],
  });

  return latest?.revisionNo ?? 0;
}
