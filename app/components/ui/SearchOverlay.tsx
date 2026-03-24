'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Search, FileText, CircleDot, X } from 'lucide-react';
import { clsx } from 'clsx';
import { SearchResult, buildSearchResults } from '@/utils/search';
import { useGraphStore } from '@/store/graph';
import { useNodeNavigation } from '@/contexts/NavigationContext';
import { getUiCopy } from '@/components/ui/copy';
import { getInputClassName } from './Input';

export const SearchOverlay: React.FC = () => {
  const copy = getUiCopy().searchOverlay;
  const {
    isSearchOpen,
    searchMode,
    searchQuery,
    searchResults,
    activeResultIndex,
    nodes,
    files,
    currentCanvasId,
    currentFile,
    closeSearch,
    setSearchMode,
    setSearchQuery,
    setSearchResults,
    moveSearchActiveIndex,
    setSearchActiveIndex,
    setSearchHighlightElementIds,
    setSelectedNodes,
    setCurrentFile,
  } = useGraphStore((state) => state);
  const { navigateToNode } = useNodeNavigation();
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  const [isComposing, setIsComposing] = useState(false);
  const queryInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isSearchOpen) {
      return;
    }

    const timer = window.setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 120);

    return () => window.clearTimeout(timer);
  }, [searchQuery, isSearchOpen]);

  useEffect(() => {
    if (!isSearchOpen) {
      return;
    }

    const startAt = performance.now();
    const nextResults = buildSearchResults({
      nodes,
      files,
      currentCanvasId,
      query: debouncedQuery,
      mode: searchMode,
    });

    setSearchResults(nextResults);
    setSearchActiveIndex(nextResults.length > 0 ? 0 : -1);

    const highlightedElements = (debouncedQuery.length >= 2
      ? nextResults.filter((result) => result.type === 'element').map((result) => result.key)
      : [])
      .filter((value, index, list) => list.indexOf(value) === index);

    setSearchHighlightElementIds(debouncedQuery.length >= 2 ? highlightedElements : []);

    const durationMs = performance.now() - startAt;
    console.debug('[Search] search_results_built', {
      mode: searchMode,
      queryLength: debouncedQuery.length,
      resultCount: nextResults.length,
      durationMs,
    });

    if (!nextResults.length) {
      return;
    }
  }, [
    isSearchOpen,
    nodes,
    files,
    currentCanvasId,
    searchMode,
    debouncedQuery,
    setSearchActiveIndex,
    setSearchHighlightElementIds,
    setSearchResults,
  ]);

  useEffect(() => {
    if (!isSearchOpen) {
      return;
    }

    if (queryInputRef.current) {
      queryInputRef.current.focus();
      queryInputRef.current.setSelectionRange(queryInputRef.current.value.length, queryInputRef.current.value.length);
    }

    return undefined;
  }, [isSearchOpen]);

  useEffect(() => {
    if (!isSearchOpen) {
      setDebouncedQuery('');
      return;
    }

    setSearchQuery('');
    setSearchResults([]);
    setSearchHighlightElementIds([]);
  }, [isSearchOpen, setSearchHighlightElementIds, setSearchQuery, setSearchResults]);

  const activeResult = searchResults[activeResultIndex];

  const resultHint = useMemo(() => {
    if (searchResults.length === 0) {
      if (!searchQuery.trim()) {
        return searchMode === 'global'
          ? copy.emptyHint.global
          : copy.emptyHint.page;
      }
      return copy.noResults;
    }

    return copy.resultCount(searchResults.length);
  }, [copy, searchResults.length, searchMode, searchQuery]);

  const handleResultSubmit = (result: SearchResult) => {
    console.debug('[Search] search_executed', {
      mode: searchMode,
      type: result.type,
      rank: activeResultIndex + 1,
      queryLength: debouncedQuery.length,
      key: result.key,
    });

    if (result.type === 'file') {
      if (result.key !== currentFile) {
        setCurrentFile(result.key);
      }
      closeSearch({ clearQuery: true, clearHighlights: true });
      return;
    }

    const navigate = () => {
      const nodeExists = useGraphStore.getState().nodes.some((node) => node.id === result.key);
      if (!nodeExists) {
        return false;
      }

      setSelectedNodes([result.key]);
      navigateToNode(result.key);
      return true;
    };

    const waitForNode = (remaining: number) => {
      if (navigate()) {
        setSearchHighlightElementIds([result.key]);
        closeSearch({ clearQuery: true, clearHighlights: false });
        window.setTimeout(() => setSearchHighlightElementIds([]), 1800);
        return;
      }

      if (remaining <= 0) {
        console.warn('[Search] Node not found after file switch:', result.key);
        setSearchHighlightElementIds([]);
        return;
      }

      window.setTimeout(() => waitForNode(remaining - 1), 120);
    };

    waitForNode(6);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (isComposing) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeSearch({ clearQuery: true, clearHighlights: true });
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveSearchActiveIndex('down');
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveSearchActiveIndex('up');
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      if (activeResult) {
        handleResultSubmit(activeResult);
      }
      return;
    }
  };

  const setMode = (mode: 'global' | 'page') => {
    if (mode === searchMode) {
      return;
    }

    setSearchMode(mode);
  };

  if (!isSearchOpen) {
    return null;
  }

  const activeResultId = activeResult ? `search-result-${activeResult.type}-${activeResult.key}` : undefined;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgb(var(--overlay-scrim)/0.45)] px-4 py-6 backdrop-blur-sm"
      onKeyDown={handleKeyDown}
      onClick={() => closeSearch({ clearQuery: true, clearHighlights: true })}
    >
      <section
        className="w-full max-w-2xl overflow-hidden rounded-lg bg-card/92 shadow-floating shadow-[inset_0_0_0_1px_rgb(var(--color-border)/0.12)] backdrop-blur-glass"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        aria-modal="true"
        aria-label={copy.dialogLabel}
      >
        <div className="space-y-2 p-3 shadow-[inset_0_-1px_0_rgb(var(--color-border)/0.08)]">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-foreground/48" />
            <input
              ref={queryInputRef}
              type="text"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
              }}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              placeholder={copy.placeholder}
              aria-label={copy.inputLabel}
              className={getInputClassName({ className: 'w-full' })}
            />
            <button
              type="button"
              aria-label={copy.closeLabel}
              onClick={() => closeSearch({ clearQuery: true, clearHighlights: true })}
              className="rounded-md p-1 text-foreground/48 transition-colors duration-fast hover:bg-card hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex w-max rounded-pill bg-muted p-0.5">
            <button
              type="button"
              onClick={() => setMode('global')}
              className={clsx(
                'rounded-pill px-3 py-1 text-xs font-medium transition-colors',
                searchMode === 'global'
                  ? 'bg-card text-foreground shadow-raised'
                  : 'text-foreground/56 hover:text-foreground',
              )}
            >
              {copy.modeLabels.global}
            </button>
            <button
              type="button"
              onClick={() => setMode('page')}
              className={clsx(
                'rounded-pill px-3 py-1 text-xs font-medium transition-colors',
                searchMode === 'page'
                  ? 'bg-card text-foreground shadow-raised'
                  : 'text-foreground/56 hover:text-foreground',
              )}
            >
              {copy.modeLabels.page}
            </button>
          </div>
        </div>

        <div
          role="listbox"
          aria-label={copy.dialogLabel}
          aria-activedescendant={activeResultId}
          className="max-h-96 overflow-y-auto"
        >
          {searchResults.length === 0 ? (
            <div className="px-3 py-4 text-sm text-foreground/52">{resultHint}</div>
          ) : (
            searchResults.map((result, index) => {
              const isActive = index === activeResultIndex;
              return (
                <button
                  key={`${result.type}:${result.key}`}
                  type="button"
                  id={`search-result-${result.type}-${result.key}`}
                  role="option"
                  aria-selected={isActive}
                  onMouseEnter={() => setSearchActiveIndex(index)}
                  onClick={() => handleResultSubmit(result)}
                  className={clsx(
                    'w-full text-left px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-primary/12 text-primary'
                      : 'hover:bg-card text-foreground/82',
                  )}
                >
                  <div className="flex items-center gap-2">
                    {result.type === 'element' ? (
                      <CircleDot className="w-3.5 h-3.5 flex-shrink-0 text-primary" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 flex-shrink-0 text-success" />
                    )}
                    <span className="font-medium truncate">{result.title}</span>
                    <span className="ml-auto text-xs text-foreground/48">
                      {copy.resultTypeLabels[result.type]}
                    </span>
                  </div>
                  <div className="ml-5 truncate text-xs text-foreground/42">{result.subtitle}</div>
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-3 px-3 py-2 text-xs text-foreground/48 shadow-[inset_0_1px_0_rgb(var(--color-border)/0.08)]">
          <span>{copy.footer.move}</span>
          <span>{copy.footer.execute}</span>
          <span>{copy.footer.close}</span>
          <span className="ml-auto flex items-center gap-1">
            <Check className="w-3 h-3" />
            {resultHint}
          </span>
        </div>
      </section>
    </div>
  );
};
