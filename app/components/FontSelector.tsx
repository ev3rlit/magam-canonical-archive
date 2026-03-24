'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Pencil, Type } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useGraphStore } from '@/store/graph';
import type { FontFamilyPreset } from '@magam/core';
import { toFontFamilyCssValue } from '@/utils/fontHierarchy';
import { getUiCopy } from '@/components/ui/copy';
import { Menu, MenuItem } from './ui/Menu';
import { ToolbarButton } from './ui/Toolbar';

export const FontSelector: React.FC = () => {
  const copy = getUiCopy().fontSelector;
  const options: Array<{
    value: FontFamilyPreset;
    label: string;
    short: string;
  }> = [
    { value: 'hand-gaegu', label: copy.options.handGaegu, short: copy.short.handGaegu },
    { value: 'hand-caveat', label: copy.options.handCaveat, short: copy.short.handCaveat },
    { value: 'sans-inter', label: copy.options.sansInter, short: copy.short.sansInter },
  ];
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const globalFontFamily = useGraphStore((state) => state.globalFontFamily);
  const setGlobalFontFamily = useGraphStore((state) => state.setGlobalFontFamily);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={ref}>
      <ToolbarButton
        onClick={() => setIsOpen((prev) => !prev)}
        title={copy.title}
        active={isOpen}
      >
        <Pencil className="w-4 h-4" />
      </ToolbarButton>

      {isOpen && (
        <Menu className="absolute bottom-full left-1/2 mb-2 w-56 -translate-x-1/2 space-y-1">
          {options.map((option) => {
            const active = option.value === globalFontFamily;
            return (
              <MenuItem
                key={option.value}
                active={active}
                onClick={() => {
                  setGlobalFontFamily(option.value);
                  setIsOpen(false);
                }}
                title={option.label}
                className="justify-between text-xs"
              >
                <span
                  className="truncate text-left"
                  style={{ fontFamily: toFontFamilyCssValue(option.value) }}
                >
                  {option.label}
                </span>
                {active ? <Type className="w-3.5 h-3.5 shrink-0" /> : null}
              </MenuItem>
            );
          })}

          <div className="px-1 pt-1 text-[10px] text-foreground/44">
            {copy.currentPrefix}: {options.find((option) => option.value === globalFontFamily)?.short ?? copy.short.handGaegu}
          </div>
        </Menu>
      )}
    </div>
  );
};
