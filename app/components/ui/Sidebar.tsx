'use client';

import React, { useState } from 'react';
import { PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { FileTreeNode } from '@/store/graph';
import { Button } from './Button';
import { Card } from './Card';

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
}

interface SidebarProps {
  activeWorkspace: SidebarWorkspaceEntry | null;
  workspaces: SidebarWorkspaceEntry[];
  canvases: SidebarCanvasEntry[];
  isTransientWorkspace?: boolean;
  fileTree?: FileTreeNode | null;
  isLoading?: boolean;
  onRefresh?: () => void;
  onSelectWorkspace?: (workspaceId: string) => void;
  onSaveWorkspace?: () => void;
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

function getWorkspaceTitle(input: {
  activeWorkspace: SidebarWorkspaceEntry | null;
  isTransientWorkspace: boolean;
}): string {
  if (input.activeWorkspace) {
    return input.activeWorkspace.name;
  }

  return input.isTransientWorkspace ? 'Untitled Workspace' : 'Workspace';
}

function getCanvasThumbnailLabel(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) {
    return 'UC';
  }

  const words = trimmed.split(/\s+/).slice(0, 2);
  const initials = words.map((word) => word[0]?.toUpperCase() ?? '').join('');
  return initials || 'UC';
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeWorkspace,
  canvases,
  isTransientWorkspace = false,
  isLoading = false,
  onCreateCanvas,
  onOpenCanvas,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const workspaceTitle = getWorkspaceTitle({
    activeWorkspace,
    isTransientWorkspace,
  });
  const createDisabled = isLoading || !activeWorkspace || activeWorkspace.status !== 'ok' || isTransientWorkspace;

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
          <div className="min-w-0 pr-2">
            <h2 className="truncate text-sm font-semibold text-foreground">
              {workspaceTitle}
            </h2>
          </div>
        )}

        <div className="flex items-center gap-1">
          {!isCollapsed && (
            <Button
              onClick={onCreateCanvas}
              disabled={createDisabled}
              className="h-8 w-8 rounded-md"
              size="icon"
              variant="ghost"
              title="New Canvas"
            >
              <Plus className="h-4 w-4" />
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
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {isLoading ? (
            <Card className="px-3 py-4 text-sm text-foreground/56" variant="base">
              Loading...
            </Card>
          ) : canvases.length === 0 ? (
            <Card className="px-3 py-4 text-sm text-foreground/56" variant="muted">
              No canvases yet.
            </Card>
          ) : (
            <div className="space-y-3">
              {canvases.map((canvas) => (
                <button
                  key={canvas.canvasId}
                  type="button"
                  onClick={() => onOpenCanvas?.(canvas.canvasId)}
                  className="w-full rounded-xl bg-card p-3 text-left text-foreground shadow-[inset_0_0_0_1px_rgb(var(--color-border)/0.12)] transition-[background-color,color,box-shadow] duration-fast hover:bg-card/88 hover:shadow-[inset_0_0_0_1px_rgb(var(--color-primary)/0.14)]"
                >
                  <div className="mb-3 aspect-[4/3] w-full rounded-lg bg-surface-container ring-1 ring-border/20 flex items-center justify-center overflow-hidden">
                    <div className="text-lg font-semibold text-foreground/45">
                      {getCanvasThumbnailLabel(canvas.title)}
                    </div>
                  </div>
                  <div className="truncate text-sm font-medium">
                    {canvas.title || 'Untitled Canvas'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
