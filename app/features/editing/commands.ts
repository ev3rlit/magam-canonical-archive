import type {
  EditCommandType,
  EditContentCarrier,
  EditMeta,
  EditRelativeCarrier,
} from './editability';
import { createPendingUiRequestId } from '@/features/canvas-ui-entrypoints/ui-runtime-state';

export interface EditTarget {
  sourceId: string;
  canvasId?: string;
  filePath: string;
  compatibilityFilePath?: string | null;
  renderedId?: string;
  scopeId?: string;
  frameScope?: string;
  editMeta?: EditMeta;
}

export interface EditCommandEnvelope<TType extends EditCommandType, TPayload> {
  type: TType;
  target: EditTarget;
  payload: TPayload;
}

export interface AbsoluteMovePayload {
  previous: { x: number; y: number };
  next: { x: number; y: number };
}

export interface RelativeMovePayload {
  carrier: EditRelativeCarrier;
  previous: { gap?: number; at?: { offset: number } };
  next: { gap?: number; at?: { offset: number } };
}

export interface ContentUpdatePayload {
  carrier: EditContentCarrier;
  previous: { content: string };
  next: { content: string };
}

export interface StyleUpdatePayload {
  previous: Record<string, unknown>;
  patch: Record<string, unknown>;
}

export interface GroupMembershipUpdatePayload {
  previous: { groupId: string | null };
  next: { groupId: string | null };
}

export interface RenamePayload {
  previous: { id: string };
  next: { id: string };
  rewriteSurfaces: Array<'from' | 'to' | 'anchor'>;
}

export interface CreatePayload {
  nodeType:
    | 'shape'
    | 'rectangle'
    | 'ellipse'
    | 'diamond'
    | 'line'
    | 'text'
    | 'markdown'
    | 'sticky'
    | 'sticker'
    | 'washi-tape'
    | 'image';
  id: string;
  initialProps?: Record<string, unknown>;
  initialContent?: string;
  placement:
    | { mode: 'canvas-absolute'; x: number; y: number }
    | { mode: 'mindmap-child'; parentId: string }
    | { mode: 'mindmap-sibling'; siblingOf: string; parentId: string | null };
}

export interface ReparentPayload {
  previous: { parentId: string | null };
  next: { parentId: string | null };
}

export interface ZOrderUpdatePayload {
  previous: { zIndex: number | null };
  next: { zIndex: number | null };
}

export type PluginInstanceCommandType =
  | 'plugin-instance.create'
  | 'plugin-instance.update-props'
  | 'plugin-instance.update-binding'
  | 'plugin-instance.remove';

export interface PluginInstanceRef {
  instanceId: string;
  pluginExportId?: string;
  pluginVersionId?: string;
}

export interface PluginInstanceCreatePayload {
  instance: {
    id: string;
    pluginExportId: string;
    pluginVersionId: string;
    displayName?: string;
    props?: Record<string, unknown>;
    bindingConfig?: Record<string, unknown>;
    persistedState?: Record<string, unknown>;
  };
}

export interface PluginInstanceUpdatePropsPayload {
  instanceId: string;
  patch: Record<string, unknown>;
}

export interface PluginInstanceUpdateBindingPayload {
  instanceId: string;
  bindingConfig: Record<string, unknown>;
}

export interface PluginInstanceRemovePayload {
  instanceId: string;
}

export interface PluginCommandEnvelope<TType extends PluginInstanceCommandType, TPayload> {
  type: TType;
  target: EditTarget;
  plugin: PluginInstanceRef;
  payload: TPayload;
}

export type AbsoluteMoveCommand = EditCommandEnvelope<'node.move.absolute', AbsoluteMovePayload>;
export type RelativeMoveCommand = EditCommandEnvelope<'node.move.relative', RelativeMovePayload>;
export type ContentUpdateCommand = EditCommandEnvelope<'node.content.update', ContentUpdatePayload>;
export type StyleUpdateCommand = EditCommandEnvelope<'node.style.update', StyleUpdatePayload>;
export type GroupMembershipUpdateCommand = EditCommandEnvelope<'node.group.update', GroupMembershipUpdatePayload>;
export type RenameCommand = EditCommandEnvelope<'node.rename', RenamePayload>;
export type CreateCommand = EditCommandEnvelope<'node.create' | 'mindmap.child.create' | 'mindmap.sibling.create', CreatePayload>;
export type ReparentCommand = EditCommandEnvelope<'node.reparent', ReparentPayload>;
export type ZOrderUpdateCommand = EditCommandEnvelope<'node.z-order.update', ZOrderUpdatePayload>;

export type UpdateCommand =
  | RelativeMoveCommand
  | ContentUpdateCommand
  | StyleUpdateCommand
  | RenameCommand;

export type AnyEditCommand =
  | AbsoluteMoveCommand
  | RelativeMoveCommand
  | ContentUpdateCommand
  | StyleUpdateCommand
  | GroupMembershipUpdateCommand
  | RenameCommand
  | CreateCommand
  | ReparentCommand
  | ZOrderUpdateCommand;

export type AnyPluginCommand =
  | PluginCommandEnvelope<'plugin-instance.create', PluginInstanceCreatePayload>
  | PluginCommandEnvelope<'plugin-instance.update-props', PluginInstanceUpdatePropsPayload>
  | PluginCommandEnvelope<'plugin-instance.update-binding', PluginInstanceUpdateBindingPayload>
  | PluginCommandEnvelope<'plugin-instance.remove', PluginInstanceRemovePayload>;

export function getPendingActionTypeForCommand(commandType: EditCommandType): string {
  return commandType;
}

export function createPendingRequestIdForCommand(commandType: EditCommandType, ownerId?: string): string {
  return createPendingUiRequestId(getPendingActionTypeForCommand(commandType), ownerId);
}

export function getPendingActionTypeForPluginCommand(commandType: PluginInstanceCommandType): string {
  return commandType;
}

export function createPendingRequestIdForPluginCommand(
  commandType: PluginInstanceCommandType,
  ownerId?: string,
): string {
  return createPendingUiRequestId(getPendingActionTypeForPluginCommand(commandType), ownerId);
}

export function buildAbsoluteMoveCommand(input: {
  target: EditTarget;
  previous: { x: number; y: number };
  next: { x: number; y: number };
}): AbsoluteMoveCommand {
  return {
    type: 'node.move.absolute',
    target: input.target,
    payload: {
      previous: input.previous,
      next: input.next,
    },
  };
}

export function buildRelativeMoveCommand(input: {
  target: EditTarget;
  carrier: EditRelativeCarrier;
  previous: RelativeMovePayload['previous'];
  next: RelativeMovePayload['next'];
}): RelativeMoveCommand {
  return {
    type: 'node.move.relative',
    target: input.target,
    payload: {
      carrier: input.carrier,
      previous: input.previous,
      next: input.next,
    },
  };
}

export function buildContentUpdateCommand(input: {
  target: EditTarget;
  carrier: EditContentCarrier;
  previousContent: string;
  nextContent: string;
}): ContentUpdateCommand {
  return {
    type: 'node.content.update',
    target: input.target,
    payload: {
      carrier: input.carrier,
      previous: { content: input.previousContent },
      next: { content: input.nextContent },
    },
  };
}

export function buildStyleUpdateCommand(input: {
  target: EditTarget;
  previous: Record<string, unknown>;
  patch: Record<string, unknown>;
}): StyleUpdateCommand {
  return {
    type: 'node.style.update',
    target: input.target,
    payload: {
      previous: input.previous,
      patch: input.patch,
    },
  };
}

export function buildGroupMembershipUpdateCommand(input: {
  target: EditTarget;
  previousGroupId: string | null;
  nextGroupId: string | null;
}): GroupMembershipUpdateCommand {
  return {
    type: 'node.group.update',
    target: input.target,
    payload: {
      previous: { groupId: input.previousGroupId },
      next: { groupId: input.nextGroupId },
    },
  };
}

export function buildRenameCommand(input: {
  target: EditTarget;
  previousId: string;
  nextId: string;
  rewriteSurfaces?: Array<'from' | 'to' | 'anchor'>;
}): RenameCommand {
  return {
    type: 'node.rename',
    target: input.target,
    payload: {
      previous: { id: input.previousId },
      next: { id: input.nextId },
      rewriteSurfaces: input.rewriteSurfaces ?? ['from', 'to', 'anchor'],
    },
  };
}

export function buildCreateCommand(input: {
  type: CreateCommand['type'];
  target: EditTarget;
  payload: CreatePayload;
}): CreateCommand {
  return {
    type: input.type,
    target: input.target,
    payload: input.payload,
  };
}

export function toCreateNodeInput(command: CreateCommand): {
  id: string;
  type: CreatePayload['nodeType'];
  props: Record<string, unknown>;
  placement: CreatePayload['placement'];
} {
  const placementProps = command.payload.placement.mode === 'canvas-absolute'
    ? {
        x: command.payload.placement.x,
        y: command.payload.placement.y,
      }
    : command.payload.placement.mode === 'mindmap-child'
      ? {
          from: command.payload.placement.parentId,
        }
      : {
          ...(command.payload.placement.parentId ? { from: command.payload.placement.parentId } : {}),
        };

  return {
    id: command.payload.id,
    type: command.payload.nodeType,
    props: {
      ...(command.payload.initialProps ?? {}),
      ...placementProps,
      ...(command.payload.initialContent ? { content: command.payload.initialContent } : {}),
    },
    placement: command.payload.placement,
  };
}

export function buildReparentCommand(input: {
  target: EditTarget;
  previousParentId: string | null;
  nextParentId: string | null;
}): ReparentCommand {
  return {
    type: 'node.reparent',
    target: input.target,
    payload: {
      previous: { parentId: input.previousParentId },
      next: { parentId: input.nextParentId },
    },
  };
}

export function buildZOrderUpdateCommand(input: {
  target: EditTarget;
  previousZIndex: number | null;
  nextZIndex: number | null;
}): ZOrderUpdateCommand {
  return {
    type: 'node.z-order.update',
    target: input.target,
    payload: {
      previous: { zIndex: input.previousZIndex },
      next: { zIndex: input.nextZIndex },
    },
  };
}

export function buildPluginInstanceCreateCommand(input: {
  target: EditTarget;
  plugin: PluginInstanceRef & { pluginExportId: string; pluginVersionId: string };
  payload: PluginInstanceCreatePayload;
}): PluginCommandEnvelope<'plugin-instance.create', PluginInstanceCreatePayload> {
  return {
    type: 'plugin-instance.create',
    target: input.target,
    plugin: input.plugin,
    payload: input.payload,
  };
}

export function buildPluginInstanceUpdatePropsCommand(input: {
  target: EditTarget;
  plugin: PluginInstanceRef;
  payload: PluginInstanceUpdatePropsPayload;
}): PluginCommandEnvelope<'plugin-instance.update-props', PluginInstanceUpdatePropsPayload> {
  return {
    type: 'plugin-instance.update-props',
    target: input.target,
    plugin: input.plugin,
    payload: input.payload,
  };
}

export function buildPluginInstanceUpdateBindingCommand(input: {
  target: EditTarget;
  plugin: PluginInstanceRef;
  payload: PluginInstanceUpdateBindingPayload;
}): PluginCommandEnvelope<'plugin-instance.update-binding', PluginInstanceUpdateBindingPayload> {
  return {
    type: 'plugin-instance.update-binding',
    target: input.target,
    plugin: input.plugin,
    payload: input.payload,
  };
}

export function buildPluginInstanceRemoveCommand(input: {
  target: EditTarget;
  plugin: PluginInstanceRef;
  payload: PluginInstanceRemovePayload;
}): PluginCommandEnvelope<'plugin-instance.remove', PluginInstanceRemovePayload> {
  return {
    type: 'plugin-instance.remove',
    target: input.target,
    plugin: input.plugin,
    payload: input.payload,
  };
}

export function toUpdateNodeProps(command: UpdateCommand): Record<string, unknown> {
  switch (command.type) {
    case 'node.move.relative':
      if (command.payload.carrier === 'gap') {
        return { gap: command.payload.next.gap };
      }
      return {
        at: command.payload.next.at,
      };
    case 'node.content.update':
      return {
        content: command.payload.next.content,
      };
    case 'node.style.update':
      return command.payload.patch;
    case 'node.rename':
      return {
        id: command.payload.next.id,
      };
    default:
      return {};
  }
}

export function getUpdateCommandBeforeSnapshot(command: UpdateCommand): Record<string, unknown> {
  switch (command.type) {
    case 'node.move.relative':
      return command.payload.previous;
    case 'node.content.update':
      return command.payload.previous;
    case 'node.style.update':
      return command.payload.previous;
    case 'node.rename':
      return command.payload.previous;
    default:
      return {};
  }
}

export function getUpdateCommandAfterSnapshot(command: UpdateCommand): Record<string, unknown> {
  switch (command.type) {
    case 'node.move.relative':
      return command.payload.next;
    case 'node.content.update':
      return command.payload.next;
    case 'node.style.update':
      return command.payload.patch;
    case 'node.rename':
      return command.payload.next;
    default:
      return {};
  }
}

export function buildContentDraftPatch(
  nodeType: string | undefined,
  draft: string,
): Record<string, unknown> {
  if (nodeType === 'markdown' || nodeType === 'text' || nodeType === 'sticky') {
    return {
      label: draft,
      children: [{ type: 'graph-markdown', content: draft }],
    };
  }
  return {
    label: draft,
    children: [{ type: 'text', text: draft }],
  };
}
