'use client';

import React, { useEffect, useRef } from 'react';
import {
  MousePointer2,
  Hand,
  ZoomIn,
  ZoomOut,
  Maximize,
  Bookmark,
  Check,
  Plus,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { FontSelector } from './FontSelector';
import type { CanvasEntrypointCreateMode } from '@/features/canvas-ui-entrypoints/contracts';
import { useGraphStore } from '@/store/graph';
import type { EntrypointInteractionMode } from '@/features/canvas-ui-entrypoints/ui-runtime-state';
import { canvasRuntime } from '@/processes/canvas-runtime/createCanvasRuntime';
import {
  closeToolbarSurface,
  resolveToolbarPresenterState,
  selectToolbarCreateMode,
  selectToolbarInteractionMode,
  selectToolbarPreset,
  shouldCloseToolbarSurface,
  syncToolbarCreateMode,
  syncToolbarInteractionMode,
  toggleToolbarCreateSurface,
  toggleToolbarPresetSurface,
  TOOLBAR_CREATE_ANCHOR_ID,
  TOOLBAR_CREATE_OPTIONS,
  TOOLBAR_PRESET_ANCHOR_ID,
  type ToolbarPresenterWashiPresetOption,
} from '@/processes/canvas-runtime/bindings/toolbarPresenter';

export type InteractionMode = EntrypointInteractionMode;

type WashiPresetOption = ToolbarPresenterWashiPresetOption;

interface FloatingToolbarProps {
  interactionMode: InteractionMode;
  onInteractionModeChange: (mode: InteractionMode) => void;
  createMode: CanvasEntrypointCreateMode;
  onCreateModeChange: (mode: CanvasEntrypointCreateMode) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  washiPresets?: WashiPresetOption[];
  washiPresetEnabled?: boolean;
  activeWashiPresetId?: string | null;
  onSelectWashiPreset?: (presetId: string) => void;
  positioning?: 'canvas' | 'hosted';
  className?: string;
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
  positioning = 'canvas',
  className,
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
  const toolbarSurfaceApi = {
    registerEntrypointAnchor,
    clearEntrypointAnchor,
    openEntrypointSurface,
    closeEntrypointSurface,
  };
  const {
    activeCreateLabel,
    activeWashiPresetLabel,
    canOpenWashiPreset,
    hasPendingEntrypointActions,
    isCreateMenuOpen,
    isWashiPresetMenuOpen,
    resolvedCreateMode,
    resolvedInteractionMode,
  } = resolveToolbarPresenterState({
    runtime: canvasRuntime,
    toolbarSlot: canvasRuntime.slots.canvasToolbar,
    runtimeState: entrypointRuntime,
    interactionMode,
    createMode,
    washiPresets,
    washiPresetEnabled,
    activeWashiPresetId,
  });

  useEffect(() => {
    syncToolbarInteractionMode({
      runtimeInteractionMode: entrypointRuntime.activeTool.interactionMode,
      interactionMode,
      setEntrypointInteractionMode,
    });
  }, [entrypointRuntime.activeTool.interactionMode, interactionMode, setEntrypointInteractionMode]);

  useEffect(() => {
    syncToolbarCreateMode({
      runtimeCreateMode: entrypointRuntime.activeTool.createMode,
      createMode,
      setEntrypointCreateMode,
    });
  }, [createMode, entrypointRuntime.activeTool.createMode, setEntrypointCreateMode]);

  useEffect(() => {
    if (!isWashiPresetMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (shouldCloseToolbarSurface({
        menuElement: presetMenuRef.current,
        target: event.target,
      })) {
        closeToolbarSurface({
          anchorId: TOOLBAR_PRESET_ANCHOR_ID,
          api: toolbarSurfaceApi,
        });
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isWashiPresetMenuOpen, toolbarSurfaceApi]);

  useEffect(() => {
    if (!isCreateMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (shouldCloseToolbarSurface({
        menuElement: createMenuRef.current,
        target: event.target,
      })) {
        closeToolbarSurface({
          anchorId: TOOLBAR_CREATE_ANCHOR_ID,
          api: toolbarSurfaceApi,
        });
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isCreateMenuOpen, toolbarSurfaceApi]);

  return (
    <div
      className={cn(
        'flex items-center gap-1 p-1.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-full shadow-xl',
        positioning === 'canvas' ? 'absolute bottom-8 left-1/2 -translate-x-1/2 z-50' : 'relative',
        className,
      )}
    >
      <ToolbarButton
        active={resolvedInteractionMode === 'pointer'}
        onClick={() => selectToolbarInteractionMode({
          mode: 'pointer',
          setEntrypointInteractionMode,
          onInteractionModeChange,
        })}
        title="Selection Mode (V)"
        icon={<MousePointer2 className="w-4 h-4" />}
      />
      <ToolbarButton
        active={resolvedInteractionMode === 'hand'}
        onClick={() => selectToolbarInteractionMode({
          mode: 'hand',
          setEntrypointInteractionMode,
          onInteractionModeChange,
        })}
        title="Pan Mode (H)"
        icon={<Hand className="w-4 h-4" />}
      />

      <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />

      <div className="relative" ref={createMenuRef}>
        <ToolbarButton
          active={isCreateMenuOpen || resolvedCreateMode !== null}
          disabled={hasPendingEntrypointActions}
          data-floating-toolbar-create-toggle
          onClick={() => toggleToolbarCreateSurface({
            isCreateMenuOpen,
            hasPendingEntrypointActions,
            createMenuElement: createMenuRef.current,
            api: toolbarSurfaceApi,
          })}
          title={activeCreateLabel ? `Create Mode: ${activeCreateLabel}` : 'Open Create Modes'}
          icon={<Plus className="w-4 h-4" />}
        />

        {isCreateMenuOpen && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-12 w-56 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
              Create on pane click
            </div>
            <div className="py-1">
              {TOOLBAR_CREATE_OPTIONS.map((option) => (
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
                    selectToolbarCreateMode({
                      mode: option.id,
                      setEntrypointCreateMode,
                      onCreateModeChange,
                      api: toolbarSurfaceApi,
                    });
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
                selectToolbarCreateMode({
                  mode: null,
                  setEntrypointCreateMode,
                  onCreateModeChange,
                  api: toolbarSurfaceApi,
                });
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
          onClick={() => toggleToolbarPresetSurface({
            canOpenWashiPreset,
            hasPendingEntrypointActions,
            isWashiPresetMenuOpen,
            presetMenuElement: presetMenuRef.current,
            api: toolbarSurfaceApi,
          })}
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
                    selectToolbarPreset({
                      presetId: preset.id,
                      onSelectWashiPreset,
                      api: toolbarSurfaceApi,
                    });
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
