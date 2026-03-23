import React from 'react';
import {
  Circle,
  Diamond,
  FileText,
  Minus,
  Square,
  StickyNote,
  Type,
} from 'lucide-react';
import type { GraphCanvasCreateMode } from '@/components/GraphCanvas.drag';
import {
  createEntrypointAnchor,
  createOpenSurfaceDescriptor,
  type EntrypointAnchorSnapshot,
  type EntrypointInteractionMode,
  type EntrypointRuntimeState,
  type OpenSurfaceDescriptor,
} from '@/features/canvas-ui-entrypoints/ui-runtime-state';
import type { ToolbarPresenterBindingContract } from '../types';
import { getCanvasUiCopy } from '@/features/canvas-ui-entrypoints/copy';

const copy = getCanvasUiCopy();

export interface ToolbarPresenterWashiPresetOption {
  id: string;
  label: string;
}

export interface ToolbarCreateOption {
  id: Exclude<GraphCanvasCreateMode, null>;
  label: string;
  icon: React.ReactNode;
}

export interface ToolbarPresenterStateInput extends ToolbarPresenterBindingContract {
  runtimeState: EntrypointRuntimeState;
  interactionMode: EntrypointInteractionMode;
  createMode: GraphCanvasCreateMode;
  washiPresets: ToolbarPresenterWashiPresetOption[];
  washiPresetEnabled: boolean;
  activeWashiPresetId: string | null;
}

export interface ToolbarPresenterSurfaceApi {
  registerEntrypointAnchor: (anchor: EntrypointAnchorSnapshot) => void;
  clearEntrypointAnchor: (anchorId: string) => void;
  openEntrypointSurface: (surface: OpenSurfaceDescriptor) => void;
  closeEntrypointSurface: () => void;
}

export const TOOLBAR_CREATE_SURFACE_KIND = 'toolbar-create-menu';
export const TOOLBAR_PRESET_SURFACE_KIND = 'toolbar-preset-menu';
export const TOOLBAR_CREATE_ANCHOR_ID = 'toolbar:create-anchor';
export const TOOLBAR_PRESET_ANCHOR_ID = 'toolbar:preset-anchor';

export const TOOLBAR_CREATE_OPTIONS: ToolbarCreateOption[] = [
  { id: 'rectangle', label: copy.toolbar.create.rectangle, icon: React.createElement(Square, { className: 'w-4 h-4' }) },
  { id: 'ellipse', label: copy.toolbar.create.ellipse, icon: React.createElement(Circle, { className: 'w-4 h-4' }) },
  { id: 'diamond', label: copy.toolbar.create.diamond, icon: React.createElement(Diamond, { className: 'w-4 h-4' }) },
  { id: 'text', label: copy.toolbar.create.text, icon: React.createElement(Type, { className: 'w-4 h-4' }) },
  { id: 'markdown', label: copy.toolbar.create.markdown, icon: React.createElement(FileText, { className: 'w-4 h-4' }) },
  { id: 'line', label: copy.toolbar.create.line, icon: React.createElement(Minus, { className: 'w-4 h-4' }) },
  { id: 'sticky', label: copy.toolbar.create.sticky, icon: React.createElement(StickyNote, { className: 'w-4 h-4' }) },
];

export function resolveToolbarPresenterState(input: ToolbarPresenterStateInput) {
  const hasPendingEntrypointActions = Object.keys(input.runtimeState.pendingByRequestId).length > 0;
  const resolvedInteractionMode = input.runtimeState.activeTool.interactionMode ?? input.interactionMode;
  const resolvedCreateMode = input.runtimeState.activeTool.createMode ?? input.createMode;
  const isCreateMenuOpen = input.runtimeState.openSurface?.kind === TOOLBAR_CREATE_SURFACE_KIND;
  const isWashiPresetMenuOpen = input.runtimeState.openSurface?.kind === TOOLBAR_PRESET_SURFACE_KIND;
  const canOpenWashiPreset = input.washiPresetEnabled && input.washiPresets.length > 0;
  const activeWashiPresetLabel = input.washiPresets.find(
    (preset) => preset.id === input.activeWashiPresetId,
  )?.label ?? null;
  const activeCreateLabel = TOOLBAR_CREATE_OPTIONS.find(
    (option) => option.id === resolvedCreateMode,
  )?.label ?? null;

  return {
    activeCreateLabel,
    activeWashiPresetLabel,
    canOpenWashiPreset,
    hasPendingEntrypointActions,
    isCreateMenuOpen,
    isWashiPresetMenuOpen,
    resolvedCreateMode,
    resolvedInteractionMode,
  };
}

export function resolveToolbarTriggerAnchor(input: {
  anchorId: string;
  ownerId: string;
  element: HTMLElement | null;
}) {
  const rect = input.element?.getBoundingClientRect();

  return createEntrypointAnchor({
    anchorId: input.anchorId,
    kind: 'toolbar-trigger',
    ownerId: input.ownerId,
    ...(rect
      ? {
          screen: {
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
          },
        }
      : {}),
  });
}

export function syncToolbarInteractionMode(input: {
  runtimeInteractionMode: EntrypointRuntimeState['activeTool']['interactionMode'];
  interactionMode: EntrypointInteractionMode;
  setEntrypointInteractionMode: (mode: EntrypointInteractionMode) => void;
}) {
  if (input.runtimeInteractionMode !== input.interactionMode) {
    input.setEntrypointInteractionMode(input.interactionMode);
  }
}

export function syncToolbarCreateMode(input: {
  runtimeCreateMode: EntrypointRuntimeState['activeTool']['createMode'];
  createMode: GraphCanvasCreateMode;
  setEntrypointCreateMode: (mode: GraphCanvasCreateMode) => void;
}) {
  if (input.runtimeCreateMode !== input.createMode) {
    input.setEntrypointCreateMode(input.createMode);
  }
}

export function shouldCloseToolbarSurface(input: {
  menuElement: HTMLElement | null;
  target: EventTarget | null;
}) {
  if (!input.menuElement || !input.target) {
    return false;
  }

  return !input.menuElement.contains(input.target as Node);
}

export function closeToolbarSurface(input: {
  anchorId: string;
  api: Pick<ToolbarPresenterSurfaceApi, 'clearEntrypointAnchor' | 'closeEntrypointSurface'>;
}) {
  input.api.clearEntrypointAnchor(input.anchorId);
  input.api.closeEntrypointSurface();
}

export function toggleToolbarCreateSurface(input: {
  isCreateMenuOpen: boolean;
  hasPendingEntrypointActions: boolean;
  createMenuElement: HTMLElement | null;
  api: ToolbarPresenterSurfaceApi;
}) {
  if (input.hasPendingEntrypointActions) {
    return;
  }

  if (input.isCreateMenuOpen) {
    closeToolbarSurface({
      anchorId: TOOLBAR_CREATE_ANCHOR_ID,
      api: input.api,
    });
    return;
  }

  input.api.registerEntrypointAnchor(resolveToolbarTriggerAnchor({
    anchorId: TOOLBAR_CREATE_ANCHOR_ID,
    ownerId: TOOLBAR_CREATE_SURFACE_KIND,
    element: input.createMenuElement,
  }));
  input.api.openEntrypointSurface(createOpenSurfaceDescriptor({
    kind: TOOLBAR_CREATE_SURFACE_KIND,
    anchorId: TOOLBAR_CREATE_ANCHOR_ID,
    ownerId: TOOLBAR_CREATE_SURFACE_KIND,
    dismissOnSelectionChange: false,
    dismissOnViewportChange: false,
  }));
}

export function toggleToolbarPresetSurface(input: {
  canOpenWashiPreset: boolean;
  hasPendingEntrypointActions: boolean;
  isWashiPresetMenuOpen: boolean;
  presetMenuElement: HTMLElement | null;
  api: ToolbarPresenterSurfaceApi;
}) {
  if (!input.canOpenWashiPreset || input.hasPendingEntrypointActions) {
    return;
  }

  if (input.isWashiPresetMenuOpen) {
    closeToolbarSurface({
      anchorId: TOOLBAR_PRESET_ANCHOR_ID,
      api: input.api,
    });
    return;
  }

  input.api.registerEntrypointAnchor(resolveToolbarTriggerAnchor({
    anchorId: TOOLBAR_PRESET_ANCHOR_ID,
    ownerId: TOOLBAR_PRESET_SURFACE_KIND,
    element: input.presetMenuElement,
  }));
  input.api.openEntrypointSurface(createOpenSurfaceDescriptor({
    kind: TOOLBAR_PRESET_SURFACE_KIND,
    anchorId: TOOLBAR_PRESET_ANCHOR_ID,
    ownerId: TOOLBAR_PRESET_SURFACE_KIND,
    dismissOnSelectionChange: false,
    dismissOnViewportChange: false,
  }));
}

export function selectToolbarInteractionMode(input: {
  mode: EntrypointInteractionMode;
  setEntrypointInteractionMode: (mode: EntrypointInteractionMode) => void;
  onInteractionModeChange: (mode: EntrypointInteractionMode) => void;
}) {
  input.setEntrypointInteractionMode(input.mode);
  input.onInteractionModeChange(input.mode);
}

export function selectToolbarCreateMode(input: {
  mode: GraphCanvasCreateMode;
  setEntrypointCreateMode: (mode: GraphCanvasCreateMode) => void;
  onCreateModeChange: (mode: GraphCanvasCreateMode) => void;
  api: Pick<ToolbarPresenterSurfaceApi, 'clearEntrypointAnchor' | 'closeEntrypointSurface'>;
}) {
  input.setEntrypointCreateMode(input.mode);
  input.onCreateModeChange(input.mode);
  closeToolbarSurface({
    anchorId: TOOLBAR_CREATE_ANCHOR_ID,
    api: input.api,
  });
}

export function selectToolbarPreset(input: {
  presetId: string;
  onSelectWashiPreset?: (presetId: string) => void;
  api: Pick<ToolbarPresenterSurfaceApi, 'clearEntrypointAnchor' | 'closeEntrypointSurface'>;
}) {
  input.onSelectWashiPreset?.(input.presetId);
  closeToolbarSurface({
    anchorId: TOOLBAR_PRESET_ANCHOR_ID,
    api: input.api,
  });
}
