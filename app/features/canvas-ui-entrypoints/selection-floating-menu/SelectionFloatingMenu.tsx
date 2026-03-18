'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { FontFamilyPreset } from '@magam/core';
import { cn } from '@/utils/cn';
import { toFontFamilyCssValue } from '@/utils/fontHierarchy';
import type {
  SelectionFloatingMenuControlId,
  SelectionFloatingMenuPresetOption,
  SelectionFloatingMenuRenderModel,
  SelectionFloatingMenuStylePatchKey,
} from './types';

const FONT_FAMILY_OPTIONS: Array<{ value: FontFamilyPreset; label: string; short: string }> = [
  { value: 'hand-gaegu', label: 'Handwriting (Gaegu)', short: 'Gaegu' },
  { value: 'hand-caveat', label: 'Handwriting (Caveat)', short: 'Caveat' },
  { value: 'sans-inter', label: 'Sans (Inter)', short: 'Inter' },
];

const FONT_SIZE_OPTIONS: Array<{ value: string | number; label: string }> = [
  { value: 's', label: 'S' },
  { value: 'm', label: 'M' },
  { value: 'l', label: 'L' },
  { value: 'xl', label: 'XL' },
];

const COLOR_OPTIONS = [
  '#111827',
  '#2563eb',
  '#7c3aed',
  '#dc2626',
  '#16a34a',
  '#f59e0b',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toPatternPreset(value: string): Record<string, unknown> {
  return {
    type: 'preset',
    id: value,
  };
}

function formatControlValue(controlId: SelectionFloatingMenuControlId, value: unknown): string {
  if (controlId === 'font-family') {
    return FONT_FAMILY_OPTIONS.find((option) => option.value === value)?.short ?? 'Font';
  }
  if (controlId === 'font-size') {
    return typeof value === 'string' || typeof value === 'number' ? String(value).toUpperCase() : 'Size';
  }
  if (controlId === 'bold') {
    return value === true ? 'Bold' : 'B';
  }
  if (controlId === 'object-type') {
    return typeof value === 'string' && value.length > 0 ? value : 'Type';
  }
  if (controlId === 'align') {
    return typeof value === 'string' && value.length > 0 ? value : 'Align';
  }
  return typeof value === 'string' && value.length > 0 ? value : 'Color';
}

interface SelectionFloatingMenuProps {
  model: SelectionFloatingMenuRenderModel;
  washiPresets?: SelectionFloatingMenuPresetOption[];
  onApplyStylePatch?: (input: {
    nodeIds: string[];
    patch: Record<string, unknown>;
    patchKey: SelectionFloatingMenuStylePatchKey;
  }) => Promise<void> | void;
  onCommitContent?: (input: {
    nodeId: string;
    content: string;
  }) => Promise<void> | void;
}

export function SelectionFloatingMenu({
  model,
  washiPresets = [],
  onApplyStylePatch,
  onCommitContent,
}: SelectionFloatingMenuProps) {
  const [openMenu, setOpenMenu] = useState<SelectionFloatingMenuControlId | null>(null);
  const [pendingControlId, setPendingControlId] = useState<SelectionFloatingMenuControlId | null>(null);
  const [contentDraft, setContentDraft] = useState(model.summary.activeTextValue);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setContentDraft(model.summary.activeTextValue);
  }, [model.summary.activeTextValue]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, []);

  const controlsById = useMemo(() => Object.fromEntries(
    model.controls.map((control) => [control.inventory.controlId, control]),
  ), [model.controls]);

  const runStylePatch = async (
    controlId: SelectionFloatingMenuControlId,
    patchKey: SelectionFloatingMenuStylePatchKey | undefined,
    value: unknown,
  ) => {
    if (!patchKey || !onApplyStylePatch) {
      return;
    }

    setPendingControlId(controlId);
    try {
      await Promise.resolve(onApplyStylePatch({
        nodeIds: model.summary.selectedNodeIds,
        patch: {
          [patchKey]: value,
        },
        patchKey,
      }));
      setOpenMenu(null);
    } finally {
      setPendingControlId(null);
    }
  };

  const renderPopover = () => {
    if (!openMenu) {
      return null;
    }

    const control = controlsById[openMenu];
    if (!control) {
      return null;
    }

    if (openMenu === 'font-family' && control.patchKey) {
      return (
        <div className="absolute left-0 top-full mt-2 min-w-56 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-2xl backdrop-blur">
          {FONT_FAMILY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={cn(
                'flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100',
                model.summary.commonValues.fontFamily === option.value ? 'bg-slate-100 font-medium' : undefined,
              )}
              style={{ fontFamily: toFontFamilyCssValue(option.value) }}
              onClick={() => {
                void runStylePatch('font-family', control.patchKey, option.value);
              }}
            >
              <span>{option.label}</span>
              {model.summary.commonValues.fontFamily === option.value ? <span>OK</span> : null}
            </button>
          ))}
        </div>
      );
    }

    if (openMenu === 'font-size' && control.patchKey) {
      return (
        <div className="absolute left-0 top-full mt-2 min-w-40 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-2xl backdrop-blur">
          <div className="grid grid-cols-4 gap-2">
            {FONT_SIZE_OPTIONS.map((option) => (
              <button
                key={String(option.value)}
                type="button"
                className={cn(
                  'rounded-xl border px-3 py-2 text-sm transition-colors',
                  model.summary.commonValues.fontSize === option.value
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-100',
                )}
                onClick={() => {
                  void runStylePatch('font-size', control.patchKey, option.value);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (openMenu === 'color' && control.patchKey) {
      return (
        <div className="absolute left-0 top-full mt-2 min-w-40 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-2xl backdrop-blur">
          <div className="grid grid-cols-3 gap-2">
            {COLOR_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 transition-transform hover:scale-105"
                style={{ backgroundColor: option }}
                onClick={() => {
                  void runStylePatch('color', control.patchKey, option);
                }}
                title={option}
              >
                {model.summary.commonValues.color === option ? (
                  <span className={cn(
                    'text-xs font-semibold',
                    option === '#111827' || option === '#2563eb' || option === '#7c3aed' || option === '#dc2626'
                      ? 'text-white'
                      : 'text-slate-900',
                  )}
                  >
                    OK
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (openMenu === 'more') {
      const contentControl = controlsById.content;
      const presetControl = controlsById['washi-preset'];

      return (
        <div className="absolute right-0 top-full mt-2 flex min-w-72 flex-col gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur">
          {contentControl?.visible ? (
            <form
              className="flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                const nodeId = model.summary.primaryNode?.renderedNodeId;
                if (!nodeId || !contentControl.enabled || !onCommitContent) {
                  return;
                }

                setPendingControlId('content');
                Promise.resolve(onCommitContent({
                  nodeId,
                  content: contentDraft,
                }))
                  .then(() => {
                    setOpenMenu(null);
                  })
                  .finally(() => {
                    setPendingControlId(null);
                  });
              }}
            >
              <label className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Content
              </label>
              <input
                type="text"
                value={contentDraft}
                disabled={!contentControl.enabled || pendingControlId === 'content'}
                onChange={(event) => setContentDraft(event.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400"
              />
              <button
                type="submit"
                disabled={!contentControl.enabled || pendingControlId === 'content'}
                className={cn(
                  'rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                  contentControl.enabled
                    ? 'bg-slate-900 text-white hover:bg-slate-700'
                    : 'cursor-not-allowed bg-slate-100 text-slate-400',
                )}
              >
                Apply content
              </button>
            </form>
          ) : null}

          {presetControl?.visible && presetControl.patchKey === 'pattern' && washiPresets.length > 0 ? (
            <div className="flex flex-col gap-2">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Washi preset
              </div>
              <div className="grid grid-cols-2 gap-2">
                {washiPresets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={cn(
                      'rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                      model.summary.activePresetId === preset.id
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-100',
                    )}
                    onClick={() => {
                      void runStylePatch('washi-preset', 'pattern', toPatternPreset(preset.id));
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      );
    }

    return null;
  };

  if (!model.visible) {
    return null;
  }

  return (
    <div ref={rootRef} className="relative flex items-center gap-1 rounded-[22px] border border-slate-200 bg-white/95 p-1.5 shadow-2xl backdrop-blur">
      {model.primaryControls.map((control) => {
        const isMenuTrigger = control.inventory.controlId === 'font-family'
          || control.inventory.controlId === 'font-size'
          || control.inventory.controlId === 'color'
          || control.inventory.controlId === 'more';
        const disabled = !control.enabled || pendingControlId !== null;
        const isOpen = openMenu === control.inventory.controlId;
        const currentColor = control.inventory.controlId === 'color'
          && typeof control.value === 'string'
          ? control.value
          : null;

        return (
          <button
            key={control.inventory.itemId}
            type="button"
            disabled={disabled}
            title={control.disabledReason ?? control.inventory.label}
            onClick={() => {
              if (control.inventory.controlId === 'bold' && control.patchKey) {
                void runStylePatch('bold', control.patchKey, !(control.value === true));
                return;
              }

              if (isMenuTrigger) {
                setOpenMenu(isOpen ? null : control.inventory.controlId);
              }
            }}
            className={cn(
              'flex min-h-10 items-center gap-2 rounded-2xl px-3 py-2 text-sm transition-colors',
              disabled
                ? 'cursor-not-allowed text-slate-300'
                : isOpen
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-100',
            )}
            data-selection-floating-control={control.inventory.controlId}
          >
            {currentColor ? (
              <span className="h-3 w-3 rounded-full border border-slate-300" style={{ backgroundColor: currentColor }} />
            ) : null}
            <span
              style={control.inventory.controlId === 'font-family' && typeof control.value === 'string'
                ? { fontFamily: toFontFamilyCssValue(control.value as FontFamilyPreset) }
                : undefined}
            >
              {control.inventory.controlId === 'more'
                ? 'More'
                : formatControlValue(control.inventory.controlId, control.value)}
            </span>
          </button>
        );
      })}

      {renderPopover()}
    </div>
  );
}
