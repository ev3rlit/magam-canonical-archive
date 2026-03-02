import React from 'react';
import { useGraphStore } from '@/store/graph';
import { useChatUiStore } from '@/store/chatUi';
import {
  Bot,
  Command,
  Search as SearchIcon,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { clsx } from 'clsx';

export const Header: React.FC = () => {
  const { status, currentFile, isSearchOpen, openSearch, closeSearch } = useGraphStore();
  const { isOpen: isChatOpen, toggleOpen: toggleChatOpen } = useChatUiStore();

  const isConnected = status === 'connected';

  return (
    <header className="h-12 px-4 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 flex items-center justify-between z-10 relative">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white dark:bg-slate-800">
          <Command className="w-4 h-4" />
        </div>
        <h1 className="font-bold text-slate-800 dark:text-slate-100 tracking-tight">
          Magam
        </h1>
      </div>

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        {currentFile ? (
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <span className="text-xs text-slate-400 font-medium">EDITING</span>
            <span className="text-sm font-mono text-slate-700 dark:text-slate-200 font-medium">
              {currentFile}
            </span>
          </div>
        ) : (
          <span className="text-sm text-slate-400 italic">
            No file selected
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (isSearchOpen) {
              closeSearch({ clearQuery: true, clearHighlights: true });
              return;
            }

            openSearch();
          }}
          className="px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-200 flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Search · ⌘K"
        >
          <SearchIcon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Search · ⌘K</span>
          <span className="sm:hidden">Search</span>
        </button>

        <button
          type="button"
          onClick={toggleChatOpen}
          className={clsx(
            'px-3 py-1.5 rounded-full border text-xs flex items-center gap-2',
            isChatOpen
              ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300'
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800',
          )}
          aria-label="AI Chat · ⌘J"
        >
          <Bot className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">AI Chat · ⌘J</span>
          <span className="sm:hidden">AI</span>
        </button>

        <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800/50">
          {isConnected ? (
            <Wifi className="w-3.5 h-3.5 text-green-500" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-red-500" />
          )}
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className={clsx('relative flex h-2 w-2')}>
                <span
                  className={clsx(
                    'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
                    isConnected ? 'bg-green-400' : 'bg-red-400',
                  )}
                ></span>
                <span
                  className={clsx(
                    'relative inline-flex rounded-full h-2 w-2',
                    isConnected ? 'bg-green-500' : 'bg-red-500',
                  )}
                ></span>
              </span>
              <span
                className={clsx(
                  'text-xs font-medium uppercase tracking-wider',
                  isConnected
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-red-600 dark:text-red-400',
                )}
              >
                {status}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
