import type {
  CanonicalQueryRepository,
  CanonicalQueryRequest,
  CanonicalQueryResultEnvelope,
  QueryIncludeKey,
} from './contracts';
import { validateCanonicalQueryRequest } from './validators';

function requiresDocumentScope(include: readonly QueryIncludeKey[]): boolean {
  return include.includes('canvasNodes')
    || include.includes('bindings')
    || include.includes('documentRevision');
}

export class CanonicalQueryService {
  constructor(private readonly repository: CanonicalQueryRepository) {}

  async execute(request: CanonicalQueryRequest): Promise<CanonicalQueryResultEnvelope> {
    const validation = validateCanonicalQueryRequest(request);
    if (!validation.ok) {
      return {
        ok: false,
        ...validation.error,
      };
    }

    const validated = validation.value;
    if (requiresDocumentScope(validated.include) && !validated.documentId) {
      return {
        ok: false,
        code: 'QUERY_SCOPE_NOT_FOUND',
        message: 'documentId is required for canvas/binding/revision query includes.',
        path: 'documentId',
      };
    }

    const data: NonNullable<CanonicalQueryResultEnvelope & { ok: true }>['data'] = {};
    let pageCursor: string | undefined;

    const objectResult = await this.repository.queryCanonicalObjects({
      workspaceId: validated.workspaceId,
      filters: validated.filters,
      limit: validated.limit,
      cursor: validated.cursor,
      bounds: validated.bounds,
    });

    if (validated.include.includes('objects')) {
      data.objects = objectResult.objects;
    }

    if (validated.include.includes('relations')) {
      const relationLoader = this.repository.listObjectRelations;
      if (!relationLoader) {
        return {
          ok: false,
          code: 'INTERNAL_QUERY_ERROR',
          message: 'Repository does not expose relation query primitive.',
          path: 'include.relations',
        };
      }

      data.relations = await relationLoader({
        workspaceId: validated.workspaceId,
        objectIds: objectResult.objects.map((record) => record.id),
      });
    }

    if (validated.include.includes('canvasNodes')) {
      const nodeLoader = this.repository.listCanvasNodes;
      if (!nodeLoader) {
        return {
          ok: false,
          code: 'INTERNAL_QUERY_ERROR',
          message: 'Repository does not expose canvas node query primitive.',
          path: 'include.canvasNodes',
        };
      }

      data.canvasNodes = await nodeLoader({
        documentId: validated.documentId!,
        surfaceId: validated.surfaceId,
        bounds: validated.bounds,
      });
    }

    if (validated.include.includes('bindings')) {
      const bindingLoader = this.repository.listCanvasBindings;
      if (!bindingLoader) {
        return {
          ok: false,
          code: 'INTERNAL_QUERY_ERROR',
          message: 'Repository does not expose canvas binding query primitive.',
          path: 'include.bindings',
        };
      }

      const nodeIds = data.canvasNodes?.map((node) => node.id);
      data.bindings = await bindingLoader({
        documentId: validated.documentId!,
        nodeIds,
      });
    }

    if (validated.include.includes('documentRevision')) {
      const revisionLoader = this.repository.getRevisionState;
      if (!revisionLoader) {
        return {
          ok: false,
          code: 'INTERNAL_QUERY_ERROR',
          message: 'Repository does not expose revision query primitive.',
          path: 'include.documentRevision',
        };
      }

      const revision = await revisionLoader(validated.documentId!);
      if (!revision) {
        return {
          ok: false,
          code: 'QUERY_SCOPE_NOT_FOUND',
          message: `Revision scope was not found for document ${validated.documentId!}.`,
          path: 'documentId',
        };
      }

      data.documentRevision = {
        documentId: revision.documentId,
        revision: revision.headRevision,
        revisionNo: revision.revisionNo,
      };
    }

    pageCursor = objectResult.cursor;

    return {
      ok: true,
      data,
      ...(pageCursor ? { page: { cursor: pageCursor } } : {}),
    };
  }
}
