import React from 'react';
import { TabState, getDefaultTabTitle } from '@/store/graph';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

interface TabBarProps {
  tabs: TabState[];
  activeTabId: string | null;
  onActivate: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onContextMenu?: (tabId: string, event: React.MouseEvent) => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onActivate,
  onClose,
  onContextMenu,
}) => {
  return (
    <div
      role="tablist"
      aria-label="열린 파일 탭"
      className="w-full border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-x-auto scrollbar-thin"
    >
      <div className="flex items-stretch">
        {tabs.length === 0 ? (
          <div className="text-xs text-slate-500 px-3 py-2">
            Open a document or run `new-document` from Quick Open
          </div>
        ) : (
          tabs.map((tab) => {
            const isActive = tab.tabId === activeTabId;
            return (
              <div
                key={tab.tabId}
                className={clsx(
                  'group flex min-w-40 max-w-72 items-center gap-2 border-r border-slate-200 px-3 py-2 dark:border-slate-700',
                  isActive
                    ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                    : 'bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
                )}
                onContextMenu={(event) => {
                  if (!onContextMenu) return;
                  event.preventDefault();
                  event.stopPropagation();
                  onContextMenu(tab.tabId, event);
                }}
                role="presentation"
              >
                <button
                  id={`magam-tab-${tab.tabId}`}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`magam-tabpanel-${tab.tabId}`}
                  onClick={() => onActivate(tab.tabId)}
                  className="min-w-0 flex-1 text-left"
                  type="button"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {tab.dirty ? (
                      <span
                        className="h-2 w-2 rounded-full bg-amber-500 flex-shrink-0"
                        aria-label="저장되지 않은 변경사항"
                        title="저장되지 않은 변경사항"
                      />
                    ) : (
                      <span
                        className="h-2 w-2 flex-shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    <span className="truncate text-xs font-medium">
                      {tab.title || getDefaultTabTitle(tab.pageId)}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onClose(tab.tabId);
                  }}
                  aria-label={`${tab.title || getDefaultTabTitle(tab.pageId)} 탭 닫기`}
                  className="rounded p-1 hover:bg-slate-200/70 dark:hover:bg-slate-700/70"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TabBar;
