import { describe, expect, it } from 'bun:test';
import { parseRenderGraph } from '@/features/render/parseRenderGraph';
import { resolveCreatedCanvasBootstrapGraph } from './createdCanvasBootstrap';

describe('CanvasEditorPage runtime projection bridge', () => {
  it('seeds new canvas state from the create RPC source version', () => {
    expect(resolveCreatedCanvasBootstrapGraph({
      canvasId: 'doc-new',
      sourceVersion: 'sha256:doc-new',
      latestRevision: 1,
    })).toEqual({
      nodes: [],
      edges: [],
      sourceVersion: 'sha256:doc-new',
      canvasVersions: {
        'doc-new': 'sha256:doc-new',
      },
      canvasRevisionsById: {
        'doc-new': 1,
      },
      assetBasePath: null,
    });
  });

  it('overlays shared editing projection metadata onto parsed nodes', () => {
    const parsed = parseRenderGraph({
      graph: {
        children: [
          {
            type: 'graph-node',
            props: {
              id: 'node-1',
              x: 20,
              y: 40,
              sourceMeta: {
                sourceId: 'node-1',
                kind: 'canvas',
              },
            },
            children: [
              {
                type: 'graph-markdown',
                props: {
                  content: '# Runtime note',
                },
              },
            ],
          },
        ],
      },
      renderProjection: {
        canvasId: 'doc-1',
        workspaceId: 'ws-1',
        surfaceId: 'main',
        nodes: [{
          nodeId: 'node-1',
          kind: 'node',
          nodeType: 'markdown',
          surfaceId: 'main',
          canonicalObjectId: 'node-1',
          transform: {
            x: 120,
            y: 160,
            width: 240,
            height: 140,
            rotation: 18,
          },
          presentationStyle: {
            fillColor: '#fff7cc',
            strokeColor: '#111111',
          },
          visible: true,
          summary: {
            title: 'Runtime Label',
            canonicalTextPreview: '# Runtime note',
            semanticRole: 'topic',
          },
        }],
        edges: [],
        mindmapGroups: [],
      },
      editingProjection: {
        canvasId: 'doc-1',
        workspaceId: 'ws-1',
        surfaceId: 'main',
        nodes: [{
          nodeId: 'node-1',
          surfaceId: 'main',
          canonicalObjectId: 'node-1',
          selectionKey: 'node:node-1',
          allowedCommands: [
            'canvas.node.move',
            'object.content.update',
            'object.body.block.insert',
          ],
          interactionCapabilities: {
            selectable: true,
            movable: true,
            reparentable: false,
            renamable: true,
            deletable: true,
            zOrderEditable: false,
            objectContentEditable: true,
            objectCapabilityPatchable: true,
            bodyEntrySupported: true,
          },
          bodyEntry: {
            supported: true,
            targetObjectId: 'node-1',
            preferredCommandName: 'object.body.block.insert',
            mode: 'object-body',
          },
          anchors: [],
          bodyBlocks: [{
            blockId: 'body-1',
            kind: 'callout',
            index: 0,
            selectionKey: 'object:node-1:body:0:body-1',
            contentAnchorId: 'node:node-1:body-content:body-1',
            beforeAnchorId: 'node:node-1:body-before:body-1',
            afterAnchorId: 'node:node-1:body-after:body-1',
            previewText: '# Runtime note',
          }],
          selectedBodyBlockId: null,
        }],
      },
    });

    expect(parsed).not.toBeNull();
    expect(parsed?.nodes[0]).toMatchObject({
      position: { x: 120, y: 160 },
      data: {
        fill: '#fff7cc',
        stroke: '#111111',
        label: 'Runtime Label',
        rotation: 18,
        runtimeEditing: expect.objectContaining({
          nodeId: 'node-1',
          bodyBlocks: [expect.objectContaining({ blockId: 'body-1' })],
        }),
        editMeta: expect.objectContaining({
          family: 'rich-content',
          allowedCommandsOverride: expect.arrayContaining(['node.move.absolute', 'node.content.update']),
        }),
      },
    });
  });
});
