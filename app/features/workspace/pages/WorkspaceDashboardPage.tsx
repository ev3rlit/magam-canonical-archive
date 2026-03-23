'use client';

import React, { useMemo, useState } from 'react';
import { useGraphStore } from '@/store/graph';
import { pickWorkspaceRootPath } from '@/components/editor/desktopBridge';
import { getHostRuntime } from '@/features/host/renderer/createHostRuntime';
import { DashboardSidebar } from '../components/DashboardSidebar';
import { DashboardHeader } from '../components/DashboardHeader';
import { WorkspaceCard } from '../components/WorkspaceCard';
import { WorkspaceListItem } from '../components/WorkspaceListItem';
import { FolderOpen } from 'lucide-react';

export function WorkspaceDashboardPage() {
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
      title: '워크스페이스 폴더 선택',
    });
    if (!rootPath) return;

    try {
      const probe = await hostRpc.ensureWorkspace(rootPath);
      upsertWorkspaceFromProbe(probe, { activate: true });
    } catch {
      setError({ message: '워크스페이스 추가 실패' });
    }
  };

  const handleWorkspaceClick = (id: string) => {
    if (typeof window !== 'undefined' && 'electron' in window) {
      window.location.hash = `/workspace/${id}`;
    } else {
      window.location.href = `/app/workspace/${id}`;
    }
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
            title="Workspaces"
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onAddAction={handleAddWorkspace}
            addLabel="New Workspace"
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
          />

          {registeredWorkspaces.length === 0 ? (
            <div className="py-32 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-surface-container-low flex items-center justify-center mb-2">
                <FolderOpen size={32} className="text-on-surface-variant opacity-50" />
              </div>
              <h2 className="font-manrope font-semibold text-title-lg text-on-surface">No workspaces yet</h2>
              <p className="font-inter text-body-md text-on-surface-variant max-w-sm">
                Connect a local folder to start creating your ethereal canvases.
              </p>
            </div>
          ) : filteredWorkspaces.length === 0 ? (
            <div className="py-24 text-center">
              <p className="text-on-surface-variant">No workspaces found matching "{searchTerm}".</p>
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
