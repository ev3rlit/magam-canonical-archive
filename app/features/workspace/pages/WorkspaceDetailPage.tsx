'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useGraphStore } from '@/store/graph';
import { getHostRuntime } from '@/features/host/renderer/createHostRuntime';
import {
  navigateToDashboard,
  navigateToCanvas,
  navigateToWorkspaceCanvas,
} from '@/features/host/renderer/navigation';
import { DashboardSidebar } from '../components/DashboardSidebar';
import { DashboardHeader } from '../components/DashboardHeader';
import { CanvasCard } from '../components/CanvasCard';
import { CanvasListItem } from '../components/CanvasListItem';
import type { SidebarCanvasEntry } from '@/components/ui/Sidebar';
import { Button } from '@/components/ui/Button';
import { ArrowLeft } from 'lucide-react';

export function WorkspaceDetailPage({ workspaceId }: { workspaceId: string }) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const hostRpc = useMemo(() => getHostRuntime().rpc, []);

  const {
    registeredWorkspaces,
    workspaceCanvasesByWorkspaceId,
    setActiveWorkspaceId,
    setError,
  } = useGraphStore();

  useEffect(() => {
    void setActiveWorkspaceId(workspaceId);
  }, [workspaceId, setActiveWorkspaceId]);

  const activeWorkspace = useMemo(
    () => registeredWorkspaces.find((workspace) => workspace.id === workspaceId) ?? null,
    [workspaceId, registeredWorkspaces],
  );

  const workspaceCanvases = useMemo<SidebarCanvasEntry[]>(
    () => (workspaceId ? workspaceCanvasesByWorkspaceId[workspaceId] ?? [] : []),
    [workspaceId, workspaceCanvasesByWorkspaceId],
  );

  const handleCanvasClick = (path: string) => {
    navigateToCanvas(path);
  };

  const handleCreateCanvas = async () => {
    if (!activeWorkspace) return;
    try {
      const result = await hostRpc.createWorkspaceCanvas({ rootPath: activeWorkspace.rootPath });
      navigateToWorkspaceCanvas(activeWorkspace.rootPath, result);
    } catch {
      setError({ message: '캔버스 생성 실패' });
    }
  };

  const handleGoBack = () => {
    navigateToDashboard();
  };

  if (!activeWorkspace) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-surface text-on-surface">
        <div className="text-center space-y-4">
          <p>Workspace not found.</p>
          <Button onClick={handleGoBack}>Return to Dashboard</Button>
        </div>
      </div>
    );
  }

  const filteredCanvases = workspaceCanvases.filter(doc => 
    (doc.title || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (doc.relativePath || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-surface text-on-surface font-inter">
      <DashboardSidebar />

      <main className="flex-1 relative w-full h-full overflow-y-auto p-12 bg-surface">
        <div className="max-w-6xl mx-auto space-y-6">
          <button 
            onClick={handleGoBack}
            className="flex items-center text-sm font-medium text-on-surface-variant hover:text-primary transition-colors mb-2"
          >
            <ArrowLeft size={16} className="mr-1" /> Back to Workspaces
          </button>

          <DashboardHeader
            title={activeWorkspace.name}
            subtitle={activeWorkspace.rootPath}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onAddAction={handleCreateCanvas}
            addLabel="New Canvas"
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
          />

          {filteredCanvases.length === 0 ? (
            <div className="py-24 text-center">
              <p className="text-on-surface-variant">
                {workspaceCanvases.length === 0 
                  ? "아직 생성된 캔버스가 없습니다." 
                  : `"${searchTerm}" 검색 결과가 없습니다.`}
              </p>
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6' : 'flex flex-col gap-2'}>
              {filteredCanvases.map(doc => 
                viewMode === 'grid' ? (
                  <CanvasCard
                    key={doc.absolutePath}
                    canvas={doc}
                    onClick={() => handleCanvasClick(doc.absolutePath)}
                  />
                ) : (
                  <CanvasListItem
                    key={doc.absolutePath}
                    canvas={doc}
                    onClick={() => handleCanvasClick(doc.absolutePath)}
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
