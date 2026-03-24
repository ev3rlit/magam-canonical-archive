'use client';

import React, { useMemo, useState } from 'react';
import { useGraphStore } from '@/store/graph';
import { pickWorkspaceRootPath } from '@/components/editor/desktopBridge';
import { getHostRuntime } from '@/features/host/renderer/createHostRuntime';
import { navigateToWorkspaceDetail } from '@/features/host/renderer/navigation';
import { DashboardSidebar } from '../components/DashboardSidebar';
import { DashboardHeader } from '../components/DashboardHeader';
import { WorkspaceCard } from '../components/WorkspaceCard';
import { WorkspaceListItem } from '../components/WorkspaceListItem';
import { FolderOpen } from 'lucide-react';
import { getWorkspaceCopy } from '../copy';

export function WorkspaceDashboardPage() {
  const copy = getWorkspaceCopy();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const hostRpc = useMemo(() => getHostRuntime().rpc, []);

  const {
    registeredWorkspaces,
    upsertWorkspaceFromProbe,
    setError,
  } = useGraphStore();

  const handleAddWorkspace = async () => {
    const rootPath = await pickWorkspaceRootPath({
      title: copy.dashboard.addWorkspaceDialogTitle,
    });
    if (!rootPath) return;

    try {
      const probe = await hostRpc.ensureWorkspace(rootPath);
      await upsertWorkspaceFromProbe(probe, { activate: true });
    } catch {
      setError({ message: copy.dashboard.addWorkspaceError });
    }
  };

  const handleWorkspaceClick = (id: string) => {
    navigateToWorkspaceDetail(id);
  };

  const filteredWorkspaces = registeredWorkspaces.filter(ws => 
    ws.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    ws.rootPath.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface text-on-surface font-inter">
      <DashboardSidebar />

      <main className="flex-1 relative w-full h-full overflow-y-auto p-12 bg-surface">
        <div className="max-w-6xl mx-auto space-y-8">
          <DashboardHeader
            title={copy.dashboard.title}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onAddAction={handleAddWorkspace}
            addLabel={copy.dashboard.addLabel}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
          />

          {registeredWorkspaces.length === 0 ? (
            <div className="py-32 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-surface-container-low flex items-center justify-center mb-2">
                <FolderOpen size={32} className="text-on-surface-variant opacity-50" />
              </div>
              <h2 className="font-manrope font-semibold text-title-lg text-on-surface">{copy.dashboard.emptyTitle}</h2>
              <p className="font-inter text-body-md text-on-surface-variant max-w-sm">
                {copy.dashboard.emptyBody}
              </p>
            </div>
          ) : filteredWorkspaces.length === 0 ? (
            <div className="py-24 text-center">
              <p className="text-on-surface-variant">{copy.dashboard.noResults(searchTerm)}</p>
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6' : 'flex flex-col gap-2'}>
              {filteredWorkspaces.map(workspace => 
                viewMode === 'grid' ? (
                  <WorkspaceCard
                    key={workspace.id}
                    workspace={workspace}
                    onClick={() => handleWorkspaceClick(workspace.id)}
                  />
                ) : (
                  <WorkspaceListItem
                    key={workspace.id}
                    workspace={workspace}
                    onClick={() => handleWorkspaceClick(workspace.id)}
                  />
                )
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
