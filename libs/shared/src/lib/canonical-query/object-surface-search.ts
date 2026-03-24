import { and, desc, eq } from 'drizzle-orm';
import type { CanonicalObjectRecord, ContentBlock } from '../canonical-object-contract';
import type { HeadlessServiceContext } from '../canonical-cli';
import { cliError } from '../canonical-cli';
import { canvasNodes, canvasRevisions } from '../canonical-persistence/schema';

export interface QueryPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ObjectQueryOptions {
  workspaceId: string;
  objectId?: string;
  semanticRole?: string;
  contentKind?: string;
  hasCapability?: string;
  alias?: string;
  include?: string[];
  limit?: number;
  cursor?: string;
}

export interface BoundsQuery {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SurfaceQueryOptions {
  canvasId: string;
  surfaceId: string;
  workspaceId?: string;
  bounds?: BoundsQuery;
  include?: string[];
  limit?: number;
  cursor?: string;
}

export interface SearchQueryOptions {
  workspaceId?: string;
  text: string;
  semanticRole?: string;
  include?: string[];
  limit?: number;
  cursor?: string;
}

interface CanvasNodeSummary {
  id: string;
  canvasId: string;
  surfaceId: string;
  nodeKind: string;
  nodeType: string | null;
  parentNodeId: string | null;
  canonicalObjectId: string | null;
  pluginInstanceId: string | null;
  props: Record<string, unknown> | null;
  layout: Record<string, unknown>;
  style: Record<string, unknown> | null;
  persistedState: Record<string, unknown> | null;
  zIndex: number;
}

interface DocumentSearchResult {
  id: string;
  surfaceIds: string[];
  latestRevision: number | null;
  matchedObjectIds: string[];
  searchText: string;
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && value.length > 0))];
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function parseCursor(cursor: string | undefined): number {
  if (!cursor) {
    return 0;
  }

  const parsed = Number.parseInt(cursor, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function paginateItems<T>(
  items: T[],
  limit: number | undefined,
  cursor: string | undefined,
): QueryPage<T> {
  const offset = parseCursor(cursor);
  const pageSize = limit && limit > 0 ? limit : items.length;
  const paged = items.slice(offset, offset + pageSize);
  const nextCursor = offset + pageSize < items.length ? String(offset + pageSize) : null;

  return {
    items: paged,
    nextCursor,
  };
}

function cloneValue<T>(value: T): T {
  if (value === undefined) {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as T;
}

function getPathValue(source: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = source;

  for (const part of parts) {
    if (!current || typeof current !== 'object' || !(part in current)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function assignPathValue(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current = target;

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (index === parts.length - 1) {
      current[part] = cloneValue(value);
      return;
    }

    const next = current[part];
    if (!next || typeof next !== 'object' || Array.isArray(next)) {
      current[part] = {};
    }

    current = current[part] as Record<string, unknown>;
  }
}

function projectRecord(
  source: Record<string, unknown>,
  include: string[] | undefined,
  requiredPaths: string[],
): Record<string, unknown> {
  if (!include || include.length === 0) {
    return cloneValue(source);
  }

  const projected: Record<string, unknown> = {};
  for (const path of [...requiredPaths, ...include]) {
    const value = getPathValue(source, path);
    if (value !== undefined) {
      assignPathValue(projected, path, value);
    }
  }

  return projected;
}

function toObjectSummary(record: CanonicalObjectRecord): Record<string, unknown> {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    semanticRole: record.semanticRole,
    primaryContentKind: record.primaryContentKind ?? null,
    alias: record.publicAlias ?? null,
    sourceMeta: record.sourceMeta,
    capabilities: record.capabilities,
    capabilitySources: record.capabilitySources ?? {},
    canonicalText: record.canonicalText,
    contentBlocks: record.contentBlocks ?? record.content_blocks ?? null,
    extensions: record.extensions ?? {},
    deletedAt: record.deletedAt ?? null,
  };
}

function toCanvasNodeSummary(row: typeof canvasNodes.$inferSelect): CanvasNodeSummary {
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
  };
}

function getLayoutNumber(layout: Record<string, unknown>, key: string): number | null {
  const value = layout[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function intersectsBounds(layout: Record<string, unknown>, bounds: BoundsQuery): boolean {
  const x = getLayoutNumber(layout, 'x');
  const y = getLayoutNumber(layout, 'y');
  if (x === null || y === null) {
    return false;
  }

  const width = getLayoutNumber(layout, 'width') ?? 0;
  const height = getLayoutNumber(layout, 'height') ?? 0;

  const right = x + width;
  const bottom = y + height;
  const boundsRight = bounds.x + bounds.width;
  const boundsBottom = bounds.y + bounds.height;

  return x <= boundsRight && right >= bounds.x && y <= boundsBottom && bottom >= bounds.y;
}

function toSingleBlockContentPatch(kind: 'text' | 'markdown', source: unknown): ContentBlock[] {
  if (typeof source === 'string') {
    return kind === 'text'
      ? [{ id: 'body-1', blockType: 'text', text: source }]
      : [{ id: 'body-1', blockType: 'markdown', source }];
  }

  return [];
}

async function resolveCanonicalObjectMap(
  context: HeadlessServiceContext,
  workspaceId: string | undefined,
  objectIds: string[],
): Promise<Map<string, Record<string, unknown>>> {
  if (!workspaceId || objectIds.length === 0) {
    return new Map();
  }

  const records = await context.repository.listCanonicalObjects(workspaceId);
  const wanted = new Set(objectIds);
  return new Map(
    records
      .filter((record) => wanted.has(record.id))
      .map((record) => [record.id, toObjectSummary(record)]),
  );
}

export async function getObject(
  context: HeadlessServiceContext,
  options: Pick<ObjectQueryOptions, 'workspaceId' | 'objectId' | 'include'>,
): Promise<Record<string, unknown>> {
  if (!options.objectId) {
    throw cliError('INVALID_ARGUMENT', '--object is required for object get.', {
      details: { flag: 'object' },
    });
  }

  const result = await context.repository.getCanonicalObject(options.workspaceId, options.objectId);
  if (!result.ok) {
    throw cliError('OBJECT_NOT_FOUND', `Object ${options.objectId} was not found in workspace ${options.workspaceId}.`, {
      details: { workspaceId: options.workspaceId, objectId: options.objectId },
    });
  }

  return projectRecord(toObjectSummary(result.value), options.include, ['id']);
}

export async function queryObjects(
  context: HeadlessServiceContext,
  options: ObjectQueryOptions,
): Promise<QueryPage<Record<string, unknown>>> {
  const records = await context.repository.listCanonicalObjects(options.workspaceId);
  const filtered = records
    .filter((record) => !record.deletedAt)
    .filter((record) => (options.objectId ? record.id === options.objectId : true))
    .filter((record) => (options.semanticRole ? record.semanticRole === options.semanticRole : true))
    .filter((record) => (options.contentKind ? (record.primaryContentKind ?? null) === options.contentKind : true))
    .filter((record) => (options.alias ? (record.publicAlias ?? null) === options.alias : true))
    .filter((record) => (
      options.hasCapability
        ? record.capabilities[options.hasCapability as keyof typeof record.capabilities] !== undefined
        : true
    ))
    .map((record) => projectRecord(toObjectSummary(record), options.include, ['id']));

  return paginateItems(filtered, options.limit, options.cursor);
}

export async function searchObjects(
  context: HeadlessServiceContext,
  options: SearchQueryOptions,
): Promise<QueryPage<Record<string, unknown>>> {
  const workspaceId = options.workspaceId ?? context.defaultWorkspaceId;
  const records = await context.repository.listCanonicalObjects(workspaceId);
  const query = normalizeText(options.text);
  const filtered = records
    .filter((record) => !record.deletedAt)
    .filter((record) => (options.semanticRole ? record.semanticRole === options.semanticRole : true))
    .filter((record) => normalizeText(record.canonicalText).includes(query))
    .map((record) => projectRecord(toObjectSummary(record), options.include, ['id', 'canonicalText']));

  return paginateItems(filtered, options.limit, options.cursor);
}

export async function getSurface(
  context: HeadlessServiceContext,
  canvasId: string,
  surfaceId: string,
): Promise<Record<string, unknown>> {
  const rows = await context.db.query.canvasNodes.findMany({
    where: and(
      eq(canvasNodes.canvasId, canvasId),
      eq(canvasNodes.surfaceId, surfaceId),
    ),
    columns: {
      layout: true,
      zIndex: true,
    },
    orderBy: [desc(canvasNodes.zIndex)],
  });

  if (rows.length === 0) {
    throw cliError('SURFACE_NOT_FOUND', `Surface ${surfaceId} was not found in document ${canvasId}.`, {
      details: { canvasId, surfaceId },
    });
  }

  const xs = rows
    .map((row) => typeof row.layout['x'] === 'number' ? row.layout['x'] as number : null)
    .filter((value): value is number => value !== null);
  const ys = rows
    .map((row) => typeof row.layout['y'] === 'number' ? row.layout['y'] as number : null)
    .filter((value): value is number => value !== null);

  return {
    id: surfaceId,
    canvasId,
    nodeCount: rows.length,
    bounds: xs.length > 0 && ys.length > 0
      ? {
          minX: Math.min(...xs),
          minY: Math.min(...ys),
          maxX: Math.max(...xs),
          maxY: Math.max(...ys),
        }
      : null,
  };
}

export async function querySurfaceNodes(
  context: HeadlessServiceContext,
  options: SurfaceQueryOptions,
): Promise<QueryPage<Record<string, unknown>>> {
  const rows = await context.db.query.canvasNodes.findMany({
    where: and(
      eq(canvasNodes.canvasId, options.canvasId),
      eq(canvasNodes.surfaceId, options.surfaceId),
    ),
    orderBy: [desc(canvasNodes.zIndex)],
  });

  if (rows.length === 0) {
    throw cliError('SURFACE_NOT_FOUND', `Surface ${options.surfaceId} was not found in document ${options.canvasId}.`, {
      details: { canvasId: options.canvasId, surfaceId: options.surfaceId },
    });
  }

  const summaries = rows.map(toCanvasNodeSummary);
  const bounded = options.bounds
    ? summaries.filter((row) => intersectsBounds(row.layout, options.bounds!))
    : summaries;
  const canonicalObjectIds = uniqueStrings(bounded.map((row) => row.canonicalObjectId));
  const canonicalObjects = await resolveCanonicalObjectMap(context, options.workspaceId, canonicalObjectIds);

  const projected = bounded.map((row) => {
    const summary: Record<string, unknown> = { ...row };
    if (row.canonicalObjectId && canonicalObjects.has(row.canonicalObjectId)) {
      summary['canonicalObject'] = canonicalObjects.get(row.canonicalObjectId)!;
    }

    return projectRecord(summary, options.include, ['id', 'canvasId', 'surfaceId']);
  });

  return paginateItems(projected, options.limit, options.cursor);
}

export async function searchCanvases(
  context: HeadlessServiceContext,
  options: SearchQueryOptions,
): Promise<QueryPage<DocumentSearchResult>> {
  const canvasIds = uniqueStrings([
    ...(await context.db.query.canvasNodes.findMany({
      columns: { canvasId: true },
    })).map((row) => row.canvasId),
    ...(await context.db.query.canvasRevisions.findMany({
      columns: { canvasId: true },
    })).map((row) => row.canvasId),
  ]);
  const query = normalizeText(options.text);

  const workspaceId = options.workspaceId;
  const workspaceObjects = workspaceId
    ? await context.repository.listCanonicalObjects(workspaceId)
    : [];
  const objectMap = new Map(workspaceObjects.map((record) => [record.id, record]));

  const results: DocumentSearchResult[] = [];
  for (const canvasId of canvasIds) {
    const [nodes, latestRevision] = await Promise.all([
      context.db.query.canvasNodes.findMany({
        where: eq(canvasNodes.canvasId, canvasId),
        columns: {
          surfaceId: true,
          canonicalObjectId: true,
        },
      }),
      context.db.query.canvasRevisions.findFirst({
        where: eq(canvasRevisions.canvasId, canvasId),
        columns: {
          revisionNo: true,
        },
        orderBy: [desc(canvasRevisions.revisionNo)],
      }),
    ]);

    const matchedObjects = nodes
      .map((node) => (
        node.canonicalObjectId && objectMap.has(node.canonicalObjectId)
          ? objectMap.get(node.canonicalObjectId)!
          : null
      ))
      .filter((record): record is CanonicalObjectRecord => record !== null)
      .filter((record) => normalizeText(record.canonicalText).includes(query));

    const searchText = [
      canvasId,
      ...matchedObjects.map((record) => record.canonicalText),
    ].join('\n').trim();

    if (!normalizeText(searchText).includes(query)) {
      continue;
    }

    results.push({
      id: canvasId,
      surfaceIds: uniqueStrings(nodes.map((node) => node.surfaceId)),
      latestRevision: latestRevision?.revisionNo ?? null,
      matchedObjectIds: uniqueStrings(matchedObjects.map((record) => record.id)),
      searchText,
    });
  }

  return paginateItems(results, options.limit, options.cursor);
}
