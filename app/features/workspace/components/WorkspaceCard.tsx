import React from 'react';
import type { SidebarWorkspaceEntry } from '@/components/ui/Sidebar';
import { getWorkspaceCopy } from '../copy';

interface WorkspaceCardProps {
  workspace: SidebarWorkspaceEntry;
  onClick: () => void;
}

export function WorkspaceCard({ workspace, onClick }: WorkspaceCardProps) {
  const isOk = workspace.status === 'ok';
  const copy = getWorkspaceCopy();

  return (
    <div
      onClick={onClick}
      className={`p-5 cursor-pointer bg-surface-container rounded-2xl shadow-[0_8px_32px_rgba(44,47,48,0.06)] border border-on-surface/10 hover:border-primary/30 transition-all group flex flex-col gap-3 relative overflow-hidden ${
        isOk ? 'hover:shadow-[0_12px_48px_rgba(44,47,48,0.1)] hover:-translate-y-1' : 'opacity-70'
      }`}
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-primary-container opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-xl bg-surface-container-low flex items-center justify-center text-primary font-manrope font-bold text-lg">
          {workspace.name.charAt(0).toUpperCase()}
        </div>
        {!isOk && (
          <span className="text-[10px] uppercase font-bold text-red-600 bg-red-100 px-2 py-1 rounded-md">{copy.sidebar.errorBadge}</span>
        )}
      </div>

      <div className="mt-2">
        <h3 className="font-manrope font-semibold text-lg text-on-surface group-hover:text-primary transition-colors line-clamp-1">
          {workspace.name}
        </h3>
        <p className="font-inter text-xs text-on-surface-variant truncate mt-1">
          {workspace.rootPath}
        </p>
      </div>
    </div>
  );
}
