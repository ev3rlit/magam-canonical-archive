import { describe, expect, it } from 'bun:test';
import {
  buildRuntimeReconciliationFingerprint,
} from './useCanvasRuntime';
import {
  buildCanvasNodeCreateCommand,
  buildObjectBodyBlockInsertCommand,
  resolveCanonicalObjectId,
  resolveRuntimeContentKind,
  resolveSourceNodeId,
} from '@/ws/shared/runtimeTransforms';

describe('useCanvasRuntime shared transform semantics', () => {
  it('creates a stable reconciliation fingerprint from workspace/canvas/node versions', () => {
    expect(buildRuntimeReconciliationFingerprint({
      canvasId: 'canvas-1',
      workspaceId: 'workspace-1',
      workspaceRuntimeVersion: { versionToken: 'workspace-v1' },
      canvasMetadataVersion: { metadataRevisionNo: 2, versionToken: 'canvas-v2' },
      nodeVersions: [
        { nodeId: 'node-b', headRevisionNo: 3, versionToken: 'node-b-v3' },
        { nodeId: 'node-a', headRevisionNo: 1, versionToken: 'node-a-v1' },
      ],
    })).toBe(buildRuntimeReconciliationFingerprint({
      canvasId: 'canvas-1',
      workspaceId: 'workspace-1',
      workspaceRuntimeVersion: { versionToken: 'workspace-v1' },
      canvasMetadataVersion: { metadataRevisionNo: 2, versionToken: 'canvas-v2' },
      nodeVersions: [
        { nodeId: 'node-a', headRevisionNo: 1, versionToken: 'node-a-v1' },
        { nodeId: 'node-b', headRevisionNo: 3, versionToken: 'node-b-v3' },
      ],
    }));
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
