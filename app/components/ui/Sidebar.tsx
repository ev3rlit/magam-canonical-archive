'use client';

import React, { useMemo, useState } from 'react';
import { FolderOpen, PanelLeftClose, PanelLeftOpen, Plus, RefreshCw } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { FileTreeNode } from '@/store/graph';
import { Badge } from './Badge';
import { Button } from './Button';
import { Card, CardDescription, CardTitle } from './Card';
import { FolderTreeItem } from './FolderTreeItem';
import { Select } from './Select';

export type SidebarWorkspaceStatus = 'ok' | 'missing' | 'not-directory' | 'unreadable';

export interface SidebarWorkspaceEntry {
  id: string;
  name: string;
  rootPath: string;
  status: SidebarWorkspaceStatus;
  canvasCount: number;
}

export interface SidebarCanvasEntry {
  canvasId: string;
  workspaceId?: string;
  latestRevision?: number | null;
  title: string;
  compatibilityFilePath?: string | null;
}

interface SidebarProps {
  activeWorkspace: SidebarWorkspaceEntry | null;
  workspaces: SidebarWorkspaceEntry[];
  canvases: SidebarCanvasEntry[];
  fileTree?: FileTreeNode | null;
  isLoading?: boolean;
  onRefresh?: () => void;
  onSelectWorkspace?: (workspaceId: string) => void;
  onCreateWorkspace?: () => void;
  onAddWorkspace?: () => void;
  onCreateCanvas?: () => void;
  onOpenCanvas?: (canvasId: string) => boolean | void;
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

function getCanvasSubtitle(canvas: SidebarCanvasEntry): string | null {
  void canvas;
  return null;
}

const sectionLabelClassName =
  'text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/46';

export const Sidebar: React.FC<SidebarProps> = ({
  activeWorkspace,
  workspaces,
  canvases,
  fileTree,
  isLoading = false,
  onRefresh,
  onSelectWorkspace,
  onCreateWorkspace,
  onAddWorkspace,
  onCreateCanvas,
  onOpenCanvas,
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
  const activeWorkspaceUnavailable = Boolean(activeWorkspace && activeWorkspace.status !== 'ok');
  const canvasCountLabel = useMemo(() => {
    if (!activeWorkspace) {
      return null;
    }

    return `${canvases.length} canvases`;
  }, [activeWorkspace, canvases.length]);
  const hasLegacyTree = Boolean(fileTree && fileTree.children && fileTree.children.length > 0);

  // Workspace-canvas-shell migration anchor:
  // sidebar is presenter-only and keeps legacy TSX access in a compatibility section.
  return (
    <aside
      className={cn(
        'flex h-full flex-shrink-0 flex-col bg-surface-container-low text-on-surface transition-all duration-300 ease-in-out',
        isCollapsed ? 'w-12' : 'w-72',
      )}
    >
      <div
        className={cn(
          'flex items-center px-3 py-3',
          isCollapsed ? 'justify-center' : 'justify-between',
        )}
      >
        {!isCollapsed && (
          <div className="flex items-center gap-2 overflow-hidden">
            <FolderOpen className="h-4 w-4 flex-shrink-0 text-primary" />
            <h2 className="truncate text-sm font-semibold text-foreground">
              Workspace
            </h2>
          </div>
        )}

        <div className="flex items-center gap-1">
          {!isCollapsed && onRefresh && (
            <Button
              onClick={onRefresh}
              className="h-8 w-8 rounded-md"
              size="icon"
              variant="ghost"
              title="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}

          <Button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-8 w-8 rounded-md"
            size="icon"
            variant="ghost"
            title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto py-3 space-y-5">
          <section className="px-3 space-y-3">
            <div className="space-y-2">
              <label className={sectionLabelClassName}>
                Workspace Switcher
              </label>
              {hasWorkspaces ? (
                <Select
                  value={activeWorkspace?.id ?? ''}
                  onChange={(event) => onSelectWorkspace?.(event.target.value)}
                  className="h-11"
                >
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name} · {workspaceStatusLabel(workspace.status)}
                    </option>
                  ))}
                </Select>
              ) : (
                <Card className="px-3 py-3 text-xs text-foreground/54" variant="muted">
                  등록된 workspace가 없습니다.
                </Card>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button onClick={onCreateWorkspace} size="sm" variant="secondary">
                New Workspace
              </Button>
              <Button onClick={onAddWorkspace} size="sm" variant="ghost">
                Add Existing
              </Button>
            </div>

            {activeWorkspace && (
              <Card className="space-y-2 p-3" variant="base">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-sm">
                      {activeWorkspace.name}
                    </CardTitle>
                    <CardDescription className="text-[11px] uppercase tracking-[0.16em]">
                      {statusLabel}
                    </CardDescription>
                  </div>
                  {canvasCountLabel && (
                    <Badge variant="neutral">{canvasCountLabel}</Badge>
                  )}
                </div>
                <div className="break-all text-xs text-foreground/54">
                  {activeWorkspace.rootPath}
                </div>
              </Card>
            )}
          </section>

          <section className="px-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className={sectionLabelClassName}>
                Canvases
              </div>
              <Button
                onClick={onCreateCanvas}
                disabled={!activeWorkspace || activeWorkspaceUnavailable}
                size="sm"
                variant="secondary"
              >
                <Plus className="h-3 w-3" />
                New Canvas
              </Button>
            </div>

            {!hasWorkspaces ? (
              <Card className="px-3 py-4 text-sm text-foreground/56" variant="muted">
                첫 workspace를 만들거나 기존 경로를 등록하세요.
              </Card>
            ) : activeWorkspaceUnavailable ? (
              <Card className="space-y-3 px-3 py-4" variant="base">
                <div className="text-sm font-medium text-danger">
                  Workspace is unavailable
                </div>
                <div className="break-all text-xs text-danger/78">
                  {activeWorkspace?.rootPath}
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={onReconnectWorkspace} size="sm" variant="danger">
                    Reconnect
                  </Button>
                  <Button onClick={onRemoveWorkspace} size="sm" variant="ghost">
                    Remove
                  </Button>
                </div>
              </Card>
            ) : isLoading ? (
              <Card className="px-3 py-4 text-sm text-foreground/56" variant="base">
                Loading canvases...
              </Card>
            ) : canvases.length === 0 ? (
              <Card className="px-3 py-4 text-sm text-foreground/56" variant="muted">
                이 workspace에는 아직 캔버스가 없습니다. `New Canvas`로 첫 캔버스를 만드세요.
              </Card>
            ) : (
              <div className="space-y-2">
                {canvases.map((canvas) => {
                  const subtitle = getCanvasSubtitle(canvas);
                  return (
                    <button
                      key={canvas.canvasId}
                      type="button"
                      onClick={() => onOpenCanvas?.(canvas.canvasId)}
                      className="w-full rounded-lg bg-card px-3 py-2 text-left text-foreground shadow-[inset_0_0_0_1px_rgb(var(--color-border)/0.12)] transition-[background-color,color,box-shadow] duration-fast hover:bg-card/88 hover:shadow-[inset_0_0_0_1px_rgb(var(--color-primary)/0.14)]"
                    >
                      <div className="truncate text-sm font-medium">
                        {canvas.title}
                      </div>
                      {subtitle && (
                        <div className="truncate text-xs text-foreground/52">
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
              <div className={sectionLabelClassName}>
                Workspace
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={onRevealWorkspace}
                  disabled={activeWorkspaceUnavailable}
                  size="sm"
                  variant="secondary"
                >
                  Show in Finder
                </Button>
                <Button onClick={onCopyWorkspacePath} size="sm" variant="ghost">
                  Copy Path
                </Button>
              </div>
            </section>
          )}

          {activeWorkspace && (
            <section className="px-3 space-y-3">
              <div className={sectionLabelClassName}>
                Compatibility
              </div>
              <Card className="space-y-3 px-3 py-3" variant="base">
                <div className="text-xs text-foreground/52">
                  Canvas list가 primary navigation입니다. 레거시 TSX tree는 import/reference 용도로만 여기서 엽니다.
                </div>
                {hasLegacyTree ? (
                  <>
                    <Button
                      onClick={() => setShowLegacyTree((value) => !value)}
                      size="sm"
                      variant="secondary"
                    >
                      {showLegacyTree ? 'Hide TSX Tree' : 'Open TSX Tree'}
                    </Button>
                    {showLegacyTree && fileTree && (
                      <Card className="py-2" variant="muted">
                        {fileTree.children?.map((child) => (
                          <FolderTreeItem
                            key={child.path}
                            node={child}
                            depth={0}
                            onOpenFile={onOpenLegacyFile}
                          />
                        ))}
                      </Card>
                    )}
                  </>
                ) : (
                  <div className="text-xs text-foreground/52">
                    표시할 레거시 TSX 항목이 없으면 이 영역은 비어 있습니다.
                  </div>
                )}
              </Card>
            </section>
          )}
        </div>
      )}

      <div className="flex justify-center p-3">
        {!isCollapsed ? (
          <div className="truncate text-xs text-foreground/42">
            Workspace-first canvas shell
          </div>
        ) : (
          <div className="h-2 w-2 rounded-full bg-primary/50" />
        )}
      </div>
    </aside>
  );
};
