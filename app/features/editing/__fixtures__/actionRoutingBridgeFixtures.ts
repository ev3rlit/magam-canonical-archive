import type { Node } from 'reactflow';
import type { CanonicalObject } from '@/features/render/canonicalObject';

export const stickerCanonicalObjectFixture: CanonicalObject = {
  core: {
    id: 'sticker-1',
    sourceMeta: {
      sourceId: 'sticker-1',
      kind: 'canvas',
    },
  },
  semanticRole: 'sticky-note',
  alias: 'Sticker',
  capabilities: {
    material: {
      preset: 'paper',
    },
    content: {
      kind: 'text',
      value: 'Hello',
      fontSize: 'm',
    },
  },
};

export const stickerBridgeNodeFixture = {
  id: 'sticker-1',
  type: 'sticker',
  position: { x: 10, y: 20 },
  data: {
    outlineColor: '#fff',
    outlineWidth: 4,
    shadow: 'md',
    sourceMeta: {
      sourceId: 'sticker-1',
      kind: 'canvas',
    },
    canonicalObject: stickerCanonicalObjectFixture,
    editMeta: {
      family: 'canvas-absolute',
      styleEditableKeys: ['outlineColor', 'outlineWidth', 'shadow', 'padding', 'rotation'],
      createMode: 'canvas',
    },
  },
} as Node;

export const mindmapBridgeNodeFixture = {
  id: 'mindmap.child-1',
  type: 'shape',
  position: { x: 0, y: 0 },
  data: {
    label: 'Child',
    groupId: 'mindmap',
    sourceMeta: {
      sourceId: 'child-1',
      scopeId: 'mindmap',
      kind: 'mindmap',
    },
    canonicalObject: {
      ...stickerCanonicalObjectFixture,
      core: {
        id: 'child-1',
        sourceMeta: {
          sourceId: 'child-1',
          kind: 'mindmap',
        },
        relations: {
          from: 'root-1',
        },
      },
      semanticRole: 'topic',
      alias: 'Node',
      capabilities: {
        content: {
          kind: 'text',
          value: 'Child',
          fontSize: 'm',
        },
      },
    },
    editMeta: {
      family: 'mindmap-member',
      contentCarrier: 'text-child',
      styleEditableKeys: ['color', 'fontSize'],
      createMode: 'mindmap-child',
    },
  },
} as Node;
