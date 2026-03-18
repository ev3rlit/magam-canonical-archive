import type { Edge, Node } from 'reactflow';
import type { ActionRoutingContext } from '@/features/editing/actionRoutingBridge/types';
import type { CanonicalObject } from '@/features/render/canonicalObject';

export function makeCanonicalNode(input: {
  id: string;
  type: string;
  filePath?: string;
  sourceId?: string;
  groupId?: string;
  canonical?: CanonicalObject;
  data?: Record<string, unknown>;
}): Node {
  const canonical = input.canonical ?? {
    core: {
      id: input.sourceId ?? input.id,
      sourceMeta: {
        sourceId: input.sourceId ?? input.id,
        filePath: input.filePath ?? 'examples/bridge.tsx',
        kind: input.groupId ? 'mindmap' : 'canvas',
      },
      relations: input.groupId ? { from: 'map.root' } : undefined,
    },
    semanticRole: 'topic',
    alias: input.type === 'markdown' ? 'Markdown' : 'Node',
    capabilities: input.type === 'markdown'
      ? {
          content: {
            kind: 'markdown',
            source: '# Title',
            size: 'm',
          },
        }
      : input.type === 'text'
        ? {
            content: {
              kind: 'text',
              value: 'Hello',
              fontSize: 'm',
            },
          }
        : {
            frame: {
              shape: 'rounded',
              fill: '#fff',
            },
          },
  };

  return {
    id: input.id,
    type: input.type,
    position: { x: 0, y: 0 },
    data: {
      label: input.type === 'text' ? 'Hello' : input.id,
      groupId: input.groupId,
      sourceMeta: {
        sourceId: input.sourceId ?? input.id,
        filePath: input.filePath ?? 'examples/bridge.tsx',
        kind: input.groupId ? 'mindmap' : 'canvas',
      },
      canonicalObject: canonical,
      ...(input.data ?? {}),
    },
  } as Node;
}

export function makeReadonlyNode(input: {
  id: string;
  type: string;
}): Node {
  return {
    id: input.id,
    type: input.type,
    position: { x: 0, y: 0 },
    data: {
      label: input.id,
      editMeta: {
        family: 'canvas-absolute',
        styleEditableKeys: [],
        createMode: 'canvas',
        readOnlyReason: 'READ_ONLY',
      },
    },
  } as Node;
}

export function makeActionRoutingContext(input?: {
  nodes?: Node[];
  edges?: Edge[];
  currentFile?: string | null;
  sourceVersions?: Record<string, string>;
  now?: number;
}): ActionRoutingContext {
  return {
    nodes: input?.nodes ?? [],
    edges: input?.edges ?? [],
    currentFile: input?.currentFile ?? 'examples/bridge.tsx',
    sourceVersions: input?.sourceVersions ?? {
      'examples/bridge.tsx': 'sha256:bridge-v1',
    },
    now: input?.now ?? 1_710_000_000_000,
  };
}
