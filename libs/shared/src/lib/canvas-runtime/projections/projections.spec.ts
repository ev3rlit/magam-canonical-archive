import { describe, expect, it } from 'vitest';
import { buildEditingProjection } from './buildEditingProjection';
import { buildRenderProjection } from './buildRenderProjection';

describe('canvas runtime projections', () => {
  it('builds separate render and editing projections from the same repository-safe records', async () => {
    const runtimeContext = {
      headless: {
        defaultWorkspaceId: 'ws-1',
      },
      repository: {
        async listCanvasNodes() {
          return [{
            id: 'node-1',
            canvasId: 'doc-1',
            surfaceId: 'main',
            nodeKind: 'native',
            nodeType: 'markdown',
            canonicalObjectId: 'node-1',
            layout: { x: 10, y: 20, width: 200, height: 120 },
            style: { fill: '#fff7cc', stroke: '#111111' },
            zIndex: 3,
          }];
        },
        async listCanonicalObjects() {
          return [{
            id: 'node-1',
            workspaceId: 'ws-1',
            semanticRole: 'topic',
            publicAlias: 'Markdown',
            sourceMeta: { sourceId: 'node-1', kind: 'canvas' as const },
            capabilities: {},
            contentBlocks: [{ id: 'body-1', blockType: 'markdown' as const, source: '# Hello runtime' }],
            primaryContentKind: 'markdown' as const,
            canonicalText: '# Hello runtime',
          }];
        },
      },
    } as any;

    const [renderProjection, editingProjection] = await Promise.all([
      buildRenderProjection(runtimeContext, { canvasId: 'doc-1', workspaceId: 'ws-1' }),
      buildEditingProjection(runtimeContext, { canvasId: 'doc-1', workspaceId: 'ws-1' }),
    ]);

    expect(renderProjection.nodes).toEqual([
      expect.objectContaining({
        nodeId: 'node-1',
        transform: expect.objectContaining({ x: 10, y: 20, width: 200, height: 120 }),
        presentationStyle: expect.objectContaining({ fillColor: '#fff7cc', strokeColor: '#111111' }),
      }),
    ]);
    expect(editingProjection.nodes).toEqual([
      expect.objectContaining({
        nodeId: 'node-1',
        allowedCommands: expect.arrayContaining(['object.content.update', 'object.body.replace', 'object.body.block.insert']),
        body: expect.objectContaining({ type: 'doc' }),
        bodySource: 'legacy-converted',
        bodyBlocks: [
          expect.objectContaining({
            blockId: 'body-1',
            selectionKey: 'object:node-1:body:0:body-1',
          }),
        ],
      }),
    ]);
  });
});
