import React from 'react';
import { useGraphStore } from '@/store/graph';
import {
  Plus,
  Search as SearchIcon,
} from 'lucide-react';
import { Button } from './Button';

interface HeaderProps {
  onCreateDocument?: () => void;
  workspaceLabel?: string | null;
}

export const Header: React.FC<HeaderProps> = ({
  onCreateDocument,
  workspaceLabel: workspaceLabelOverride,
}) => {
  const { status, currentFile, isSearchOpen, openSearch, closeSearch } = useGraphStore();
  void status;
  const workspaceLabel = workspaceLabelOverride || 'workspace';
  const currentDocumentLabel = currentFile ? currentFile.split('/').at(-1) ?? currentFile : null;

  return (
    <header className="relative z-10 flex h-14 items-center justify-between bg-background/80 px-4 backdrop-blur-glass shadow-[inset_0_-1px_0_rgb(var(--color-border)/0.08)]">
      <div className="w-28 shrink-0" />

      <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 xl:block">
        {currentFile ? (
          <div className="flex items-center gap-2 rounded-pill bg-card/78 px-3 py-1.5 text-sm shadow-raised shadow-[inset_0_0_0_1px_rgb(var(--color-border)/0.10)] backdrop-blur-glass">
            <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-foreground/50">Workspace</span>
            <span className="text-sm text-foreground/68">{workspaceLabel}</span>
            <span className="text-foreground/22">/</span>
            <span className="font-mono text-sm font-medium text-foreground">
              {currentDocumentLabel}
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={onCreateDocument}
          size="sm"
          variant="secondary"
          aria-label="New document"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">New document</span>
          <span className="sm:hidden">New</span>
        </Button>

        <Button
          onClick={() => {
            if (isSearchOpen) {
              closeSearch({ clearQuery: true, clearHighlights: true });
              return;
            }

            openSearch();
          }}
          size="icon"
          variant="secondary"
          aria-label="Search · ⌘K"
          title="Search · ⌘K"
        >
          <SearchIcon className="w-3.5 h-3.5" />
        </Button>
      </div>
    </header>
  );
};
