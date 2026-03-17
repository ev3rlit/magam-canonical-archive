import { CanonicalPersistenceRepository } from '../canonical-persistence/repository';
import type {
  CanonicalMutationRepository,
  CanonicalQueryRepository,
  RevisionState,
} from './contracts';

function toRevisionState(
  value: Awaited<ReturnType<CanonicalPersistenceRepository['getRevisionState']>>,
): RevisionState | null {
  if (!value) {
    return null;
  }

  return {
    documentId: value.documentId,
    headRevision: value.headRevision,
    revisionNo: value.revisionNo,
  };
}

export function createCanonicalQueryRepositoryAdapter(
  repository: CanonicalPersistenceRepository,
): CanonicalQueryRepository {
  return {
    queryCanonicalObjects: (input) => repository.queryCanonicalObjects(input),
    listObjectRelations: (input) => repository.listObjectRelations(input),
    listCanvasNodes: (input) => repository.listCanvasNodes(input),
    listCanvasBindings: (input) => repository.listCanvasBindings(input),
    getRevisionState: async (documentId) => toRevisionState(await repository.getRevisionState(documentId)),
  };
}

export function createCanonicalMutationRepositoryAdapter(
  repository: CanonicalPersistenceRepository,
): CanonicalMutationRepository {
  return {
    getRevisionState: async (documentId) => toRevisionState(await repository.getRevisionState(documentId)),
    ensureBaseRevision: (documentId, baseRevision) => repository.ensureBaseRevision(documentId, baseRevision),
    getCanonicalObject: (workspaceId, id) => repository.getCanonicalObject(workspaceId, id),
    createCanonicalObject: (input) => repository.createCanonicalObject(input),
    upsertCanonicalObject: (record) => repository.upsertCanonicalObject(record),
    createObjectRelation: (record) => repository.createObjectRelation(record),
    removeObjectRelation: (input) => repository.removeObjectRelation(input),
    createCanvasNode: (record) => repository.createCanvasNode(record),
    getCanvasNode: (input) => repository.getCanvasNode(input),
    updateCanvasNode: (record) => repository.updateCanvasNode(record),
    removeCanvasNode: (input) => repository.removeCanvasNode(input),
    appendDocumentRevision: (record) => repository.appendDocumentRevision(record),
  };
}
