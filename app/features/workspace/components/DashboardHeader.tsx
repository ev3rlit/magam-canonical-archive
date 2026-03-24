import React from 'react';
import { cn } from '@/utils/cn';
import { Search, Plus, LayoutGrid, LayoutList } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { getWorkspaceCopy } from '../copy';

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  onAddAction: () => void;
  addLabel: string;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
}

export function DashboardHeader({
  title,
  subtitle,
  viewMode,
  onViewModeChange,
  onAddAction,
  addLabel,
  searchTerm,
  onSearchChange,
}: DashboardHeaderProps) {
  const copy = getWorkspaceCopy();
  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-center justify-between pb-6">
      <div>
        <h1 className="font-manrope font-bold text-headline-md text-on-surface">{title}</h1>
        {subtitle && (
          <p className="font-inter text-label-md text-on-surface-variant mt-2">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative group flex-1 md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={16} />
          <input
            type="text"
            placeholder={copy.shared.searchPlaceholder}
            value={searchTerm ?? ''}
            onChange={e => onSearchChange?.(e.target.value)}
            className="w-full bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant text-sm font-inter rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-[inset_0_2px_4px_rgba(44,47,48,0.02)]"
          />
        </div>

        <div className="flex bg-surface-container-low p-1 rounded-xl">
          <button
            onClick={() => onViewModeChange('grid')}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              viewMode === 'grid' ? 'bg-surface-container-highest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
            )}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              viewMode === 'list' ? 'bg-surface-container-highest text-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
            )}
          >
            <LayoutList size={16} />
          </button>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={onAddAction}
          className="rounded-xl shadow-[0_4px_16px_rgba(44,47,48,0.06)] px-4"
        >
          <Plus size={16} className="mr-2" />
          {addLabel}
        </Button>
      </div>
    </div>
  );
}
