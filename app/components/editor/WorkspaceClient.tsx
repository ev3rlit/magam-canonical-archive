'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useFileSync } from '@/hooks/useFileSync';
import { GraphCanvas } from '@/components/GraphCanvas';
import { Sidebar } from '@/components/ui/Sidebar';
import { Header } from '@/components/ui/Header';
import { Footer } from '@/components/ui/Footer';
import { TabBar } from '@/components/ui/TabBar';
import { type QuickOpenCommand } from '@/components/ui/QuickOpenDialog';
import { ErrorOverlay } from '@/components/ui/ErrorOverlay';
import {
  LazyChatPanel,
  LazyQuickOpenDialog,
  LazySearchOverlay,
  LazyStickerInspector,
} from './LazyPanels';
import { useChatUiStore } from '@/store/chatUi';
import { TabState, useGraphStore } from '@/store/graph';
import {
  getWashiPresetPatternCatalog,
} from '@/utils/washiTapeDefaults';
import { parseRenderGraph } from '@/features/render/parseRenderGraph';

type PendingTabCloseRequest = {
  tabIds: string[];
};

type TabContextMenuState = {
  tabId: string;
  x: number;
  y: number;
};

type MagamTestHooks = {
  getState: () => {
    openTabs: TabState[];
    activeTabId: string | null;
  };
  getActiveTabId: () => string | null;
  getOpenTabs: () => TabState[];
  markTabDirty: (tabId: string, dirty: boolean) => void;
};

declare global {
  interface Window {
    __magamTest?: MagamTestHooks;
  }
}

export function WorkspaceClient() {
  const {
    setFiles,
    setGraph,
    currentFile,
    files,
    nodes,
    selectedNodeIds,
    selectNodesByType,
    focusNextNodeByType,
    openTabs,
    activeTabId,
    openTab,
    activateTab,
    closeTab,
    markTabDirty,
    replaceLeastRecentlyUsedTab,
    isSearchOpen,
    openSearch,
    closeSearch,
    setError: setGraphError,
  } = useGraphStore();
  const isChatOpen = useChatUiStore((state) => state.isOpen);
  const toggleChat = useChatUiStore((state) => state.toggleOpen);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isQuickOpenOpen, setIsQuickOpenOpen] = useState(false);
  const [pendingReplaceRequest, setPendingReplaceRequest] = useState<{
    replaceTabId: string;
    pageId: string;
  } | null>(null);
  const [pendingCloseRequest, setPendingCloseRequest] =
    useState<PendingTabCloseRequest | null>(null);
  const [tabContextMenu, setTabContextMenu] =
    useState<TabContextMenuState | null>(null);
  const tabContextMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    window.__magamTest = {
      getState: () => ({
        openTabs,
        activeTabId,
      }),
      getActiveTabId: () => activeTabId,
      getOpenTabs: () => openTabs,
      markTabDirty: (tabId, dirty) => {
        markTabDirty(tabId, dirty);
      },
    };
  }, [activeTabId, markTabDirty, openTabs]);

  // File sync - triggers re-render when file changes externally
  const handleFileChange = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // Load file list from API
  const loadFiles = useCallback(async () => {
    try {
      const res = await fetch('/api/files');
      const data = await res.json();
      if (data.files) {
        setFiles(data.files);
      }
    } catch (error) {
      console.error('Failed to load files:', error);
    }
  }, [setFiles]);

  // File sync with reload callback for file list changes
  const { updateNode, moveNode } = useFileSync(currentFile, handleFileChange, loadFiles);

  // Initial file load
  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const executeCloseTabs = useCallback(
    (tabIds: string[]) => {
      const targetTabIds = openTabs
        .filter((tab) => tabIds.includes(tab.tabId))
        .map((tab) => tab.tabId);
      targetTabIds.forEach((targetTabId) => {
        closeTab(targetTabId);
      });
    },
    [closeTab, openTabs],
  );

  const requestCloseTabs = useCallback(
    (tabIds: string[]) => {
      const uniqueTabIds = Array.from(new Set(tabIds));
      if (uniqueTabIds.length === 0) {
        return;
      }
      const targetTabs = openTabs.filter((tab) =>
        uniqueTabIds.includes(tab.tabId),
      );
      if (targetTabs.length === 0) {
        return;
      }

      const dirtyTabIds = targetTabs
        .filter((tab) => tab.dirty)
        .map((tab) => tab.tabId);

      if (dirtyTabIds.length > 0) {
        console.debug('[Telemetry] tabs_close_dirty_prompted', {
          source: 'request',
          tabCount: targetTabs.length,
          dirtyTabCount: dirtyTabIds.length,
        });
        setPendingCloseRequest({ tabIds: targetTabs.map((tab) => tab.tabId) });
        return;
      }

      executeCloseTabs(targetTabs.map((tab) => tab.tabId));
    },
    [executeCloseTabs, openTabs],
  );

  const requestCloseTab = useCallback(
    (tabId: string) => {
      requestCloseTabs([tabId]);
    },
    [requestCloseTabs],
  );

  const openTabByPath = useCallback(
    (pageId: string) => {
      const result = openTab(pageId);
      if (result.status === 'blocked') {
        setPendingReplaceRequest({
          replaceTabId: result.replaceTabId,
          pageId,
        });
        return false;
      }
      setPendingReplaceRequest(null);
      setIsQuickOpenOpen(false);
      return true;
    },
    [openTab],
  );

  const handleWashiPresetChange = useCallback(
    async (nodeIds: string[], presetId: string) => {
      await Promise.all(
        nodeIds.map((nodeId) => updateNode(nodeId, { pattern: { type: 'preset', id: presetId } })),
      );
    },
    [updateNode],
  );

  const washiPresetCatalog = useMemo(() => getWashiPresetPatternCatalog(), []);
  const allWashiNodeIds = useMemo(
    () => nodes.filter((node) => node.type === 'washi-tape').map((node) => node.id),
    [nodes],
  );
  const selectedWashiNodeIds = useMemo(
    () => selectedNodeIds.filter((nodeId) => {
      const node = nodes.find((item) => item.id === nodeId);
      return node?.type === 'washi-tape';
    }),
    [nodes, selectedNodeIds],
  );

  const runQuickOpenCommand = useCallback(
    async (commandId: string) => {
      if (commandId === 'washi:select-all') {
        return selectNodesByType('washi-tape').length > 0;
      }

      if (commandId === 'washi:focus-next') {
        return focusNextNodeByType('washi-tape') !== null;
      }

      if (commandId.startsWith('washi:preset:')) {
        const presetId = commandId.replace('washi:preset:', '');
        if (selectedWashiNodeIds.length === 0) {
          return false;
        }

        selectedWashiNodeIds.forEach((nodeId) => {
          useGraphStore.getState().updateNodeData(nodeId, {
            pattern: { type: 'preset', id: presetId },
          });
        });

        try {
          await handleWashiPresetChange(selectedWashiNodeIds, presetId);
          return true;
        } catch (error) {
          console.error('Failed to apply washi preset from quick command:', error);
          return false;
        }
      }

      return false;
    },
    [
      focusNextNodeByType,
      handleWashiPresetChange,
      selectNodesByType,
      selectedWashiNodeIds,
    ],
  );

  const quickOpenCommands = useMemo<QuickOpenCommand[]>(() => {
    const hasWashiNode = allWashiNodeIds.length > 0;
    const hasWashiSelection = selectedWashiNodeIds.length > 0;

    const baseCommands: QuickOpenCommand[] = [
      {
        id: 'washi:select-all',
        label: 'Washi: 전체 선택',
        hint: hasWashiNode ? `${allWashiNodeIds.length}개` : '없음',
        keywords: ['washi', 'select', 'all', '전체', '선택'],
        disabled: !hasWashiNode,
      },
      {
        id: 'washi:focus-next',
        label: 'Washi: 다음 노드 포커스',
        hint: hasWashiNode ? '순환' : '없음',
        keywords: ['washi', 'focus', 'next', '포커스'],
        disabled: !hasWashiNode,
      },
    ];

    const presetCommands = washiPresetCatalog.map((preset) => ({
      id: `washi:preset:${preset.id}`,
      label: `Washi preset: ${preset.label}`,
      hint: hasWashiSelection ? `${selectedWashiNodeIds.length}개 선택됨` : '와시 선택 필요',
      keywords: ['washi', 'preset', preset.id, preset.label.toLowerCase()],
      disabled: !hasWashiSelection,
    }));

    return [...baseCommands, ...presetCommands];
  }, [allWashiNodeIds.length, selectedWashiNodeIds.length, washiPresetCatalog]);

  const confirmLimitReplace = useCallback(() => {
    if (!pendingReplaceRequest) return;
    replaceLeastRecentlyUsedTab(
      pendingReplaceRequest.pageId,
      pendingReplaceRequest.replaceTabId,
    );
    setPendingReplaceRequest(null);
    setIsQuickOpenOpen(false);
  }, [pendingReplaceRequest, replaceLeastRecentlyUsedTab]);

  const cancelLimitReplace = useCallback(() => {
    setPendingReplaceRequest(null);
  }, []);

  const requestCloseCurrentTabFromMenu = useCallback(() => {
    if (!tabContextMenu) return;
    requestCloseTab(tabContextMenu.tabId);
    setTabContextMenu(null);
  }, [requestCloseTab, tabContextMenu]);

  const requestCloseOtherTabsFromMenu = useCallback(() => {
    if (!tabContextMenu) return;
    requestCloseTabs(
      openTabs
        .filter((tab) => tab.tabId !== tabContextMenu.tabId)
        .map((tab) => tab.tabId),
    );
    setTabContextMenu(null);
  }, [openTabs, requestCloseTabs, tabContextMenu]);

  const requestCloseAllTabsFromMenu = useCallback(() => {
    requestCloseTabs(openTabs.map((tab) => tab.tabId));
    setTabContextMenu(null);
  }, [openTabs, requestCloseTabs]);

  const confirmTabClose = useCallback(
    (shouldSave: boolean) => {
      if (!pendingCloseRequest) return;

      if (shouldSave) {
        pendingCloseRequest.tabIds.forEach((tabId) => {
          markTabDirty(tabId, false);
        });
      }
      executeCloseTabs(pendingCloseRequest.tabIds);
      setPendingCloseRequest(null);
    },
    [executeCloseTabs, markTabDirty, pendingCloseRequest],
  );

  const cancelTabClose = useCallback(() => {
    setPendingCloseRequest(null);
  }, []);

  const activeTab = useMemo(
    () => openTabs.find((tab) => tab.tabId === activeTabId) || null,
    [activeTabId, openTabs],
  );

  const pendingCloseTabInfos = useMemo(() => {
    if (!pendingCloseRequest) return null;
    const tabsToClose = openTabs.filter((tab) =>
      pendingCloseRequest.tabIds.includes(tab.tabId),
    );
    const dirtyTabs = tabsToClose.filter((tab) => tab.dirty);
    return {
      total: tabsToClose.length,
      dirtyTotal: dirtyTabs.length,
      tabNames: tabsToClose.map((tab) => tab.title || tab.pageId),
    };
  }, [openTabs, pendingCloseRequest]);

  const hasSelectedSticker = useMemo(() => {
    const selectedSet = new Set(selectedNodeIds);
    return nodes.some((node) => selectedSet.has(node.id) && node.type === 'sticker');
  }, [nodes, selectedNodeIds]);

  const openTabContextMenu = useCallback(
    (tabId: string, event: React.MouseEvent) => {
      setTabContextMenu({
        tabId,
        x: event.clientX,
        y: event.clientY,
      });
    },
    [],
  );

  const closeTabContextMenu = useCallback(() => {
    setTabContextMenu(null);
  }, []);

  useEffect(() => {
    if (!tabContextMenu) {
      return;
    }

    const handlePointer = (event: MouseEvent | TouchEvent) => {
      if (!tabContextMenuRef.current || !event.target) {
        return;
      }
      if (!tabContextMenuRef.current.contains(event.target as Node)) {
        setTabContextMenu(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setTabContextMenu(null);
      }
    };

    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('touchstart', handlePointer);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('touchstart', handlePointer);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [tabContextMenu]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null): boolean =>
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target as HTMLElement)?.isContentEditable;

    const handleShortcut = (event: KeyboardEvent) => {
      if (pendingReplaceRequest || pendingCloseRequest || tabContextMenu) {
        return;
      }

      const isModifierPressed = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (!isModifierPressed) return;
      if (isEditableTarget(event.target)) return;

      if (key === 't') {
        event.preventDefault();
        setIsQuickOpenOpen(true);
        return;
      }

      if (key === 'j') {
        event.preventDefault();
        toggleChat();
        return;
      }

      if (key === 'k') {
        event.preventDefault();
        if (isSearchOpen) {
          closeSearch({ clearQuery: true, clearHighlights: true });
        } else {
          openSearch();
        }
        return;
      }

      if (key === 'w') {
        event.preventDefault();
        if (activeTab) {
          requestCloseTab(activeTab.tabId);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [
    activeTab,
    pendingCloseRequest,
    pendingReplaceRequest,
    requestCloseTab,
    tabContextMenu,
    isSearchOpen,
    openSearch,
    closeSearch,
    toggleChat,
  ]);

  useEffect(() => {
    async function renderFile() {
      if (!currentFile) return;

      try {
        setGraphError(null); // Clear previous errors

        const response = await fetch('/api/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: currentFile }),
        });

        const data = await response.json();

        if (!response.ok) {
          // Handle structured error from backend
          const errorMessage = data.error || 'Unknown rendering error';

          // Try to extract location info from the error message or details
          let location = undefined;

          // Regex to find "at filename:line:col" pattern common in stack traces
          // or custom format "file.tsx:10:5"
          if (data.details && typeof data.details === 'string') {
            // Look for specific file match if available
            const match = data.details.match(
              /([a-zA-Z0-9_-]+\.tsx?):(\d+):(\d+)/,
            );
            if (match) {
              location = {
                file: match[1],
                line: parseInt(match[2]),
                column: parseInt(match[3]),
              };
            }
          }

          setGraphError({
            message: errorMessage,
            type: data.type || 'RENDER_ERROR',
            details: data.details,
            location,
          });
          return;
        }

        const parsed = parseRenderGraph(data);
        if (parsed) {
          setGraph(parsed);
        }
      } catch (error) {
        console.error('Failed to render file:', error);
      }
    }

    renderFile();
  }, [currentFile, setGraph, refreshKey]); // refreshKey triggers re-render on file changes

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-slate-900">
      <Sidebar onOpenFile={openTabByPath} />

      <div className="flex flex-1 flex-col h-full overflow-hidden relative">
        <Header />
        {isChatOpen && <LazyChatPanel />}
        <TabBar
          tabs={openTabs}
          activeTabId={activeTabId}
          onActivate={activateTab}
          onClose={requestCloseTab}
          onContextMenu={openTabContextMenu}
        />

        <main className="flex-1 relative w-full h-full overflow-hidden">
          <ErrorOverlay />
          {isSearchOpen && <LazySearchOverlay />}
          <GraphCanvas
            onNodeDragStop={moveNode}
            onWashiPresetChange={handleWashiPresetChange}
          />
          {hasSelectedSticker && <LazyStickerInspector />}
        </main>

        <Footer />

        {isQuickOpenOpen && (
          <LazyQuickOpenDialog
            isOpen={isQuickOpenOpen}
            files={files}
            commands={quickOpenCommands}
            onOpenFile={openTabByPath}
            onRunCommand={runQuickOpenCommand}
            onClose={() => setIsQuickOpenOpen(false)}
          />
        )}

        {tabContextMenu && (
          <div
            ref={tabContextMenuRef}
            role="menu"
            className="fixed z-50 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-1"
            style={{
              left: `${Math.max(8, Math.min(tabContextMenu.x, window.innerWidth - 200))}px`,
              top: `${Math.max(8, Math.min(tabContextMenu.y, window.innerHeight - 130))}px`,
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                closeTabContextMenu();
              }
            }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={requestCloseCurrentTabFromMenu}
              className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              탭 닫기
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={requestCloseOtherTabsFromMenu}
              className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              다른 탭 닫기
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={requestCloseAllTabsFromMenu}
              className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              모든 탭 닫기
            </button>
          </div>
        )}

        {pendingCloseRequest && (
          <div
            className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center px-4"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                cancelTabClose();
                return;
              }
              if (event.key === 'Enter') {
                event.preventDefault();
                cancelTabClose();
              }
            }}
          >
            <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl p-4 space-y-4">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {pendingCloseTabInfos?.total === 1
                  ? '변경사항이 저장되지 않았습니다'
                  : `${pendingCloseTabInfos?.total ?? 0}개 탭에 저장되지 않은 변경사항이 있습니다`}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {pendingCloseTabInfos?.total === 1
                  ? '현재 탭을 닫으면 편집한 내용이 손실될 수 있습니다.'
                  : `${pendingCloseTabInfos?.dirtyTotal ?? 0}개 탭의 저장되지 않은 내용이 있습니다. 선택한 탭들을 닫으면 변경사항이 손실될 수 있습니다.`}
              </p>
              {!!pendingCloseTabInfos?.tabNames.length && (
                <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
                  {pendingCloseTabInfos.tabNames.slice(0, 5).map((tabName) => (
                    <li key={tabName} className="truncate">
                      {tabName}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => confirmTabClose(false)}
                  className="rounded border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  저장 안 함
                </button>
                <button
                  type="button"
                  onClick={() => confirmTabClose(true)}
                  className="rounded border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/40 px-3 py-1.5 text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-800"
                >
                  저장 후 닫기
                </button>
                <button
                  type="button"
                  onClick={cancelTabClose}
                  className="rounded bg-slate-900 text-white px-3 py-1.5 text-xs font-medium hover:bg-slate-700"
                  autoFocus
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

        {pendingReplaceRequest && (
          <div
            className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-sm flex items-center justify-center px-4"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                cancelLimitReplace();
              }
            }}
          >
            <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl p-4 space-y-4">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                탭 개수 제한
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                최대 10개 탭이 열려 있습니다. 가장 오래 사용하지 않은 탭을
                교체하고 새 탭을 열까요?
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={cancelLimitReplace}
                  className="rounded border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={confirmLimitReplace}
                  className="rounded bg-slate-900 text-white px-3 py-1.5 text-xs font-medium hover:bg-slate-700"
                  autoFocus
                >
                  교체 후 열기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
