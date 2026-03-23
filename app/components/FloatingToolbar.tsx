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
import { Menu, MenuItem, MenuLabel } from './ui/Menu';
import {
  Toolbar as ToolbarSurface,
  ToolbarButton as PrimitiveToolbarButton,
  ToolbarDivider,
} from './ui/Toolbar';

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
  const shouldRenderWashiPresetToggle = (
    washiPresets.length > 0
    || washiPresetEnabled
    || activeWashiPresetId !== null
  );

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
    <ToolbarSurface
      className={cn(
        positioning === 'canvas' ? 'absolute bottom-8 left-1/2 -translate-x-1/2 z-50' : 'relative',
        className,
      )}
    >
      <PrimitiveToolbarButton
        active={resolvedInteractionMode === 'pointer'}
        onClick={() => selectToolbarInteractionMode({
          mode: 'pointer',
          setEntrypointInteractionMode,
          onInteractionModeChange,
        })}
        title="Selection Mode (V)"
      >
        <MousePointer2 className="w-4 h-4" />
      </PrimitiveToolbarButton>
      <PrimitiveToolbarButton
        active={resolvedInteractionMode === 'hand'}
        onClick={() => selectToolbarInteractionMode({
          mode: 'hand',
          setEntrypointInteractionMode,
          onInteractionModeChange,
        })}
        title="Pan Mode (H)"
      >
        <Hand className="w-4 h-4" />
      </PrimitiveToolbarButton>

      <ToolbarDivider />

      <div className="relative" ref={createMenuRef}>
        <PrimitiveToolbarButton
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
        >
          <Plus className="w-4 h-4" />
        </PrimitiveToolbarButton>

        {isCreateMenuOpen && (
          <Menu className="absolute bottom-12 left-1/2 w-56 -translate-x-1/2 overflow-hidden">
            <MenuLabel>
              Create on pane click
            </MenuLabel>
            <div className="space-y-1 pb-1">
              {TOOLBAR_CREATE_OPTIONS.map((option) => (
                <MenuItem
                  key={option.id}
                  active={resolvedCreateMode === option.id}
                  className="justify-between gap-2"
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
                </MenuItem>
              ))}
            </div>
            <MenuItem
              className="text-xs text-foreground/56"
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
            </MenuItem>
          </Menu>
        )}
      </div>

      {shouldRenderWashiPresetToggle ? (
        <>
          <ToolbarDivider />

          <div className="relative" ref={presetMenuRef}>
            <PrimitiveToolbarButton
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
              className={!canOpenWashiPreset ? 'opacity-40 cursor-not-allowed' : undefined}
            >
              <Bookmark className="w-4 h-4" />
            </PrimitiveToolbarButton>

            {isWashiPresetMenuOpen && (
              <Menu className="absolute bottom-12 left-1/2 w-60 -translate-x-1/2 overflow-hidden">
                <MenuLabel>
                  PresetPattern Catalog
                </MenuLabel>
                <div className="max-h-56 space-y-1 overflow-y-auto pb-1">
                  {washiPresets.map((preset) => (
                    <MenuItem
                      key={preset.id}
                      active={preset.id === activeWashiPresetId}
                      className="justify-between"
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
                        <span className="ml-1 text-xs text-foreground/42">({preset.id})</span>
                      </span>
                      {preset.id === activeWashiPresetId && (
                        <Check className="w-3.5 h-3.5 shrink-0" />
                      )}
                    </MenuItem>
                  ))}
                </div>
                {activeWashiPresetLabel && (
                  <div className="px-3 py-2 text-xs text-foreground/52 truncate">
                    Active: {activeWashiPresetLabel}
                  </div>
                )}
              </Menu>
            )}
          </div>
        </>
      ) : null}

      <ToolbarDivider />

      <PrimitiveToolbarButton
        onClick={onZoomIn}
        title="Zoom In (+)"
      >
        <ZoomIn className="w-4 h-4" />
      </PrimitiveToolbarButton>
      <PrimitiveToolbarButton
        onClick={onZoomOut}
        title="Zoom Out (-)"
      >
        <ZoomOut className="w-4 h-4" />
      </PrimitiveToolbarButton>
      <PrimitiveToolbarButton
        onClick={onFitView}
        title="Fit View (Space)"
      >
        <Maximize className="w-4 h-4" />
      </PrimitiveToolbarButton>

      <ToolbarDivider />

      <FontSelector />
    </ToolbarSurface>
  );
};
