'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Pencil, Type } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useGraphStore } from '@/store/graph';
import type { FontFamilyPreset } from '@magam/core';
import { toFontFamilyCssValue } from '@/utils/fontHierarchy';

const options: Array<{
  value: FontFamilyPreset;
  label: string;
  short: string;
}> = [
  { value: 'hand-gaegu', label: 'Handwriting (Gaegu)', short: 'Gaegu' },
  { value: 'hand-caveat', label: 'Handwriting (Caveat)', short: 'Caveat' },
  { value: 'sans-inter', label: 'Sans (Inter)', short: 'Inter' },
];

export const FontSelector: React.FC = () => {
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
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        title="Global Font Family"
        className={cn(
          'p-2 rounded-md transition-all duration-200',
          'hover:bg-slate-100 dark:hover:bg-slate-800',
          isOpen
            ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400'
            : 'text-slate-500 dark:text-slate-400',
        )}
      >
        <Pencil className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-56 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-2 space-y-1">
          {options.map((option) => {
            const active = option.value === globalFontFamily;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setGlobalFontFamily(option.value);
                  setIsOpen(false);
                }}
                title={option.label}
                className={cn(
                  'w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors',
                  active
                    ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800',
                )}
              >
                <span
                  className="truncate text-left"
                  style={{ fontFamily: toFontFamilyCssValue(option.value) }}
                >
                  {option.label}
                </span>
                {active ? <Type className="w-3.5 h-3.5 shrink-0" /> : null}
              </button>
            );
          })}

          <div className="pt-1 px-1 text-[10px] text-slate-400">
            Current: {options.find((option) => option.value === globalFontFamily)?.short ?? 'Gaegu'}
          </div>
        </div>
      )}
    </div>
  );
};
