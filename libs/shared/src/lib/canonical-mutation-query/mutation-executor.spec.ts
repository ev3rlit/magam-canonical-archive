import { describe, expect, it } from 'vitest';
import { CanonicalMutationExecutor } from './mutation-executor';
import type {
  CanonicalMutationEnvelope,
  CanonicalMutationRepository,
  RevisionState,
} from './contracts';
import type {
  CanvasNodeRecord,
  CreateCanonicalObjectInput,
  DocumentRevisionRecord,
  ObjectRelationRecord,
  PersistenceResult,
} from '../canonical-persistence/records';
import { errResult, okResult } from '../canonical-persistence/records';
import type { CanonicalObjectRecord } from '../canonical-object-contract';
import { validateCanonicalObjectRecord } from '../canonical-persistence/validators';

class InMemoryMutationRepository implements CanonicalMutationRepository {
  private objects = new Map<string, CanonicalObjectRecord>();
  private relations = new Map<string, ObjectRelationRecord>();
  private canvasNodes = new Map<string, CanvasNodeRecord>();
  private revisionState = new Map<string, RevisionState>();
  private revisions: DocumentRevisionRecord[] = [];

  seedObject(record: CanonicalObjectRecord): void {
    this.objects.set(`${record.workspaceId}:${record.id}`, record);
  }

  seedRevision(documentId: string, headRevision: string, revisionNo: number): void {
    this.revisionState.set(documentId, { documentId, headRevision, revisionNo });
  }

  async ensureBaseRevision(documentId: string, baseRevision: string | undefined | null) {
    if (!baseRevision) {
      return errResult('VERSION_BASE_REQUIRED', 'baseRevision is required.', { path: 'baseRevision' });
    }

    const current = this.revisionState.get(documentId) ?? {
      documentId,
      headRevision: buildRevisionToken(documentId, 0, 'initial'),
      revisionNo: 0,
    };

    if (current.headRevision !== baseRevision) {
      return errResult('VERSION_CONFLICT', 'baseRevision does not match current head revision.', {
        path: 'baseRevision',
        details: {
          expected: baseRevision,
          actual: current.headRevision,
        },
      });
    }

    const revisionId = baseRevision.split(':')[3] ?? 'initial';
    return okResult({
      documentId,
      revisionNo: current.revisionNo,
      revisionId,
      headRevision: current.headRevision,
    });
  }

  getStoredObject(workspaceId: string, objectId: string): CanonicalObjectRecord | undefined {
    return this.objects.get(`${workspaceId}:${objectId}`);
  }

  getStoredRevision(documentId: string): RevisionState | undefined {
    return this.revisionState.get(documentId);
  }

  async getRevisionState(documentId: string): Promise<RevisionState | null> {
    return this.revisionState.get(documentId) ?? null;
  }

  async getCanonicalObject(workspaceId: string, id: string): Promise<PersistenceResult<CanonicalObjectRecord>> {
    const record = this.objects.get(`${workspaceId}:${id}`);
    if (!record) {
      return errResult('CANONICAL_RECORD_NOT_FOUND', `Object ${id} not found`, { path: 'id' });
    }
    return okResult(record);
  }

  async createCanonicalObject(input: CreateCanonicalObjectInput): Promise<PersistenceResult<CanonicalObjectRecord>> {
    const validated = validateCanonicalObjectRecord(input.record);
    if (!validated.ok) {
      return validated;
    }
    const key = `${input.record.workspaceId}:${input.record.id}`;
    if (this.objects.has(key)) {
      return errResult('CANONICAL_RECORD_NOT_FOUND', `Object ${input.record.id} already exists`, { path: 'id' });
    }
    this.objects.set(key, validated.value);
    return okResult(validated.value);
  }

  async upsertCanonicalObject(record: CanonicalObjectRecord): Promise<PersistenceResult<CanonicalObjectRecord>> {
    const validated = validateCanonicalObjectRecord(record);
    if (!validated.ok) {
      return validated;
    }
    this.objects.set(`${record.workspaceId}:${record.id}`, validated.value);
    return okResult(validated.value);
  }

  async createObjectRelation(record: ObjectRelationRecord): Promise<PersistenceResult<ObjectRelationRecord>> {
    this.relations.set(record.id, record);
    return okResult(record);
  }

  async removeObjectRelation(input: { workspaceId: string; relationId: string }): Promise<PersistenceResult<{ id: string }>> {
    void input.workspaceId;
    this.relations.delete(input.relationId);
    return okResult({ id: input.relationId });
  }

  async createCanvasNode(record: CanvasNodeRecord): Promise<PersistenceResult<CanvasNodeRecord>> {
    this.canvasNodes.set(`${record.documentId}:${record.id}`, record);
    return okResult(record);
  }

  async getCanvasNode(input: {
    documentId: string;
    nodeId: string;
  }): Promise<PersistenceResult<CanvasNodeRecord>> {
    const node = this.canvasNodes.get(`${input.documentId}:${input.nodeId}`);
    if (!node) {
      return errResult('CANONICAL_RECORD_NOT_FOUND', `Node ${input.nodeId} was not found.`);
    }
    return okResult(node);
  }

  async updateCanvasNode(record: CanvasNodeRecord): Promise<PersistenceResult<CanvasNodeRecord>> {
    this.canvasNodes.set(`${record.documentId}:${record.id}`, record);
    return okResult(record);
  }

  async removeCanvasNode(input: {
    documentId: string;
    nodeId: string;
  }): Promise<PersistenceResult<{ id: string }>> {
    this.canvasNodes.delete(`${input.documentId}:${input.nodeId}`);
    return okResult({ id: input.nodeId });
  }

  async appendDocumentRevision(record: DocumentRevisionRecord): Promise<PersistenceResult<DocumentRevisionRecord>> {
    this.revisions.push(record);
    this.revisionState.set(record.documentId, {
      documentId: record.documentId,
      headRevision: buildRevisionToken(record.documentId, record.revisionNo, record.id),
      revisionNo: record.revisionNo,
    });
    return okResult(record);
  }
}

function buildRevisionToken(documentId: string, revisionNo: number, revisionId: string): string {
  return `rev:${documentId}:${revisionNo}:${revisionId}`;
}

function buildNoteRecord(id: string): CanonicalObjectRecord {
  return {
    id,
    workspaceId: 'ws-1',
    semanticRole: 'topic',
    sourceMeta: { sourceId: id, kind: 'canvas' },
    capabilities: {},
    contentBlocks: [{ id: 'b1', blockType: 'text', text: 'hello' }],
    canonicalText: 'hello',
    primaryContentKind: 'text',
    publicAlias: 'Node',
  };
}

function buildEnvelope(operations: CanonicalMutationEnvelope['operations']): CanonicalMutationEnvelope {
  return {
    workspaceId: 'ws-1',
    documentId: 'doc-1',
    baseRevision: buildRevisionToken('doc-1', 1, 'rev-1'),
    actor: { kind: 'user', id: 'user-1' },
    operations,
    requestId: 'req-1',
  };
}

describe('CanonicalMutationExecutor', () => {
  it('produces deterministic results for the same base revision and operations', async () => {
    const repoA = new InMemoryMutationRepository();
    repoA.seedObject(buildNoteRecord('note-1'));
    repoA.seedRevision('doc-1', buildRevisionToken('doc-1', 1, 'rev-1'), 1);

    const repoB = new InMemoryMutationRepository();
    repoB.seedObject(buildNoteRecord('note-1'));
    repoB.seedRevision('doc-1', buildRevisionToken('doc-1', 1, 'rev-1'), 1);

    const envelope = buildEnvelope([
      {
        op: 'object.body.block.insert',
        objectId: 'note-1',
        at: 1,
        block: { id: 'b2', blockType: 'markdown', source: '# title' },
      },
      {
        op: 'object.body.block.reorder',
        objectId: 'note-1',
        order: ['b2', 'b1'],
      },
    ]);

    const resultA = await new CanonicalMutationExecutor(repoA).execute(envelope);
    const resultB = await new CanonicalMutationExecutor(repoB).execute(envelope);

    expect(resultA).toEqual(resultB);
    expect(resultA.ok).toBe(true);
  });

  it('returns VERSION_BASE_REQUIRED for missing base revision', async () => {
    const repo = new InMemoryMutationRepository();
    repo.seedObject(buildNoteRecord('note-1'));
    repo.seedRevision('doc-1', buildRevisionToken('doc-1', 1, 'rev-1'), 1);

    const result = await new CanonicalMutationExecutor(repo).execute({
      ...buildEnvelope([
        {
          op: 'object.update-core',
          objectId: 'note-1',
          patch: { semanticRole: 'topic' },
        },
      ]),
      baseRevision: '',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('VERSION_BASE_REQUIRED');
    }
  });

  it('returns VERSION_CONFLICT for stale base revision', async () => {
    const repo = new InMemoryMutationRepository();
    repo.seedObject(buildNoteRecord('note-1'));
    repo.seedRevision('doc-1', buildRevisionToken('doc-1', 3, 'rev-3'), 3);

    const result = await new CanonicalMutationExecutor(repo).execute(buildEnvelope([
      {
        op: 'object.update-core',
        objectId: 'note-1',
        patch: { semanticRole: 'topic' },
      },
    ]));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('VERSION_CONFLICT');
      expect(result.details?.actual).toBe(buildRevisionToken('doc-1', 3, 'rev-3'));
    }
  });

  it('enforces clone safety for editable note duplicate/import create operations', async () => {
    const repo = new InMemoryMutationRepository();
    repo.seedRevision('doc-1', buildRevisionToken('doc-1', 1, 'rev-1'), 1);

    const result = await new CanonicalMutationExecutor(repo).execute(buildEnvelope([
      {
        op: 'object.create',
        input: {
          operation: 'duplicate',
          record: buildNoteRecord('note-copy'),
        },
        sourceId: 'note-copy',
      },
    ]));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('EDITABLE_OBJECT_REQUIRES_CLONE');
    }
  });

  it('rejects unknown capability patch keys explicitly', async () => {
    const repo = new InMemoryMutationRepository();
    repo.seedObject(buildNoteRecord('note-1'));
    repo.seedRevision('doc-1', buildRevisionToken('doc-1', 1, 'rev-1'), 1);

    const result = await new CanonicalMutationExecutor(repo).execute(buildEnvelope([
      {
        op: 'object.patch-capability',
        objectId: 'note-1',
        patch: { unknown: true } as never,
      },
    ]));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('INVALID_CAPABILITY');
    }
  });

  it('applies block operations and recomputes canonical projections', async () => {
    const repo = new InMemoryMutationRepository();
    repo.seedObject({
      ...buildNoteRecord('note-1'),
      contentBlocks: [
        { id: 'b1', blockType: 'text', text: 'alpha' },
        { id: 'b2', blockType: 'markdown', source: 'beta' },
      ],
      canonicalText: 'alpha\nbeta',
      primaryContentKind: 'markdown',
    });
    repo.seedRevision('doc-1', buildRevisionToken('doc-1', 1, 'rev-1'), 1);

    const result = await new CanonicalMutationExecutor(repo).execute(buildEnvelope([
      {
        op: 'object.body.block.insert',
        objectId: 'note-1',
        at: 2,
        block: { id: 'b3', blockType: 'text', text: 'gamma' },
      },
      {
        op: 'object.body.block.update',
        objectId: 'note-1',
        blockId: 'b2',
        patch: { source: '# beta-2' },
      },
      {
        op: 'object.body.block.reorder',
        objectId: 'note-1',
        order: ['b2', 'b3', 'b1'],
      },
      {
        op: 'object.body.block.remove',
        objectId: 'note-1',
        blockId: 'b3',
      },
    ]));

    expect(result.ok).toBe(true);
    const stored = repo.getStoredObject('ws-1', 'note-1');
    expect(stored?.contentBlocks?.map((block) => block.id)).toEqual(['b2', 'b1']);
    expect(stored?.canonicalText).toBe('# beta-2\nalpha');
    expect(stored?.primaryContentKind).toBe('markdown');
  });

  it('routes relation and canvas operations through repository primitives', async () => {
    const repo = new InMemoryMutationRepository();
    repo.seedObject(buildNoteRecord('note-1'));
    repo.seedObject({
      ...buildNoteRecord('note-2'),
      id: 'note-2',
      sourceMeta: { sourceId: 'note-2', kind: 'canvas' },
    });
    repo.seedRevision('doc-1', buildRevisionToken('doc-1', 1, 'rev-1'), 1);

    const result = await new CanonicalMutationExecutor(repo).execute(buildEnvelope([
      {
        op: 'object.relation.upsert',
        relation: {
          id: 'rel-1',
          workspaceId: 'ws-1',
          fromObjectId: 'note-1',
          toObjectId: 'note-2',
          relationType: 'depends-on',
        },
      },
      {
        op: 'canvas-node.create',
        node: {
          id: 'node-1',
          documentId: 'doc-1',
          surfaceId: 'surface-1',
          nodeKind: 'native',
          canonicalObjectId: 'note-1',
          layout: { x: 0, y: 0 },
          zIndex: 1,
        },
      },
      {
        op: 'canvas-node.move',
        documentId: 'doc-1',
        nodeId: 'node-1',
        nextLayout: { x: 12, y: 33 },
      },
      {
        op: 'canvas-node.reparent',
        documentId: 'doc-1',
        nodeId: 'node-1',
        parentNodeId: 'parent-1',
      },
      {
        op: 'object.relation.remove',
        relationId: 'rel-1',
        workspaceId: 'ws-1',
      },
      {
        op: 'canvas-node.remove',
        documentId: 'doc-1',
        nodeId: 'node-1',
      },
    ]));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.changedSet.relationIds).toEqual(['rel-1']);
      expect(result.changedSet.canvasNodeIds).toEqual(['node-1']);
      expect(result.revision.before).toBe(buildRevisionToken('doc-1', 1, 'rev-1'));
      expect(result.revision.after).toBe(buildRevisionToken('doc-1', 2, 'rev-2'));
    }
  });

  it('returns a combined changedSet for mixed cross-story mutation batches', async () => {
    const repo = new InMemoryMutationRepository();
    repo.seedObject(buildNoteRecord('note-1'));
    repo.seedObject({
      ...buildNoteRecord('note-2'),
      id: 'note-2',
      sourceMeta: { sourceId: 'note-2', kind: 'canvas' },
    });
    repo.seedRevision('doc-1', buildRevisionToken('doc-1', 1, 'rev-1'), 1);

    const result = await new CanonicalMutationExecutor(repo).execute(buildEnvelope([
      {
        op: 'object.body.replace',
        objectId: 'note-1',
        blocks: [{ id: 'body-2', blockType: 'markdown', source: '# changed' }],
      },
      {
        op: 'object.relation.upsert',
        relation: {
          id: 'rel-2',
          workspaceId: 'ws-1',
          fromObjectId: 'note-1',
          toObjectId: 'note-2',
          relationType: 'depends-on',
        },
      },
      {
        op: 'canvas-node.create',
        node: {
          id: 'node-2',
          documentId: 'doc-1',
          surfaceId: 'surface-1',
          nodeKind: 'native',
          canonicalObjectId: 'note-1',
          layout: { x: 20, y: 10 },
          zIndex: 2,
        },
      },
    ]));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.changedSet.objectIds).toEqual(['note-1']);
      expect(result.changedSet.relationIds).toEqual(['rel-2']);
      expect(result.changedSet.canvasNodeIds).toEqual(['node-2']);
    }
  });
});
