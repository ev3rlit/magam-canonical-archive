'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useGraphStore } from '@/store/graph';
import { getHostRuntime } from '@/features/host/renderer/createHostRuntime';
import { DashboardSidebar } from '../components/DashboardSidebar';
import { DashboardHeader } from '../components/DashboardHeader';
import { CanvasCard } from '../components/CanvasCard';
import { CanvasListItem } from '../components/CanvasListItem';
import type { SidebarDocumentEntry } from '@/components/ui/Sidebar';
import { Button } from '@/components/ui/Button';
import { ArrowLeft } from 'lucide-react';

export function WorkspaceDetailPage({ workspaceId }: { workspaceId: string }) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const hostRpc = useMemo(() => getHostRuntime().rpc, []);

  const {
    registeredWorkspaces,
    workspaceDocumentsByWorkspaceId,
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

  const workspaceDocuments = useMemo<SidebarDocumentEntry[]>(
    () => (workspaceId ? workspaceDocumentsByWorkspaceId[workspaceId] ?? [] : []),
    [workspaceId, workspaceDocumentsByWorkspaceId],
  );

  const handleDocumentClick = (path: string) => {
    if (typeof window !== 'undefined' && 'electron' in window) {
      window.location.hash = `/document/${encodeURIComponent(path)}`;
    } else {
      window.location.href = `/app/document/${encodeURIComponent(path)}`;
    }
  };

  const handleCreateDocument = async () => {
    if (!activeWorkspace) return;
    try {
      const result = await hostRpc.createWorkspaceDocument({ rootPath: activeWorkspace.rootPath });
      if (typeof window !== 'undefined' && 'electron' in window) {
        window.location.hash = `/document/${encodeURIComponent(result.filePath)}`;
      } else {
        window.location.href = `/app/document/${encodeURIComponent(result.filePath)}`;
      }
    } catch {
      setError({ message: '캔버스 생성 실패' });
    }
  };

  const handleGoBack = () => {
    if (typeof window !== 'undefined' && 'electron' in window) {
      window.location.hash = ``;
    } else {
      window.location.href = `/app`;
    }
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

  const filteredDocuments = workspaceDocuments.filter(doc => 
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
            onAddAction={handleCreateDocument}
            addLabel="New Canvas"
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
          />

          {filteredDocuments.length === 0 ? (
            <div className="py-24 text-center">
              <p className="text-on-surface-variant">
                {workspaceDocuments.length === 0 
                  ? "아직 생성된 캔버스가 없습니다." 
                  : `"${searchTerm}" 검색 결과가 없습니다.`}
              </p>
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6' : 'flex flex-col gap-2'}>
              {filteredDocuments.map(doc => 
                viewMode === 'grid' ? (
                  <CanvasCard
                    key={doc.absolutePath}
                    document={doc}
                    onClick={() => handleDocumentClick(doc.absolutePath)}
                  />
                ) : (
                  <CanvasListItem
                    key={doc.absolutePath}
                    document={doc}
                    onClick={() => handleDocumentClick(doc.absolutePath)}
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
