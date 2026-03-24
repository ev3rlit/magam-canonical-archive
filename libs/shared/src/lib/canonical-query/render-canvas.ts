import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { CanonicalObjectRecord, MediaContentCapability } from '../canonical-object-contract';
import { readContentBlocks } from '../canonical-object-contract';
import type { HeadlessServiceContext } from '../canonical-cli';
import {
  CanonicalPersistenceRepository,
  createCanonicalPgliteDb,
  resolveCanonicalMigrationsFolder,
  type CanvasNodeRecord,
  type PluginInstanceResolution,
} from '../canonical-persistence';
import { getWorkspaceCanvas } from './workspace-canvas';

const CANONICAL_MIGRATIONS_FOLDER = fileURLToPath(
  new URL('../canonical-persistence/drizzle/', import.meta.url),
);

type RenderNode = {
  type: string;
  props: Record<string, unknown>;
  children?: RenderNode[];
};

export interface CanonicalRenderGraphResponse {
  graph: {
    children: RenderNode[];
  };
  canvasId: string;
  title: string | null;
  sourceVersion: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function hashCanvasSourceVersion(input: {
  canvasId: string;
  latestRevision: number | null;
}): string {
  return `sha256:${createHash('sha256').update(`${input.canvasId}:${input.latestRevision ?? 0}`).digest('hex')}`;
}

function resolveFrameProps(
  objectRecord: CanonicalObjectRecord | null,
  node: CanvasNodeRecord,
): Record<string, unknown> {
  const frame = isRecord(objectRecord?.capabilities?.frame)
    ? objectRecord?.capabilities?.frame as Record<string, unknown>
    : {};
  return {
    ...(readString((node.props ?? {})['type']) ? { type: (node.props ?? {})['type'] } : {}),
    ...(readString(frame.shape) ? { type: frame.shape } : {}),
    ...(readString(frame.fill) ? { fill: frame.fill } : {}),
    ...(readString(frame.stroke) ? { stroke: frame.stroke } : {}),
    ...(readNumber(frame.strokeWidth) !== undefined ? { strokeWidth: readNumber(frame.strokeWidth) } : {}),
  };
}

function resolveTextContent(objectRecord: CanonicalObjectRecord | null): string | undefined {
  const content = objectRecord?.capabilities?.content;
  if (content?.kind === 'text') {
    return content.value;
  }

  const contentBlocks = readContentBlocks(objectRecord ?? {});
  const textBlock = contentBlocks?.find((block) => block.blockType === 'text');
  if (textBlock?.blockType === 'text') {
    return textBlock.text;
  }

  return undefined;
}

function resolveMarkdownContent(objectRecord: CanonicalObjectRecord | null): string | undefined {
  const content = objectRecord?.capabilities?.content;
  if (content?.kind === 'markdown') {
    return content.source;
  }

  const contentBlocks = readContentBlocks(objectRecord ?? {});
  const markdownBlock = contentBlocks?.find((block) => block.blockType === 'markdown');
  if (markdownBlock?.blockType === 'markdown') {
    return markdownBlock.source;
  }

  return undefined;
}

function resolveMediaContent(objectRecord: CanonicalObjectRecord | null): MediaContentCapability | null {
  const content = objectRecord?.capabilities?.content;
  if (content?.kind === 'media') {
    return content;
  }
  return null;
}

function resolveBodyChildren(objectRecord: CanonicalObjectRecord | null): RenderNode[] {
  const blocks = readContentBlocks(objectRecord ?? {}) ?? [];
  return blocks.flatMap((block): RenderNode[] => {
    if (block.blockType === 'markdown') {
      return [{
        type: 'graph-markdown',
        props: {
          content: block.source,
        },
      }];
    }

    if (block.blockType === 'text') {
      return [{
        type: 'text',
        props: {
          text: block.text,
        },
      }];
    }

    if (block.blockType === 'canvas.image') {
      const assetRef = isRecord(block.payload?.assetRef) ? block.payload.assetRef : null;
      const src = assetRef && assetRef.kind === 'external-url'
        ? readString(assetRef.value)
        : undefined;
      return src
        ? [{
            type: 'graph-image',
            props: {
              src,
              ...(readString(block.payload?.alt) ? { alt: block.payload.alt } : {}),
            },
          }]
        : [];
    }

    return [];
  });
}

function resolveNodeSourceMeta(input: {
  node: CanvasNodeRecord;
  objectRecord: CanonicalObjectRecord | null;
  mindmapId?: string;
}): Record<string, unknown> {
  const sourceMeta = isRecord(input.objectRecord?.sourceMeta)
    ? input.objectRecord?.sourceMeta as Record<string, unknown>
    : {};
  return {
    ...sourceMeta,
    sourceId: readString(sourceMeta.sourceId) ?? input.node.id,
    kind: input.mindmapId ? 'mindmap' : 'canvas',
    ...(input.mindmapId ? { scopeId: input.mindmapId } : {}),
    renderedId: input.node.id,
  };
}

function buildBaseNodeProps(input: {
  node: CanvasNodeRecord;
  objectRecord: CanonicalObjectRecord | null;
  includePosition: boolean;
  mindmapId?: string;
}): Record<string, unknown> {
  const props = input.node.props ?? {};
  const style = input.node.style ?? {};
  return {
    id: input.node.id,
    ...(input.includePosition
      ? {
          ...(readNumber(input.node.layout.x) !== undefined ? { x: input.node.layout.x } : {}),
          ...(readNumber(input.node.layout.y) !== undefined ? { y: input.node.layout.y } : {}),
        }
      : {}),
    ...props,
    ...style,
    zIndex: input.node.zIndex,
    sourceMeta: resolveNodeSourceMeta({
      node: input.node,
      objectRecord: input.objectRecord,
      ...(input.mindmapId ? { mindmapId: input.mindmapId } : {}),
    }),
  };
}

function resolveGraphNodeType(node: CanvasNodeRecord): RenderNode['type'] {
  if (node.nodeKind === 'plugin') {
    return 'graph-plugin';
  }

  switch (node.nodeType) {
    case 'text':
      return 'graph-text';
    case 'sticky':
      return 'graph-sticky';
    case 'image':
      return 'graph-image';
    case 'sticker':
      return 'graph-sticker';
    case 'washi-tape':
      return 'graph-washi-tape';
    case 'markdown':
      return 'graph-node';
    case 'shape':
    case 'rectangle':
    case 'ellipse':
    case 'diamond':
    case 'line':
      return 'graph-shape';
    default:
      return 'graph-node';
  }
}

function buildPluginRenderNode(input: {
  node: CanvasNodeRecord;
  resolvedPlugin: PluginInstanceResolution | null;
  includePosition: boolean;
  mindmapId?: string;
}): RenderNode {
  const plugin = input.resolvedPlugin;
  return {
    type: 'graph-plugin',
    props: {
      ...buildBaseNodeProps({
        node: input.node,
        objectRecord: null,
        includePosition: input.includePosition,
        ...(input.mindmapId ? { mindmapId: input.mindmapId } : {}),
      }),
      pluginInstanceId: plugin?.instance.id ?? input.node.pluginInstanceId ?? `${input.node.id}.instance`,
      pluginPackage: plugin?.pluginPackage.packageName ?? 'local',
      pluginVersionId: plugin?.pluginVersion.id ?? '0.0.0',
      pluginExport: plugin?.pluginExport.exportName ?? 'widget.default',
      pluginDisplayName: plugin?.instance.displayName ?? plugin?.pluginExport.exportName ?? input.node.id,
      ...(plugin?.instance.props ? { pluginProps: plugin.instance.props } : {}),
      ...(plugin?.instance.bindingConfig ? { pluginBindingConfig: plugin.instance.bindingConfig } : {}),
      ...(plugin?.instance.persistedState ? { pluginPersistedState: plugin.instance.persistedState } : {}),
      ...(plugin ? { pluginCapabilities: plugin.permissions.map((permission) => permission.permissionKey) } : {}),
    },
  };
}

function buildNativeRenderNode(input: {
  node: CanvasNodeRecord;
  objectRecord: CanonicalObjectRecord | null;
  includePosition: boolean;
  mindmapId?: string;
  parentNodeId?: string | null;
}): RenderNode {
  const graphType = resolveGraphNodeType(input.node);
  const markdown = resolveMarkdownContent(input.objectRecord);
  const text = resolveTextContent(input.objectRecord);
  const media = resolveMediaContent(input.objectRecord);
  const bodyChildren = resolveBodyChildren(input.objectRecord);
  const props = {
    ...buildBaseNodeProps({
      node: input.node,
      objectRecord: input.objectRecord,
      includePosition: input.includePosition,
      ...(input.mindmapId ? { mindmapId: input.mindmapId } : {}),
    }),
    ...resolveFrameProps(input.objectRecord, input.node),
    ...(input.parentNodeId ? { from: input.parentNodeId } : {}),
  };

  if (graphType === 'graph-image' && media) {
    return {
      type: graphType,
      props: {
        ...props,
        src: media.src,
        ...(media.alt ? { alt: media.alt } : {}),
        ...(media.width !== undefined ? { width: media.width } : {}),
        ...(media.height !== undefined ? { height: media.height } : {}),
        ...(media.fit ? { fit: media.fit } : {}),
      },
    };
  }

  if (graphType === 'graph-text') {
    return {
      type: graphType,
      props: {
        ...props,
        ...(text ? { text } : {}),
      },
      ...(bodyChildren.length > 0 ? { children: bodyChildren } : {}),
    };
  }

  if (graphType === 'graph-sticky' || graphType === 'graph-sticker' || graphType === 'graph-washi-tape') {
    return {
      type: graphType,
      props: {
        ...props,
        ...(text ? { text } : {}),
      },
      ...(bodyChildren.length > 0 ? { children: bodyChildren } : {}),
    };
  }

  if (graphType === 'graph-node') {
    return {
      type: graphType,
      props: {
        ...props,
        ...(text ? { label: text } : {}),
      },
      ...(bodyChildren.length > 0
        ? { children: bodyChildren }
        : markdown
          ? {
              children: [{
                type: 'graph-markdown',
                props: { content: markdown },
              }],
            }
          : {}),
    };
  }

  return {
    type: graphType,
    props: {
      ...props,
      ...(text ? { label: text } : {}),
      ...(input.node.nodeType === 'rectangle'
        || input.node.nodeType === 'ellipse'
        || input.node.nodeType === 'diamond'
        || input.node.nodeType === 'line'
        ? { type: input.node.nodeType }
        : {}),
    },
    ...(bodyChildren.length > 0 ? { children: bodyChildren } : {}),
  };
}

function resolveMindmapMembership(input: {
  node: CanvasNodeRecord;
  objectRecord: CanonicalObjectRecord | null;
}): boolean {
  return input.node.parentNodeId !== null || input.objectRecord?.sourceMeta.kind === 'mindmap';
}

function sortNodes(nodes: CanvasNodeRecord[]): CanvasNodeRecord[] {
  return [...nodes].sort((left, right) => {
    if (left.zIndex !== right.zIndex) {
      return left.zIndex - right.zIndex;
    }
    return left.id.localeCompare(right.id);
  });
}

function buildMindmapChildren(input: {
  root: CanvasNodeRecord;
  nodesById: Map<string, CanvasNodeRecord>;
  objectsById: Map<string, CanonicalObjectRecord>;
  pluginByNodeId: Map<string, PluginInstanceResolution>;
}): RenderNode {
  const mindmapId = readString(input.objectsById.get(input.root.canonicalObjectId ?? '')?.sourceMeta.scopeId)
    ?? `mindmap-${input.root.id}`;
  const treeNodes = sortNodes(
    [...input.nodesById.values()].filter((candidate) => {
      let current: CanvasNodeRecord | undefined = candidate;
      while (current?.parentNodeId) {
        current = input.nodesById.get(current.parentNodeId);
      }
      return current?.id === input.root.id;
    }),
  );

  return {
    type: 'graph-mindmap',
    props: {
      id: mindmapId,
      x: readNumber(input.root.layout.x) ?? 0,
      y: readNumber(input.root.layout.y) ?? 0,
    },
    children: treeNodes.map((node) => {
      const objectRecord = node.canonicalObjectId
        ? input.objectsById.get(node.canonicalObjectId) ?? null
        : null;
      const plugin = input.pluginByNodeId.get(node.id) ?? null;
      if (node.nodeKind === 'plugin') {
        return buildPluginRenderNode({
          node,
          resolvedPlugin: plugin,
          includePosition: false,
          mindmapId,
        });
      }
      return buildNativeRenderNode({
        node,
        objectRecord,
        includePosition: false,
        mindmapId,
        parentNodeId: node.parentNodeId,
      });
    }),
  };
}

export function buildCanonicalRenderResponse(input: {
  canvasId: string;
  title: string | null;
  latestRevision: number | null;
  nodes: CanvasNodeRecord[];
  objectsById: Map<string, CanonicalObjectRecord>;
  pluginByNodeId: Map<string, PluginInstanceResolution>;
}): CanonicalRenderGraphResponse {
  const nodesById = new Map(input.nodes.map((node) => [node.id, node]));
  const topLevelChildren: RenderNode[] = [];
  const handledMindmapRootIds = new Set<string>();

  sortNodes(input.nodes).forEach((node) => {
    const objectRecord = node.canonicalObjectId
      ? input.objectsById.get(node.canonicalObjectId) ?? null
      : null;
    const isMindmapNode = resolveMindmapMembership({
      node,
      objectRecord,
    });

    if (isMindmapNode) {
      let root = node;
      while (root.parentNodeId) {
        const parent = nodesById.get(root.parentNodeId);
        if (!parent) {
          break;
        }
        root = parent;
      }
      if (handledMindmapRootIds.has(root.id)) {
        return;
      }
      handledMindmapRootIds.add(root.id);
      topLevelChildren.push(buildMindmapChildren({
        root,
        nodesById,
        objectsById: input.objectsById,
        pluginByNodeId: input.pluginByNodeId,
      }));
      return;
    }

    const plugin = input.pluginByNodeId.get(node.id) ?? null;
    if (node.nodeKind === 'plugin') {
      topLevelChildren.push(buildPluginRenderNode({
        node,
        resolvedPlugin: plugin,
        includePosition: true,
      }));
      return;
    }

    topLevelChildren.push(buildNativeRenderNode({
      node,
      objectRecord,
      includePosition: true,
    }));
  });

  return {
    graph: {
      children: topLevelChildren,
    },
    canvasId: input.canvasId,
    title: input.title,
    sourceVersion: hashCanvasSourceVersion({
      canvasId: input.canvasId,
      latestRevision: input.latestRevision,
    }),
  };
}

export async function renderCanonicalCanvas(input: {
  targetDir: string;
  canvasId: string;
  workspaceId?: string;
}): Promise<CanonicalRenderGraphResponse> {
  const handle = await createCanonicalPgliteDb(input.targetDir, {
    migrationsFolder: CANONICAL_MIGRATIONS_FOLDER || resolveCanonicalMigrationsFolder(process.cwd()),
    runMigrations: true,
  });
  try {
    const repository = new CanonicalPersistenceRepository(handle.db);
    const context: HeadlessServiceContext = {
      db: handle.db,
      repository,
      targetDir: input.targetDir,
      dataDir: handle.dataDir,
      defaultWorkspaceId: input.workspaceId ?? 'workspace',
    };

    const canvas = await getWorkspaceCanvas(context, input.canvasId, input.workspaceId ?? context.defaultWorkspaceId);
    const nodes = await repository.listCanvasNodes(input.canvasId);
    const objectIds = nodes
      .map((node) => node.canonicalObjectId)
      .filter((value): value is string => typeof value === 'string' && value.length > 0);
    const objects = await repository.listCanonicalObjects(canvas.workspaceId);
    const objectsById = new Map(
      objects
        .filter((record) => objectIds.includes(record.id))
        .map((record) => [record.id, record]),
    );
    const pluginByNodeId = new Map<string, PluginInstanceResolution>();
    await Promise.all(
      nodes
        .filter((node) => node.nodeKind === 'plugin' && typeof node.pluginInstanceId === 'string')
        .map(async (node) => {
          const resolved = await repository.resolvePluginInstance(node.pluginInstanceId as string);
          if (resolved.ok) {
            pluginByNodeId.set(node.id, resolved.value);
          }
        }),
    );

    return buildCanonicalRenderResponse({
      canvasId: input.canvasId,
      title: canvas.title,
      latestRevision: canvas.latestRevision,
      nodes,
      objectsById,
      pluginByNodeId,
    });
  } finally {
    await handle.close();
  }
}
