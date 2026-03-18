'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import {
  FileText,
  MousePointer2,
  Hand,
  ZoomIn,
  ZoomOut,
  Maximize,
  Bookmark,
  Check,
  Plus,
  Square,
  Sticker,
  Ticket,
  Type,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { FontSelector } from './FontSelector';
import type { GraphCanvasCreateMode } from './GraphCanvas.drag';
import {
  createEntrypointAnchor,
  createOpenSurfaceDescriptor,
  type EntrypointInteractionMode,
} from '@/features/canvas-ui-entrypoints/ui-runtime-state';
import { useGraphStore } from '@/store/graph';

export type InteractionMode = EntrypointInteractionMode;

interface WashiPresetOption {
  id: string;
  label: string;
}

interface FloatingToolbarProps {
  interactionMode: InteractionMode;
  onInteractionModeChange: (mode: InteractionMode) => void;
  createMode: GraphCanvasCreateMode;
  onCreateModeChange: (mode: GraphCanvasCreateMode) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  washiPresets?: WashiPresetOption[];
  washiPresetEnabled?: boolean;
  activeWashiPresetId?: string | null;
  onSelectWashiPreset?: (presetId: string) => void;
}

const TOOLBAR_CREATE_SURFACE_KIND = 'toolbar-create-menu';
const TOOLBAR_PRESET_SURFACE_KIND = 'toolbar-preset-menu';
const TOOLBAR_CREATE_ANCHOR_ID = 'toolbar:create-anchor';
const TOOLBAR_PRESET_ANCHOR_ID = 'toolbar:preset-anchor';

export function resolveToolbarAnchor(input: {
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

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  interactionMode,
  onInteractionModeChange,
  createMode,
  onCreateModeChange,
  onZoomIn,
  onZoomOut,
  onFitView,
  washiPresets = [],
  washiPresetEnabled = false,
  activeWashiPresetId = null,
  onSelectWashiPreset,
}) => {
  const entrypointRuntime = useGraphStore((store) => store.entrypointRuntime);
  const setEntrypointInteractionMode = useGraphStore((store) => store.setEntrypointInteractionMode);
  const setEntrypointCreateMode = useGraphStore((store) => store.setEntrypointCreateMode);
  const registerEntrypointAnchor = useGraphStore((store) => store.registerEntrypointAnchor);
  const clearEntrypointAnchor = useGraphStore((store) => store.clearEntrypointAnchor);
  const openEntrypointSurface = useGraphStore((store) => store.openEntrypointSurface);
  const closeEntrypointSurface = useGraphStore((store) => store.closeEntrypointSurface);

  const presetMenuRef = useRef<HTMLDivElement>(null);
  const createMenuRef = useRef<HTMLDivElement>(null);

  const hasPendingEntrypointActions = Object.keys(entrypointRuntime.pendingByRequestId).length > 0;
  const resolvedInteractionMode = entrypointRuntime.activeTool.interactionMode ?? interactionMode;
  const resolvedCreateMode = entrypointRuntime.activeTool.createMode ?? createMode;
  const isCreateMenuOpen = entrypointRuntime.openSurface?.kind === TOOLBAR_CREATE_SURFACE_KIND;
  const isWashiPresetMenuOpen = entrypointRuntime.openSurface?.kind === TOOLBAR_PRESET_SURFACE_KIND;
  const canOpenWashiPreset = washiPresetEnabled && washiPresets.length > 0;
  const activeWashiPresetLabel = useMemo(
    () => washiPresets.find((preset) => preset.id === activeWashiPresetId)?.label ?? null,
    [activeWashiPresetId, washiPresets],
  );

  useEffect(() => {
    if (entrypointRuntime.activeTool.interactionMode !== interactionMode) {
      setEntrypointInteractionMode(interactionMode);
    }
  }, [entrypointRuntime.activeTool.interactionMode, interactionMode, setEntrypointInteractionMode]);

  useEffect(() => {
    if (entrypointRuntime.activeTool.createMode !== createMode) {
      setEntrypointCreateMode(createMode);
    }
  }, [createMode, entrypointRuntime.activeTool.createMode, setEntrypointCreateMode]);

  useEffect(() => {
    if (!isWashiPresetMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!presetMenuRef.current || !event.target) {
        return;
      }
      if (!presetMenuRef.current.contains(event.target as Node)) {
        clearEntrypointAnchor(TOOLBAR_PRESET_ANCHOR_ID);
        closeEntrypointSurface();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [clearEntrypointAnchor, closeEntrypointSurface, isWashiPresetMenuOpen]);

  useEffect(() => {
    if (!isCreateMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!createMenuRef.current || !event.target) {
        return;
      }
      if (!createMenuRef.current.contains(event.target as Node)) {
        clearEntrypointAnchor(TOOLBAR_CREATE_ANCHOR_ID);
        closeEntrypointSurface();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [clearEntrypointAnchor, closeEntrypointSurface, isCreateMenuOpen]);

  const createOptions: Array<{
    id: Exclude<GraphCanvasCreateMode, null>;
    label: string;
    icon: React.ReactNode;
  }> = [
    { id: 'shape', label: 'Shape', icon: <Square className="w-4 h-4" /> },
    { id: 'text', label: 'Text', icon: <Type className="w-4 h-4" /> },
    { id: 'markdown', label: 'Markdown', icon: <FileText className="w-4 h-4" /> },
    { id: 'sticker', label: 'Sticker', icon: <Sticker className="w-4 h-4" /> },
    { id: 'washi-tape', label: 'Washi', icon: <Ticket className="w-4 h-4" /> },
  ];
  const activeCreateLabel = createOptions.find((option) => option.id === resolvedCreateMode)?.label ?? null;

  const toggleCreateMenu = () => {
    if (hasPendingEntrypointActions) {
      return;
    }

    if (isCreateMenuOpen) {
      clearEntrypointAnchor(TOOLBAR_CREATE_ANCHOR_ID);
      closeEntrypointSurface();
      return;
    }

    registerEntrypointAnchor(resolveToolbarAnchor({
      anchorId: TOOLBAR_CREATE_ANCHOR_ID,
      ownerId: TOOLBAR_CREATE_SURFACE_KIND,
      element: createMenuRef.current,
    }));
    openEntrypointSurface(createOpenSurfaceDescriptor({
      kind: TOOLBAR_CREATE_SURFACE_KIND,
      anchorId: TOOLBAR_CREATE_ANCHOR_ID,
      ownerId: TOOLBAR_CREATE_SURFACE_KIND,
      dismissOnSelectionChange: false,
      dismissOnViewportChange: false,
    }));
  };

  const togglePresetMenu = () => {
    if (!canOpenWashiPreset || hasPendingEntrypointActions) {
      return;
    }

    if (isWashiPresetMenuOpen) {
      clearEntrypointAnchor(TOOLBAR_PRESET_ANCHOR_ID);
      closeEntrypointSurface();
      return;
    }

    registerEntrypointAnchor(resolveToolbarAnchor({
      anchorId: TOOLBAR_PRESET_ANCHOR_ID,
      ownerId: TOOLBAR_PRESET_SURFACE_KIND,
      element: presetMenuRef.current,
    }));
    openEntrypointSurface(createOpenSurfaceDescriptor({
      kind: TOOLBAR_PRESET_SURFACE_KIND,
      anchorId: TOOLBAR_PRESET_ANCHOR_ID,
      ownerId: TOOLBAR_PRESET_SURFACE_KIND,
      dismissOnSelectionChange: false,
      dismissOnViewportChange: false,
    }));
  };

  const closeCreateSurface = () => {
    clearEntrypointAnchor(TOOLBAR_CREATE_ANCHOR_ID);
    closeEntrypointSurface();
  };

  const closePresetSurface = () => {
    clearEntrypointAnchor(TOOLBAR_PRESET_ANCHOR_ID);
    closeEntrypointSurface();
  };

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 p-1.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-full shadow-xl">
      <ToolbarButton
        active={resolvedInteractionMode === 'pointer'}
        onClick={() => {
          setEntrypointInteractionMode('pointer');
          onInteractionModeChange('pointer');
        }}
        title="Selection Mode (V)"
        icon={<MousePointer2 className="w-4 h-4" />}
      />
      <ToolbarButton
        active={resolvedInteractionMode === 'hand'}
        onClick={() => {
          setEntrypointInteractionMode('hand');
          onInteractionModeChange('hand');
        }}
        title="Pan Mode (H)"
        icon={<Hand className="w-4 h-4" />}
      />

      <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />

      <div className="relative" ref={createMenuRef}>
        <ToolbarButton
          active={isCreateMenuOpen || resolvedCreateMode !== null}
          disabled={hasPendingEntrypointActions}
          data-floating-toolbar-create-toggle
          onClick={toggleCreateMenu}
          title={activeCreateLabel ? `Create Mode: ${activeCreateLabel}` : 'Open Create Modes'}
          icon={<Plus className="w-4 h-4" />}
        />

        {isCreateMenuOpen && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-12 w-56 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
              Create on pane click
            </div>
            <div className="py-1">
              {createOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={cn(
                    'w-full px-3 py-2 text-left text-sm flex items-center justify-between gap-2',
                    'hover:bg-slate-100 dark:hover:bg-slate-800/80',
                    resolvedCreateMode === option.id
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'text-slate-700 dark:text-slate-200',
                  )}
                  onClick={() => {
                    setEntrypointCreateMode(option.id);
                    onCreateModeChange(option.id);
                    closeCreateSurface();
                  }}
                >
                  <span className="flex items-center gap-2">
                    {option.icon}
                    {option.label}
                  </span>
                  {resolvedCreateMode === option.id && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="w-full border-t border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-xs text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              onClick={() => {
                setEntrypointCreateMode(null);
                onCreateModeChange(null);
                closeCreateSurface();
              }}
            >
              Create mode off
            </button>
          </div>
        )}
      </div>

      <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />

      <div className="relative" ref={presetMenuRef}>
        <ToolbarButton
          active={isWashiPresetMenuOpen}
          disabled={!canOpenWashiPreset || hasPendingEntrypointActions}
          data-floating-toolbar-preset-toggle
          onClick={togglePresetMenu}
          title={
            canOpenWashiPreset
              ? 'Washi Preset Catalog'
              : 'Select a Washi Tape node to open preset catalog'
          }
          icon={<Bookmark className="w-4 h-4" />}
          className={!canOpenWashiPreset ? 'opacity-40 cursor-not-allowed' : undefined}
        />

        {isWashiPresetMenuOpen && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-12 w-60 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
              PresetPattern Catalog
            </div>
            <div className="max-h-56 overflow-y-auto py-1">
              {washiPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={cn(
                    'w-full px-3 py-2 text-left text-sm flex items-center justify-between',
                    'hover:bg-slate-100 dark:hover:bg-slate-800/80',
                    preset.id === activeWashiPresetId
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'text-slate-700 dark:text-slate-200',
                  )}
                  data-washi-preset-id={preset.id}
                  onClick={() => {
                    onSelectWashiPreset?.(preset.id);
                    closePresetSurface();
                  }}
                >
                  <span className="truncate">
                    {preset.label}
                    <span className="ml-1 text-xs text-slate-500">({preset.id})</span>
                  </span>
                  {preset.id === activeWashiPresetId && (
                    <Check className="w-3.5 h-3.5 shrink-0" />
                  )}
                </button>
              ))}
            </div>
            {activeWashiPresetLabel && (
              <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 truncate">
                Active: {activeWashiPresetLabel}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />

      <ToolbarButton
        onClick={onZoomIn}
        title="Zoom In (+)"
        icon={<ZoomIn className="w-4 h-4" />}
      />
      <ToolbarButton
        onClick={onZoomOut}
        title="Zoom Out (-)"
        icon={<ZoomOut className="w-4 h-4" />}
      />
      <ToolbarButton
        onClick={onFitView}
        title="Fit View (Space)"
        icon={<Maximize className="w-4 h-4" />}
      />

      <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />

      <FontSelector />
    </div>
  );
};

interface ToolbarButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  icon: React.ReactNode;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({ active, icon, className, ...props }) => {
  return (
    <button
      type="button"
      className={cn(
        'p-2 rounded-md transition-all duration-200',
        'hover:bg-slate-100 dark:hover:bg-slate-800',
        active
          ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
          : 'text-slate-500 dark:text-slate-400',
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  );
};
