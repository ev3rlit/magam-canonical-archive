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
      className="w-full overflow-x-auto bg-muted/64 px-2 py-1 scrollbar-thin shadow-[inset_0_-1px_0_rgb(var(--color-border)/0.08)]"
    >
      <div className="flex items-stretch gap-1">
        {tabs.length === 0 ? (
          <div className="px-3 py-2 text-xs text-foreground/52">
            Open a document or run `new-document` from Quick Open
          </div>
        ) : (
          tabs.map((tab) => {
            const isActive = tab.tabId === activeTabId;
            return (
              <div
                key={tab.tabId}
                className={clsx(
                  'group flex min-w-40 max-w-72 items-center gap-2 rounded-lg px-3 py-2 transition-[background-color,color,box-shadow] duration-fast',
                  isActive
                    ? 'bg-card text-foreground shadow-raised shadow-[inset_0_0_0_1px_rgb(var(--color-primary)/0.14)]'
                    : 'bg-transparent text-foreground/62 hover:bg-card/82 hover:text-foreground/82',
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
                        className="h-2 w-2 flex-shrink-0 rounded-full bg-primary"
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
                  className="rounded-md p-1 text-foreground/48 transition-colors duration-fast hover:bg-muted hover:text-foreground"
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
