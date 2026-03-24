import type { Edge, Node } from 'reactflow';
import type { ActionRoutingContext } from '@/features/editing/actionRoutingBridge/types';
import type { CanonicalObject } from '@/features/render/canonicalObject';

export function makeCanonicalNode(input: {
  id: string;
  type: string;
  filePath?: string;
  sourceId?: string;
  groupId?: string;
  sourceKind?: 'canvas' | 'mindmap';
  canonical?: CanonicalObject;
  data?: Record<string, unknown>;
}): Node {
  const sourceKind = input.sourceKind ?? (input.groupId ? 'mindmap' : 'canvas');
  const canonical = input.canonical ?? {
    core: {
      id: input.sourceId ?? input.id,
      sourceMeta: {
        sourceId: input.sourceId ?? input.id,
        filePath: input.filePath ?? 'examples/bridge.tsx',
        kind: sourceKind,
      },
      relations: input.groupId && sourceKind === 'mindmap' ? { from: 'map.root' } : undefined,
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
        kind: sourceKind,
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
  currentCanvasId?: string | null;
  currentCompatibilityFilePath?: string | null;
  canvasVersions?: Record<string, string>;
  currentFile?: string | null;
  sourceVersions?: Record<string, string>;
  now?: number;
}): ActionRoutingContext {
  const currentCanvasId = input?.currentCanvasId ?? 'canvas-bridge';
  const currentCompatibilityFilePath = input?.currentCompatibilityFilePath
    ?? input?.currentFile
    ?? 'examples/bridge.tsx';
  const sourceVersions = input?.sourceVersions ?? {
    [currentCompatibilityFilePath]: 'sha256:bridge-v1',
  };
  const fallbackVersion = Object.values(input?.sourceVersions ?? {})[0] ?? 'sha256:bridge-v1';
  const canvasVersions = input?.canvasVersions
    ?? (currentCanvasId ? { [currentCanvasId]: fallbackVersion } : {});

  return {
    nodes: input?.nodes ?? [],
    edges: input?.edges ?? [],
    currentCanvasId,
    currentCompatibilityFilePath,
    canvasVersions,
    currentFile: currentCompatibilityFilePath,
    sourceVersions,
    now: input?.now ?? 1_710_000_000_000,
  } as ActionRoutingContext;
}
