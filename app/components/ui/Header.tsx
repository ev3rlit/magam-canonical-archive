import React from 'react';
import { useGraphStore } from '@/store/graph';
import { useChatUiStore } from '@/store/chatUi';
import {
  Bot,
  Command,
  Plus,
  Search as SearchIcon,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Badge } from './Badge';
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
  const { isOpen: isChatOpen, toggleOpen: toggleChatOpen } = useChatUiStore();

  const isConnected = status === 'connected';
  const workspaceLabel = workspaceLabelOverride || 'workspace';
  const currentDocumentLabel = currentFile ? currentFile.split('/').at(-1) ?? currentFile : null;

  return (
    <header className="relative z-10 flex h-14 items-center justify-between bg-background/80 px-4 backdrop-blur-glass shadow-[inset_0_-1px_0_rgb(var(--color-border)/0.08)]">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-raised">
          <Command className="w-4 h-4" />
        </div>
        <h1 className="font-bold tracking-tight text-foreground">
          Magam
        </h1>
      </div>

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
        ) : (
          <span className="text-sm italic text-foreground/46">
            Resume or create a document to start on canvas
          </span>
        )}
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
          size="sm"
          variant="secondary"
          aria-label="Search · ⌘K"
        >
          <SearchIcon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Search · ⌘K</span>
          <span className="sm:hidden">Search</span>
        </Button>

        <Button
          onClick={toggleChatOpen}
          size="sm"
          variant={isChatOpen ? 'primary' : 'secondary'}
          className={clsx(isChatOpen && 'shadow-[0_0_0_10px_rgb(var(--color-primary)/0.08)]')}
          aria-label="AI Chat · ⌘J"
        >
          <Bot className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">AI Chat · ⌘J</span>
          <span className="sm:hidden">AI</span>
        </Button>

        <div className="flex items-center gap-2 rounded-pill bg-muted/78 px-2.5 py-1.5 shadow-[inset_0_0_0_1px_rgb(var(--color-border)/0.10)]">
          {isConnected ? (
            <Wifi className="w-3.5 h-3.5 text-success" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-danger" />
          )}
          <div className="flex items-center gap-1.5">
            <span className={clsx('relative flex h-2 w-2')}>
                <span
                  className={clsx(
                    'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                    isConnected ? 'bg-success/72' : 'bg-danger/72',
                  )}
                />
                <span
                  className={clsx(
                    'relative inline-flex rounded-full h-2 w-2',
                    isConnected ? 'bg-success' : 'bg-danger',
                  )}
                />
            </span>
            <Badge variant={isConnected ? 'success' : 'danger'}>{status}</Badge>
          </div>
        </div>
      </div>
    </header>
  );
};
