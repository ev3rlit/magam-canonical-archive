'use client';

import React, { useEffect, useCallback, useMemo, useState } from 'react';
import { getHostRuntime } from '@/features/host/renderer';
import { useGraphStore } from '@/store/graph';
import { FolderOpen, Loader2, RefreshCw, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { FolderTreeItem } from './FolderTreeItem';
import { cn } from '@/utils/cn';

interface SidebarProps {
  onOpenFile?: (filePath: string) => boolean | void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onOpenFile }) => {
  const { fileTree, files, setFileTree } = useGraphStore();
  const rpcClient = useMemo(() => getHostRuntime().rpc, []);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Load file tree from API
  const loadFileTree = useCallback(async () => {
    try {
      const data = await rpcClient.getFileTree();
      if (data.tree) {
        setFileTree(data.tree);
      }
    } catch (error) {
      console.error('Failed to load file tree:', error);
    }
  }, [rpcClient, setFileTree]);

  // Initial load
  useEffect(() => {
    loadFileTree();
  }, [loadFileTree]);

  return (
    <aside
      className={cn(
        "flex-shrink-0 border-r border-slate-200 bg-gray-50 dark:border-slate-800 dark:bg-slate-900 flex flex-col h-full transition-all duration-300 ease-in-out",
        isCollapsed ? "w-12" : "w-64"
      )}
    >
      <div className={cn(
        "p-3 border-b border-slate-200 dark:border-slate-800 flex items-center",
        isCollapsed ? "justify-center" : "justify-between"
      )}>
        {!isCollapsed && (
          <div className="flex items-center gap-2 overflow-hidden">
            <FolderOpen className="w-4 h-4 text-slate-500 dark:text-slate-400 flex-shrink-0" />
            <h2 className="font-semibold text-sm text-slate-700 dark:text-slate-200 truncate">
              {fileTree?.name || 'Workspace'}
            </h2>
          </div>
        )}

        <div className="flex items-center gap-1">
          {!isCollapsed && (
            <button
              onClick={loadFileTree}
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
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
        <div className="flex-1 overflow-y-auto py-1">
          {!fileTree ? (
            <div className="px-4 py-8 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin opacity-30" />
              <span className="text-xs">Loading...</span>
            </div>
          ) : fileTree.children && fileTree.children.length > 0 ? (
            <div>
              {/* Render root folder name as header */}
              <div className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
                {fileTree.name} · {files.length} docs
              </div>
              {/* Render children */}
              {fileTree.children.map((child) => (
                <FolderTreeItem
                  key={child.path}
                  node={child}
                  depth={0}
                  onOpenFile={onOpenFile}
                />
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-slate-400 text-xs">
              No .tsx files found
            </div>
          )}
        </div>
      )}

      <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex justify-center">
        {!isCollapsed ? (
          <div className="text-xs text-slate-400 dark:text-slate-500 truncate">
            Canvas-first document loop
          </div>
        ) : (
          <div className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700" />
        )}
      </div>
    </aside>
  );
};
