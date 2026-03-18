import nodeContextMenuContribution from '@/features/canvas-ui-entrypoints/node-context-menu/contribution';
import paneContextMenuContribution from '@/features/canvas-ui-entrypoints/pane-context-menu/contribution';
import {
  createEntrypointAnchor,
  createOpenSurfaceDescriptor,
  getContextMenuSurfaceKind,
  type EntrypointAnchorSnapshot,
  type OpenSurfaceDescriptor,
} from '@/features/canvas-ui-entrypoints/ui-runtime-state';
import { sanitizeContextMenuItems } from '@/hooks/useContextMenu.helpers';
import type { ContextMenuContext, ContextMenuItem } from '@/types/contextMenu';

export type CanvasContextMenuSurfaceKind = Extract<
  ContextMenuContext['surfaceKind'],
  'pane-context-menu' | 'node-context-menu'
>;

type ContextMenuSlotKey = 'paneContextMenu' | 'nodeContextMenu';

type ContextMenuSlotRegistry = {
  paneContextMenu?: {
    items?: ReadonlyArray<ContextMenuItem>;
  };
  nodeContextMenu?: {
    items?: ReadonlyArray<ContextMenuItem>;
  };
};

export interface CanvasContextMenuRuntimeLike {
  slots?: ContextMenuSlotRegistry;
}

export interface ResolvedCanvasContextMenuSession {
  anchorId: string;
  surfaceKind: CanvasContextMenuSurfaceKind;
  items: ContextMenuItem[];
  context: ContextMenuContext;
  anchor: EntrypointAnchorSnapshot;
  openSurface: OpenSurfaceDescriptor;
}

const FALLBACK_REGISTRY: Record<CanvasContextMenuSurfaceKind, ReadonlyArray<ContextMenuItem>> = {
  'pane-context-menu': paneContextMenuContribution.paneMenuItems ?? [],
  'node-context-menu': nodeContextMenuContribution.nodeMenuItems ?? [],
};

function toContextMenuSlotKey(surfaceKind: CanvasContextMenuSurfaceKind): ContextMenuSlotKey {
  return surfaceKind === 'node-context-menu'
    ? 'nodeContextMenu'
    : 'paneContextMenu';
}

function resolveRegistryItems(input: {
  surfaceKind: CanvasContextMenuSurfaceKind;
  runtime?: CanvasContextMenuRuntimeLike;
}): ContextMenuItem[] {
  const slotKey = toContextMenuSlotKey(input.surfaceKind);
  const slotItems = input.runtime?.slots?.[slotKey]?.items;
  const rawItems = slotItems && slotItems.length > 0
    ? slotItems
    : FALLBACK_REGISTRY[input.surfaceKind];

  return [...rawItems];
}

export function buildContextMenuAnchorId(ctx: ContextMenuContext): string {
  if (ctx.type === 'node') {
    return `context-menu:node:${ctx.nodeId ?? 'unknown'}`;
  }

  return 'context-menu:pane';
}

export function resolveContextMenuSurfaceKind(ctx: ContextMenuContext): CanvasContextMenuSurfaceKind {
  return getContextMenuSurfaceKind(ctx.type) as CanvasContextMenuSurfaceKind;
}

export function resolveCanvasContextMenuSession(input: {
  context: ContextMenuContext;
  runtime?: CanvasContextMenuRuntimeLike;
}): ResolvedCanvasContextMenuSession {
  const surfaceKind = resolveContextMenuSurfaceKind(input.context);
  const anchorId = input.context.anchorId ?? buildContextMenuAnchorId(input.context);
  const nextContext: ContextMenuContext = {
    ...input.context,
    anchorId,
    surfaceKind,
  };
  const items = sanitizeContextMenuItems(
    resolveRegistryItems({
      surfaceKind,
      runtime: input.runtime,
    }),
    nextContext,
  );

  return {
    anchorId,
    surfaceKind,
    items,
    context: nextContext,
    anchor: createEntrypointAnchor({
      anchorId,
      kind: 'pointer',
      ownerId: input.context.nodeId,
      nodeIds: input.context.selectedNodeIds,
      screen: {
        x: input.context.position.x,
        y: input.context.position.y,
      },
    }),
    openSurface: createOpenSurfaceDescriptor({
      kind: surfaceKind,
      anchorId,
      ownerId: input.context.nodeId,
      dismissOnSelectionChange: input.context.type === 'node',
      dismissOnViewportChange: true,
    }),
  };
}
