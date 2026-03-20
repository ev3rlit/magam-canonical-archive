'use client';

import React, { useMemo, useState } from 'react';
import { FolderOpen, PanelLeftClose, PanelLeftOpen, Plus, RefreshCw } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { FileTreeNode } from '@/store/graph';
import { FolderTreeItem } from './FolderTreeItem';

export type SidebarWorkspaceStatus = 'ok' | 'missing' | 'not-directory' | 'unreadable';

export interface SidebarWorkspaceEntry {
  id: string;
  name: string;
  rootPath: string;
  status: SidebarWorkspaceStatus;
  documentCount: number;
}

export interface SidebarDocumentEntry {
  absolutePath: string;
  relativePath: string;
  title: string;
}

interface SidebarProps {
  activeWorkspace: SidebarWorkspaceEntry | null;
  workspaces: SidebarWorkspaceEntry[];
  documents: SidebarDocumentEntry[];
  fileTree?: FileTreeNode | null;
  isLoading?: boolean;
  onRefresh?: () => void;
  onSelectWorkspace?: (workspaceId: string) => void;
  onCreateWorkspace?: () => void;
  onAddWorkspace?: () => void;
  onCreateDocument?: () => void;
  onOpenDocument?: (absolutePath: string) => boolean | void;
  onCopyWorkspacePath?: () => void;
  onRevealWorkspace?: () => void;
  onReconnectWorkspace?: () => void;
  onRemoveWorkspace?: () => void;
  onOpenLegacyFile?: (filePath: string) => boolean | void;
}

function workspaceStatusLabel(status: SidebarWorkspaceStatus): string {
  switch (status) {
    case 'ok':
      return 'Available';
    case 'missing':
      return 'Missing';
    case 'not-directory':
      return 'Invalid';
    case 'unreadable':
      return 'Unreadable';
    default:
      return 'Unknown';
  }
}

function getDocumentSubtitle(document: SidebarDocumentEntry): string | null {
  const normalizedTitle = document.title.trim();
  if (!normalizedTitle || normalizedTitle === document.relativePath) {
    return null;
  }

  return document.relativePath;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeWorkspace,
  workspaces,
  documents,
  fileTree,
  isLoading = false,
  onRefresh,
  onSelectWorkspace,
  onCreateWorkspace,
  onAddWorkspace,
  onCreateDocument,
  onOpenDocument,
  onCopyWorkspacePath,
  onRevealWorkspace,
  onReconnectWorkspace,
  onRemoveWorkspace,
  onOpenLegacyFile,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showLegacyTree, setShowLegacyTree] = useState(false);

  const statusLabel = activeWorkspace
    ? workspaceStatusLabel(activeWorkspace.status)
    : null;
  const hasWorkspaces = workspaces.length > 0;
  const activeWorkspaceUnavailable = activeWorkspace && activeWorkspace.status !== 'ok';
  const documentCountLabel = useMemo(() => {
    if (!activeWorkspace) {
      return null;
    }

    return `${documents.length} docs`;
  }, [activeWorkspace, documents.length]);
  const hasLegacyTree = Boolean(fileTree && fileTree.children && fileTree.children.length > 0);

  // Workspace-document-shell migration anchor:
  // sidebar is presenter-only and keeps legacy TSX access in a compatibility section.
  return (
    <aside
      className={cn(
        'flex-shrink-0 border-r border-slate-200 bg-gray-50 dark:border-slate-800 dark:bg-slate-900 flex flex-col h-full transition-all duration-300 ease-in-out',
        isCollapsed ? 'w-12' : 'w-72',
      )}
    >
      <div
        className={cn(
          'p-3 border-b border-slate-200 dark:border-slate-800 flex items-center',
          isCollapsed ? 'justify-center' : 'justify-between',
        )}
      >
        {!isCollapsed && (
          <div className="flex items-center gap-2 overflow-hidden">
            <FolderOpen className="w-4 h-4 text-slate-500 dark:text-slate-400 flex-shrink-0" />
            <h2 className="font-semibold text-sm text-slate-700 dark:text-slate-200 truncate">
              Workspace
            </h2>
          </div>
        )}

        <div className="flex items-center gap-1">
          {!isCollapsed && onRefresh && (
            <button
              onClick={onRefresh}
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              title="Refresh"
              type="button"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            type="button"
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            ) : (
              <PanelLeftClose className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            )}
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto py-3 space-y-5">
          <section className="px-3 space-y-3">
            <div className="space-y-2">
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Workspace Switcher
              </label>
              {hasWorkspaces ? (
                <select
                  value={activeWorkspace?.id ?? ''}
                  onChange={(event) => onSelectWorkspace?.(event.target.value)}
                  className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-700 dark:text-slate-200"
                >
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name} · {workspaceStatusLabel(workspace.status)}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="rounded-md border border-dashed border-slate-300 dark:border-slate-700 px-3 py-3 text-xs text-slate-500 dark:text-slate-400">
                  등록된 workspace가 없습니다.
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onCreateWorkspace}
                className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                New Workspace
              </button>
              <button
                type="button"
                onClick={onAddWorkspace}
                className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Add Existing
              </button>
            </div>

            {activeWorkspace && (
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                      {activeWorkspace.name}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      {statusLabel}
                    </div>
                  </div>
                  {documentCountLabel && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {documentCountLabel}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 break-all">
                  {activeWorkspace.rootPath}
                </div>
              </div>
            )}
          </section>

          <section className="px-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Documents
              </div>
              <button
                type="button"
                onClick={onCreateDocument}
                disabled={!activeWorkspace || activeWorkspaceUnavailable}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus className="w-3 h-3" />
                New Document
              </button>
            </div>

            {!hasWorkspaces ? (
              <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-3 py-4 text-sm text-slate-500 dark:text-slate-400">
                첫 workspace를 만들거나 기존 경로를 등록하세요.
              </div>
            ) : activeWorkspaceUnavailable ? (
              <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 px-3 py-4 space-y-3">
                <div className="text-sm font-medium text-amber-700 dark:text-amber-300">
                  Workspace is unavailable
                </div>
                <div className="text-xs text-amber-700/80 dark:text-amber-200/80 break-all">
                  {activeWorkspace?.rootPath}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onReconnectWorkspace}
                    className="rounded-md border border-amber-300 dark:border-amber-700 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-100/70 dark:hover:bg-amber-900/30"
                  >
                    Reconnect
                  </button>
                  <button
                    type="button"
                    onClick={onRemoveWorkspace}
                    className="rounded-md border border-slate-300 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : isLoading ? (
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-4 text-sm text-slate-500 dark:text-slate-400">
                Loading documents...
              </div>
            ) : documents.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-3 py-4 text-sm text-slate-500 dark:text-slate-400">
                이 workspace에는 아직 문서가 없습니다. `New Document`로 첫 canvas를 만드세요.
              </div>
            ) : (
              <div className="space-y-1">
                {documents.map((document) => {
                  const subtitle = getDocumentSubtitle(document);
                  return (
                    <button
                      key={document.absolutePath}
                      type="button"
                      onClick={() => onOpenDocument?.(document.absolutePath)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800/70"
                    >
                      <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                        {document.title}
                      </div>
                      {subtitle && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {subtitle}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {activeWorkspace && (
            <section className="px-3 space-y-3">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Workspace
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={onRevealWorkspace}
                  disabled={activeWorkspaceUnavailable}
                  className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Show in Finder
                </button>
                <button
                  type="button"
                  onClick={onCopyWorkspacePath}
                  className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Copy Path
                </button>
              </div>
            </section>
          )}

          {activeWorkspace && (
            <section className="px-3 space-y-3">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Compatibility
              </div>
              <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 bg-white/70 dark:bg-slate-950/70 px-3 py-3 space-y-3">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Document list가 primary navigation입니다. 레거시 TSX tree는 import/reference 용도로만 여기서 엽니다.
                </div>
                {hasLegacyTree ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowLegacyTree((value) => !value)}
                      className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      {showLegacyTree ? 'Hide TSX Tree' : 'Open TSX Tree'}
                    </button>
                    {showLegacyTree && fileTree && (
                      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-2">
                        {fileTree.children?.map((child) => (
                          <FolderTreeItem
                            key={child.path}
                            node={child}
                            depth={0}
                            onOpenFile={onOpenLegacyFile}
                          />
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    표시할 레거시 TSX 항목이 없으면 이 영역은 비어 있습니다.
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      )}

      <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex justify-center">
        {!isCollapsed ? (
          <div className="text-xs text-slate-400 dark:text-slate-500 truncate">
            Workspace-first document shell
          </div>
        ) : (
          <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700" />
        )}
      </div>
    </aside>
  );
};
