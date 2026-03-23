'use client';

import React from 'react';
import { MonitorCog, MoonStar, SunMedium } from 'lucide-react';
import { cn } from '@/utils/cn';
import { getUiCopy } from '@/components/ui/copy';
import { useTheme } from '@/features/theme/provider';
import type { ThemeMode } from '@/features/theme/runtime';

export function ThemeModeToggle() {
  const copy = getUiCopy().themeMode;
  const options: Array<{
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: ThemeMode;
  }> = [
    { icon: SunMedium, label: copy.light, value: 'light' },
    { icon: MoonStar, label: copy.dark, value: 'dark' },
    { icon: MonitorCog, label: copy.system, value: 'system' },
  ];
  const { mode, setMode } = useTheme();

  return (
    <div className="inline-flex items-center gap-1 rounded-pill bg-card/88 p-1 text-foreground shadow-raised shadow-[inset_0_0_0_1px_rgb(var(--color-border)/0.12)] backdrop-blur-glass">
      {options.map((option) => {
        const Icon = option.icon;
        const isActive = mode === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setMode(option.value)}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-pill px-2.5 text-[11px] font-medium',
              'transition-[background-color,color,box-shadow] duration-fast',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-card',
              isActive
                ? 'bg-primary/12 text-primary shadow-[0_0_0_1px_rgb(var(--color-primary)/0.18)]'
                : 'text-foreground/58 hover:bg-card hover:text-foreground',
            )}
            aria-pressed={isActive}
            title={copy.useTheme(option.label)}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
