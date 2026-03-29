import React, { useEffect, useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { getUiCopy } from '@/components/ui/copy';
import { getInputClassName } from './Input';

export interface QuickOpenCommand {
  id: string;
  label: string;
  hint?: string;
  keywords?: string[];
  disabled?: boolean;
}

export interface QuickOpenCanvas {
  canvasId: string;
  title: string;
}

export interface QuickOpenDialogProps {
  isOpen: boolean;
  canvases: QuickOpenCanvas[];
  onClose: () => void;
  onOpenCanvas: (canvasId: string) => boolean | void;
  commands?: QuickOpenCommand[];
  onRunCommand?: (commandId: string) => boolean | void | Promise<boolean | void>;
}

interface CanvasEntry {
  kind: 'canvas';
  key: string;
  canvas: QuickOpenCanvas;
}

interface CommandEntry {
  kind: 'command';
  key: string;
  command: QuickOpenCommand;
}

type QuickOpenEntry = CanvasEntry | CommandEntry;

function matchesQuery(value: string, query: string): boolean {
  if (!query) return true;
  return value.toLowerCase().includes(query);
}

export function buildQuickOpenEntries(
  canvases: QuickOpenCanvas[],
  commands: QuickOpenCommand[],
  query: string,
): QuickOpenEntry[] {
  const normalized = query.trim().toLowerCase();
  const commandMode = normalized.startsWith('>');
  const actualQuery = commandMode ? normalized.slice(1).trim() : normalized;

  const canvasEntries: QuickOpenEntry[] = commandMode
    ? []
    : canvases
      .filter((canvas) => matchesQuery(`${canvas.title} ${canvas.canvasId}`, actualQuery))
      .map((canvas) => ({
        kind: 'canvas',
        key: `canvas:${canvas.canvasId}`,
        canvas,
      }));

  const commandEntries: QuickOpenEntry[] = commands
    .filter((command) => {
      const searchable = [
        command.label,
        command.id,
        ...(command.keywords || []),
      ].join(' ');
      return matchesQuery(searchable, actualQuery);
    })
    .map((command) => ({
      kind: 'command',
      key: `command:${command.id}`,
      command,
    }));

  return [...canvasEntries, ...commandEntries];
}

export const QuickOpenDialog: React.FC<QuickOpenDialogProps> = ({
  isOpen,
  canvases,
  commands = [],
  onOpenCanvas,
  onRunCommand,
  onClose,
}) => {
  const copy = getUiCopy().quickOpen;
  const [query, setQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);

  const filteredEntries = useMemo(
    () => buildQuickOpenEntries(canvases, commands, query),
    [canvases, commands, query],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setQuery('');
    setFocusedIndex(0);
  }, [isOpen]);

  useEffect(() => {
    setFocusedIndex(0);
  }, [filteredEntries]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async (entry: QuickOpenEntry) => {
    if (entry.kind === 'canvas') {
      const shouldClose = onOpenCanvas(entry.canvas.canvasId);
      if (shouldClose !== false) {
        onClose();
      }
      return;
    }

    if (entry.command.disabled) {
      return;
    }

    const shouldClose = onRunCommand ? await onRunCommand(entry.command.id) : true;
    if (shouldClose !== false) {
      onClose();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (filteredEntries.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setFocusedIndex((prev) => (prev + 1) % filteredEntries.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setFocusedIndex((prev) => (prev - 1 + filteredEntries.length) % filteredEntries.length);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const nextEntry = filteredEntries[focusedIndex];
      if (nextEntry) {
        void handleSubmit(nextEntry);
      }
    }
  };

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgb(var(--overlay-scrim)/0.45)] px-4 py-6 backdrop-blur-sm"
      onKeyDown={handleKeyDown}
    >
      <div
        className="w-full max-w-2xl rounded-lg bg-card/92 shadow-floating shadow-[inset_0_0_0_1px_rgb(var(--color-border)/0.12)] backdrop-blur-glass"
        onKeyDown={(event) => event.stopPropagation()}
      >
        <div className="p-3 shadow-[inset_0_-1px_0_rgb(var(--color-border)/0.08)]">
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.placeholder}
            autoFocus
            className={getInputClassName({ className: 'w-full' })}
          />
        </div>

        <div className="max-h-96 overflow-y-auto">
          {filteredEntries.length === 0 ? (
            <div className="p-3 text-sm text-foreground/52">{copy.noResults}</div>
          ) : (
            filteredEntries.map((entry, index) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => void handleSubmit(entry)}
                disabled={entry.kind === 'command' && Boolean(entry.command.disabled)}
                className={clsx(
                  'w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2',
                  entry.kind === 'command' && entry.command.disabled
                    ? 'opacity-50 cursor-not-allowed'
                    : '',
                  index === focusedIndex
                    ? 'bg-primary/12 text-primary'
                    : 'hover:bg-card text-foreground/82',
                )}
              >
                {entry.kind === 'canvas' ? (
                  <span className="truncate">{entry.canvas.title || entry.canvas.canvasId}</span>
                ) : (
                  <>
                    <span className="truncate">{entry.command.label}</span>
                    <span className="shrink-0 text-xs text-foreground/48">
                      {entry.command.hint || copy.commandHint}
                    </span>
                  </>
                )}
              </button>
            ))
          )}
        </div>

        <div className="flex items-center justify-between px-3 py-2 text-xs text-foreground/48 shadow-[inset_0_1px_0_rgb(var(--color-border)/0.08)]">
          <span>{copy.footer.enter}</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 transition-colors duration-fast hover:bg-card hover:text-foreground"
          >
            {copy.footer.esc}
          </button>
        </div>
      </div>
    </div>
  );
};
