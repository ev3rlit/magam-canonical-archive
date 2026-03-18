import { and, desc, eq } from 'drizzle-orm';
import type { HeadlessServiceContext } from '../canonical-cli';
import { cliError } from '../canonical-cli';
import { canvasBindings, canvasNodes, documentRevisions } from '../canonical-persistence/schema';

export interface WorkspaceSummary {
  id: string;
  targetDir: string;
  dataDir: string | null;
  objectCount: number;
  documentCount: number;
  surfaceCount: number;
}

export interface DocumentSummary {
  id: string;
  surfaceIds: string[];
  nodeCount: number;
  bindingCount: number;
  latestRevision: number | null;
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

export async function listDocumentIds(context: HeadlessServiceContext): Promise<string[]> {
  const [nodes, bindings, revisions] = await Promise.all([
    context.db.query.canvasNodes.findMany({
      columns: { documentId: true },
    }),
    context.db.query.canvasBindings.findMany({
      columns: { documentId: true },
    }),
    context.db.query.documentRevisions.findMany({
      columns: { documentId: true },
    }),
  ]);

  return uniqueStrings([
    ...nodes.map((row) => row.documentId),
    ...bindings.map((row) => row.documentId),
    ...revisions.map((row) => row.documentId),
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
      documentId: true,
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
    documentCount: uniqueStrings(matchingNodes.map((node) => node.documentId)).length,
    surfaceCount: uniqueStrings(matchingNodes.map((node) => `${node.documentId}:${node.surfaceId}`)).length,
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

export async function getDocument(
  context: HeadlessServiceContext,
  documentId: string,
): Promise<DocumentSummary> {
  const [nodes, bindings, revisions] = await Promise.all([
    context.db.query.canvasNodes.findMany({
      where: eq(canvasNodes.documentId, documentId),
      columns: {
        documentId: true,
        surfaceId: true,
      },
    }),
    context.db.query.canvasBindings.findMany({
      where: eq(canvasBindings.documentId, documentId),
      columns: {
        id: true,
      },
    }),
    context.db.query.documentRevisions.findMany({
      where: eq(documentRevisions.documentId, documentId),
      columns: {
        revisionNo: true,
      },
      orderBy: [desc(documentRevisions.revisionNo)],
    }),
  ]);

  if (nodes.length === 0 && bindings.length === 0 && revisions.length === 0) {
    throw cliError('DOCUMENT_NOT_FOUND', `Document ${documentId} was not found.`, {
      details: { documentId },
    });
  }

  return {
    id: documentId,
    surfaceIds: uniqueStrings(nodes.map((node) => node.surfaceId)),
    nodeCount: nodes.length,
    bindingCount: bindings.length,
    latestRevision: revisions[0]?.revisionNo ?? null,
  };
}

export async function getCurrentDocumentRevision(
  context: HeadlessServiceContext,
  documentId: string,
): Promise<number> {
  const latest = await context.db.query.documentRevisions.findFirst({
    where: eq(documentRevisions.documentId, documentId),
    columns: {
      revisionNo: true,
    },
    orderBy: [desc(documentRevisions.revisionNo)],
  });

  return latest?.revisionNo ?? 0;
}
