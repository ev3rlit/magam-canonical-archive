import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  createCanonicalPgliteDb,
  resolveCanonicalMigrationsFolder,
  type CanvasNodeRecord,
} from '../canonical-persistence';
import { CanonicalPersistenceRepository } from '../canonical-persistence/repository';
import type { CanonicalObjectRecord } from '../canonical-object-contract';
import { buildCanonicalRenderResponse, renderCanonicalCanvas } from './render-canvas';

function buildObjectRecord(
  id: string,
  overrides?: Partial<CanonicalObjectRecord>,
): CanonicalObjectRecord {
  return {
    id,
    workspaceId: 'ws-1',
    semanticRole: 'topic',
    publicAlias: 'Node',
    sourceMeta: {
      sourceId: id,
      kind: 'canvas',
    },
    capabilities: {},
    contentBlocks: [],
    primaryContentKind: 'text',
    canonicalText: '',
    ...overrides,
  };
}

function buildNodeRecord(
  id: string,
  overrides?: Partial<CanvasNodeRecord>,
): CanvasNodeRecord {
  return {
    id,
    canvasId: 'doc-1',
    surfaceId: 'main',
    nodeKind: 'native',
    nodeType: 'shape',
    layout: { x: 0, y: 0, width: 160, height: 90 },
    zIndex: 1,
    ...overrides,
  };
}

describe('render-canvas', () => {
  let tempDir: string | null = null;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it('renders canonical markdown nodes and body blocks without compatibility metadata', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'magam-render-canvas-'));
    const handle = await createCanonicalPgliteDb(tempDir, {
      migrationsFolder: resolveCanonicalMigrationsFolder(process.cwd()),
      runMigrations: true,
    });
    const repository = new CanonicalPersistenceRepository(handle.db);

    const revision = await repository.appendCanvasRevision({
      id: 'docrev-1',
      canvasId: 'doc-1',
      revisionNo: 1,
      authorKind: 'system',
      authorId: 'test',
      mutationBatch: {
        op: 'canvas.create',
        canvasShell: {
          workspaceId: 'ws-1',
          title: 'Render Test',
        },
      },
    });
    expect(revision.ok).toBe(true);
    const createdObject = await repository.createCanonicalObject({
      record: buildObjectRecord('node-1', {
        semanticRole: 'topic',
        publicAlias: 'Markdown',
        sourceMeta: {
          sourceId: 'node-1',
          kind: 'canvas',
        },
        capabilities: {
          frame: {
            fill: '#ffffff',
            stroke: '#111111',
            strokeWidth: 2,
            shape: 'rectangle',
          },
        },
        contentBlocks: [
          { id: 'body-1', blockType: 'markdown', source: '# Hello' },
          {
            id: 'body-2',
            blockType: 'canvas.image',
            payload: {
              assetRef: { kind: 'external-url', value: 'https://example.com/hero.png' },
              alt: 'hero',
            },
          },
        ],
        primaryContentKind: 'markdown',
        canonicalText: '# Hello',
      }),
      operation: 'create',
    });
    expect(createdObject.ok).toBe(true);
    const createdNode = await repository.createCanvasNode(
      buildNodeRecord('node-1', {
        canvasId: 'doc-1',
        canonicalObjectId: 'node-1',
        nodeType: 'markdown',
        props: { locked: true, groupId: 'group-1' },
        style: { rotation: 12 },
        layout: { x: 48, y: 96, width: 220, height: 120 },
        zIndex: 3,
      }),
    );
    expect(createdNode.ok).toBe(true);
    await handle.close();

    const rendered = await renderCanonicalCanvas({
      targetDir: tempDir,
      canvasId: 'doc-1',
      workspaceId: 'ws-1',
    });

    expect(rendered.canvasId).toBe('doc-1');
    expect(rendered.title).toBe('Render Test');
    expect(rendered.sourceVersion).toMatch(/^sha256:/);
    expect(rendered.graph.children).toHaveLength(1);
    expect(rendered.graph.children[0]).toEqual({
      type: 'graph-node',
      props: expect.objectContaining({
        id: 'node-1',
        x: 48,
        y: 96,
        locked: true,
        groupId: 'group-1',
        rotation: 12,
        zIndex: 3,
        fill: '#ffffff',
        stroke: '#111111',
        strokeWidth: 2,
        type: 'rectangle',
        sourceMeta: {
          sourceId: 'node-1',
          kind: 'canvas',
          renderedId: 'node-1',
        },
      }),
      children: [
        {
          type: 'graph-markdown',
          props: { content: '# Hello' },
        },
        {
          type: 'graph-image',
          props: { src: 'https://example.com/hero.png', alt: 'hero' },
        },
      ],
    });
    expect(rendered.graph.children[0]?.props['sourceMeta']).not.toHaveProperty('filePath');
  });

  it('groups mindmap trees into graph-mindmap containers', () => {
    const response = buildCanonicalRenderResponse({
      canvasId: 'doc-1',
      title: 'Mindmap',
      latestRevision: 5,
      nodes: [
        buildNodeRecord('root-node', {
          nodeType: 'shape',
          canonicalObjectId: 'root-node',
          layout: { x: 120, y: 180, width: 160, height: 90 },
          zIndex: 1,
        }),
        buildNodeRecord('child-node', {
          nodeType: 'text',
          canonicalObjectId: 'child-node',
          parentNodeId: 'root-node',
          layout: { x: 320, y: 180, width: 120, height: 40 },
          zIndex: 2,
        }),
      ],
      objectsById: new Map([
        ['root-node', buildObjectRecord('root-node', {
          sourceMeta: {
            sourceId: 'root-node',
            kind: 'mindmap',
            scopeId: 'mindmap-1',
          },
          capabilities: {
            content: {
              kind: 'text',
              value: 'Root',
            },
          },
          canonicalText: 'Root',
        })],
        ['child-node', buildObjectRecord('child-node', {
          sourceMeta: {
            sourceId: 'child-node',
            kind: 'mindmap',
            scopeId: 'mindmap-1',
          },
          capabilities: {
            content: {
              kind: 'text',
              value: 'Child',
            },
          },
          canonicalText: 'Child',
        })],
      ]),
      pluginByNodeId: new Map(),
    });

    expect(response.graph.children).toEqual([
      {
        type: 'graph-mindmap',
        props: {
          id: 'mindmap-1',
          x: 120,
          y: 180,
        },
        children: [
          expect.objectContaining({
            type: 'graph-shape',
            props: expect.objectContaining({
              id: 'root-node',
              label: 'Root',
              sourceMeta: {
                sourceId: 'root-node',
                kind: 'mindmap',
                scopeId: 'mindmap-1',
                renderedId: 'root-node',
              },
            }),
          }),
          expect.objectContaining({
            type: 'graph-text',
            props: expect.objectContaining({
              id: 'child-node',
              text: 'Child',
              from: 'root-node',
              sourceMeta: {
                sourceId: 'child-node',
                kind: 'mindmap',
                scopeId: 'mindmap-1',
                renderedId: 'child-node',
              },
            }),
          }),
        ],
      },
    ]);
  });
});
