import { describe, expect, it } from 'vitest';
import { buildHierarchyProjection } from './buildHierarchyProjection';

describe('canvas hierarchy projection', () => {
  it('returns roots and orphan ids without renderer-specific fields', async () => {
    const runtimeContext = {
      headless: {
        defaultWorkspaceId: 'ws-1',
      },
      repository: {
        async listCanvasNodes() {
          return [
            {
              id: 'root-1',
              canvasId: 'doc-1',
              surfaceId: 'main',
              nodeKind: 'native',
              nodeType: 'shape',
              layout: { x: 0, y: 0 },
              zIndex: 1,
            },
            {
              id: 'child-1',
              canvasId: 'doc-1',
              surfaceId: 'main',
              nodeKind: 'native',
              nodeType: 'shape',
              parentNodeId: 'root-1',
              layout: { x: 10, y: 20 },
              zIndex: 2,
            },
            {
              id: 'orphan-1',
              canvasId: 'doc-1',
              surfaceId: 'main',
              nodeKind: 'native',
              nodeType: 'shape',
              parentNodeId: 'missing-parent',
              layout: { x: 30, y: 40 },
              zIndex: 3,
            },
          ];
        },
        async listCanonicalObjects() {
          return [];
        },
      },
    } as any;

    const projection = await buildHierarchyProjection(runtimeContext, {
      canvasId: 'doc-1',
      workspaceId: 'ws-1',
    });

    expect(projection.roots).toEqual([
      expect.objectContaining({
        nodeId: 'root-1',
        children: [expect.objectContaining({ nodeId: 'child-1' })],
      }),
    ]);
    expect(projection.orphanNodeIds).toEqual(['orphan-1']);
    expect(JSON.stringify(projection)).not.toContain('reactflow');
  });
});
