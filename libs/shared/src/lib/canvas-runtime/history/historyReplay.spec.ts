import { describe, expect, it } from 'vitest';
import { normalizeReplayBatch } from './normalizeReplay';
import { resolveBodyBlockPosition, resolveBodyBlockTarget } from './resolveBodyBlockTargets';

describe('canvas runtime history normalization', () => {
  const objectRecord = {
    contentBlocks: [
      { id: 'body-1', blockType: 'text' as const, text: 'one' },
      { id: 'body-2', blockType: 'markdown' as const, source: 'two' },
    ],
  };

  it('resolves selection keys and anchors to stable block ids', () => {
    expect(resolveBodyBlockTarget({
      objectRecord,
      target: { mode: 'selection', selectionKey: 'object:node-1:body:1:body-2' },
    })).toEqual({
      blockId: 'body-2',
      index: 1,
    });

    expect(resolveBodyBlockPosition({
      objectRecord,
      position: { mode: 'anchor', anchorId: 'node:node-1:body-before:body-2' },
    })).toEqual({
      resolved: { mode: 'before-block', blockId: 'body-2' },
      index: 1,
    });
  });

  it('normalizes replay batches into canonical history form', () => {
    expect(normalizeReplayBatch({
      workspaceId: 'ws-1',
      canvasId: 'doc-1',
      commands: [{
        name: 'canvas.node.move',
        canvasId: 'doc-1',
        nodeId: 'node-1',
        x: 10,
        y: 20,
      }],
      resolvedAgainstRevision: 4,
    })).toEqual({
      workspaceId: 'ws-1',
      canvasId: 'doc-1',
      commands: [{
        name: 'canvas.node.move',
        canvasId: 'doc-1',
        nodeId: 'node-1',
        x: 10,
        y: 20,
      }],
      normalization: {
        source: 'resolved-before-commit',
        resolvedAgainstRevision: 4,
      },
    });
  });
});
