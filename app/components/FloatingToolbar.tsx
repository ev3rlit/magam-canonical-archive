'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
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

export type InteractionMode = 'pointer' | 'hand';

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
  const [isWashiPresetMenuOpen, setIsWashiPresetMenuOpen] = useState(false);
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const presetMenuRef = useRef<HTMLDivElement>(null);
  const createMenuRef = useRef<HTMLDivElement>(null);
  const canOpenWashiPreset = washiPresetEnabled && washiPresets.length > 0;
  const activeWashiPresetLabel = useMemo(
    () => washiPresets.find((preset) => preset.id === activeWashiPresetId)?.label ?? null,
    [activeWashiPresetId, washiPresets],
  );

  useEffect(() => {
    if (!isWashiPresetMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!presetMenuRef.current || !event.target) {
        return;
      }
      if (!presetMenuRef.current.contains(event.target as Node)) {
        setIsWashiPresetMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isWashiPresetMenuOpen]);

  useEffect(() => {
    if (!isCreateMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!createMenuRef.current || !event.target) {
        return;
      }
      if (!createMenuRef.current.contains(event.target as Node)) {
        setIsCreateMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isCreateMenuOpen]);

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
  const activeCreateLabel = createOptions.find((option) => option.id === createMode)?.label ?? null;

  return (
    <div
      className={cn(
        'flex items-center gap-1 p-1.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-full shadow-xl',
        positioning === 'canvas' ? 'absolute bottom-8 left-1/2 -translate-x-1/2 z-50' : 'relative',
        className,
      )}
    >
      <ToolbarButton
        active={interactionMode === 'pointer'}
        onClick={() => onInteractionModeChange('pointer')}
        title="Selection Mode (V)"
        icon={<MousePointer2 className="w-4 h-4" />}
      />
      <ToolbarButton
        active={interactionMode === 'hand'}
        onClick={() => onInteractionModeChange('hand')}
        title="Pan Mode (H)"
        icon={<Hand className="w-4 h-4" />}
      />

      <div className="w-px h-4 bg-slate-300 dark:bg-slate-700 mx-1" />

      <div className="relative" ref={createMenuRef}>
        <ToolbarButton
          active={isCreateMenuOpen || createMode !== null}
          onClick={() => setIsCreateMenuOpen((prev) => !prev)}
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
                    createMode === option.id
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'text-slate-700 dark:text-slate-200',
                  )}
                  onClick={() => {
                    onCreateModeChange(option.id);
                    setIsCreateMenuOpen(false);
                  }}
                >
                  <span className="flex items-center gap-2">
                    {option.icon}
                    {option.label}
                  </span>
                  {createMode === option.id && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="w-full border-t border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-xs text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              onClick={() => {
                onCreateModeChange(null);
                setIsCreateMenuOpen(false);
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
          disabled={!canOpenWashiPreset}
          onClick={() => setIsWashiPresetMenuOpen((prev) => !prev)}
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
                    setIsWashiPresetMenuOpen(false);
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
