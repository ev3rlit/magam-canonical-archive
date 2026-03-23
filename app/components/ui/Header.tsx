import React from 'react';
import { useGraphStore } from '@/store/graph';
import { ArrowLeft, Menu, Search as SearchIcon } from 'lucide-react';
import { Button } from './Button';

interface HeaderProps {
  onBack?: () => void;
  onMenu?: () => void;
  canvasTitle?: string | null;
}

export const Header: React.FC<HeaderProps> = ({
  onBack,
  onMenu,
  canvasTitle,
}) => {
  const { isSearchOpen, openSearch, closeSearch } = useGraphStore();

  return (
    <header className="relative z-10 flex h-14 items-center justify-between bg-background/80 px-4 backdrop-blur-glass shadow-[inset_0_-1px_0_rgb(var(--color-border)/0.08)]">
      <div className="flex items-center gap-2">
        <Button
          onClick={onBack}
          size="sm"
          variant="secondary"
          aria-label="Back"
          className="rounded-xl"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </Button>
        <Button
          onClick={onMenu}
          size="sm"
          variant="secondary"
          aria-label="Menu"
          className="rounded-xl"
        >
          <Menu className="w-3.5 h-3.5" />
          <span>Menu</span>
        </Button>
      </div>

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="max-w-[40vw] truncate text-sm font-semibold text-foreground">
          {canvasTitle?.trim() || 'Untitled Canvas'}
        </div>
      </div>

      <div className="flex items-center">
        <Button
          onClick={() => {
            if (isSearchOpen) {
              closeSearch({ clearQuery: true, clearHighlights: true });
              return;
            }

            openSearch();
          }}
          size="sm"
          variant="secondary"
          aria-label="Search"
          title="Search · ⌘K"
          className="rounded-xl"
        >
          <SearchIcon className="w-3.5 h-3.5" />
        </Button>
      </div>
    </header>
  );
};
