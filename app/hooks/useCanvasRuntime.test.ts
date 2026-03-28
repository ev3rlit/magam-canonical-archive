import { describe, expect, it } from 'bun:test';
import {
  buildCanvasSubscriptionRequests,
  isSubscriptionNotificationMethod,
} from './useCanvasRuntime';
import {
  buildCanvasNodeCreateCommand,
  buildObjectBodyBlockInsertCommand,
  resolveCanonicalObjectId,
  resolveRuntimeContentKind,
  resolveSourceNodeId,
} from '@/ws/shared/runtimeTransforms';

describe('useCanvasRuntime shared transform semantics', () => {
  it('builds paired canvas/file subscribe and unsubscribe requests for the active canvas', () => {
    expect(buildCanvasSubscriptionRequests({
      canvasId: 'canvas-1',
      workspaceRootPath: '/tmp/workspace',
      startingId: 10,
      subscribe: true,
    })).toEqual([
      {
        jsonrpc: '2.0',
        id: 10,
        method: 'canvas.subscribe',
        params: {
          canvasId: 'canvas-1',
          rootPath: '/tmp/workspace',
        },
      },
      {
        jsonrpc: '2.0',
        id: 11,
        method: 'file.subscribe',
        params: {
          canvasId: 'canvas-1',
          rootPath: '/tmp/workspace',
        },
      },
    ]);

    expect(buildCanvasSubscriptionRequests({
      canvasId: 'canvas-1',
      workspaceRootPath: '/tmp/workspace',
      startingId: 20,
      subscribe: false,
    })).toEqual([
      {
        jsonrpc: '2.0',
        id: 20,
        method: 'canvas.unsubscribe',
        params: {
          canvasId: 'canvas-1',
          rootPath: '/tmp/workspace',
        },
      },
      {
        jsonrpc: '2.0',
        id: 21,
        method: 'file.unsubscribe',
        params: {
          canvasId: 'canvas-1',
          rootPath: '/tmp/workspace',
        },
      },
    ]);
  });

  it('recognizes subscription notification methods only', () => {
    expect(isSubscriptionNotificationMethod('canvas.changed')).toBe(true);
    expect(isSubscriptionNotificationMethod('file.changed')).toBe(true);
    expect(isSubscriptionNotificationMethod('files.changed')).toBe(true);
    expect(isSubscriptionNotificationMethod('canvas.runtime.mutate')).toBe(false);
  });

  it('resolves runtime ids from runtimeEditing first and falls back to sourceMeta/id', () => {
    const runtimeNode = {
      id: 'rendered-1',
      type: 'shape',
      data: {
        runtimeEditing: {
          nodeId: 'source-1',
          canonicalObjectId: 'object-1',
        },
        sourceMeta: {
          sourceId: 'source-fallback',
        },
      },
    };

    expect(resolveSourceNodeId(runtimeNode)).toBe('source-1');
    expect(resolveCanonicalObjectId(runtimeNode)).toBe('object-1');
    expect(resolveRuntimeContentKind(runtimeNode)).toBe('markdown');
  });

  it('creates a deterministic runtime create command for mindmap roots with fallback ids', () => {
    const command = buildCanvasNodeCreateCommand({
      canvasId: 'canvas-1',
      nodeId: 'node-1',
      nodeType: 'mindmap',
      placement: {
        mode: 'mindmap-root',
        x: 240,
        y: 320,
      },
      fallbackMindmapId: 'mindmap-node-1',
      generateId: () => 'unused',
    });

    expect(command.placement).toEqual({
      mode: 'mindmap-root',
      x: 240,
      y: 320,
      mindmapId: 'mindmap-node-1',
    });
    expect(command.kind).toBe('node');
    expect(command.nodeType).toBe('shape');
  });

  it('builds body block insert anchors from source ids once', () => {
    const command = buildObjectBodyBlockInsertCommand({
      objectId: 'object-1',
      sourceNodeId: 'source-1',
      afterBlockId: 'block-1',
      block: {
        id: 'block-2',
        blockType: 'markdown',
        source: 'Body',
      },
      generateId: () => 'unused',
    });

    expect(command).toEqual({
      name: 'object.body.block.insert',
      objectId: 'object-1',
      block: {
        blockId: 'block-2',
        kind: 'callout',
        props: {
          source: 'Body',
          text: 'Body',
        },
      },
      position: {
        mode: 'anchor',
        anchorId: 'node:source-1:body-after:block-1',
      },
    });
  });
});
