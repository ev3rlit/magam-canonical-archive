'use client';

import React from 'react';
import { MonitorCog, MoonStar, SunMedium } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useTheme } from '@/features/theme/provider';
import type { ThemeMode } from '@/features/theme/runtime';

const OPTIONS: Array<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: ThemeMode;
}> = [
  { icon: SunMedium, label: 'Light', value: 'light' },
  { icon: MoonStar, label: 'Dark', value: 'dark' },
  { icon: MonitorCog, label: 'System', value: 'system' },
];

export function ThemeModeToggle() {
  const { mode, setMode } = useTheme();

  return (
    <div className="inline-flex items-center gap-1 rounded-pill bg-card/88 p-1 text-foreground shadow-raised shadow-[inset_0_0_0_1px_rgb(var(--color-border)/0.12)] backdrop-blur-glass">
      {OPTIONS.map((option) => {
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
            title={`Use ${option.label} theme`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
