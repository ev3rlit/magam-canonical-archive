'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useGraphStore } from '@/store/graph';
import { getHostRuntime } from '@/features/host/renderer/createHostRuntime';
import {
  navigateToDashboard,
  navigateToCanvas,
} from '@/features/host/renderer/navigation';
import { buildSidebarCanvases } from '@/components/editor/workspaceRegistry';
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
  const [isCanvasListLoading, setIsCanvasListLoading] = useState(false);
  const hostRpc = useMemo(() => getHostRuntime().rpc, []);

  const {
    registeredWorkspaces,
    workspaceCanvasesByWorkspaceId,
    setActiveWorkspaceId,
    setWorkspaceCanvases,
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

  const loadWorkspaceCanvases = useCallback(async (
    rootWorkspaceId: string,
    rootPath: string,
  ) => {
    setIsCanvasListLoading(true);
    try {
      const data = await hostRpc.listWorkspaceCanvases(rootPath);
      setWorkspaceCanvases(rootWorkspaceId, buildSidebarCanvases(rootPath, data.canvases));
    } catch (error) {
      console.error('[WorkspaceDetailPage] Failed to load canvases', {
        workspaceId: rootWorkspaceId,
        rootPath,
        error,
      });
      setError({
        message: '캔버스 목록을 불러오지 못했습니다.',
        type: 'WORKSPACE_CANVASES_LOAD_FAILED',
        details: error,
      });
    } finally {
      setIsCanvasListLoading(false);
    }
  }, [hostRpc, setError, setWorkspaceCanvases]);

  const handleCanvasClick = (targetCanvasId: string) => {
    navigateToCanvas(targetCanvasId);
  };

  const handleCreateCanvas = async () => {
    if (!activeWorkspace) return;
    try {
      const result = await hostRpc.createWorkspaceCanvas({ rootPath: activeWorkspace.rootPath });
      navigateToCanvas(result.canvasId);
    } catch {
      setError({ message: '캔버스 생성 실패' });
    }
  };

  const handleGoBack = () => {
    navigateToDashboard();
  };

  useEffect(() => {
    setSearchTerm('');
  }, [workspaceId]);

  useEffect(() => {
    if (!activeWorkspace) {
      return;
    }

    if (activeWorkspace.status !== 'ok') {
      setWorkspaceCanvases(activeWorkspace.id, []);
      return;
    }

    void loadWorkspaceCanvases(activeWorkspace.id, activeWorkspace.rootPath);
  }, [
    activeWorkspace?.id,
    activeWorkspace?.rootPath,
    activeWorkspace?.status,
    loadWorkspaceCanvases,
    setWorkspaceCanvases,
  ]);

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

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filteredCanvases = normalizedSearchTerm.length === 0
    ? workspaceCanvases
    : workspaceCanvases.filter((canvas) =>
      (canvas.title || '').toLowerCase().includes(normalizedSearchTerm)
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

          {isCanvasListLoading ? (
            <div className="py-24 text-center">
              <p className="text-on-surface-variant">캔버스 목록을 불러오는 중입니다.</p>
            </div>
          ) : filteredCanvases.length === 0 ? (
            <div className="py-24 text-center">
              <p className="text-on-surface-variant">
                {workspaceCanvases.length === 0
                  ? '아직 생성된 캔버스가 없습니다.'
                  : `"${searchTerm}" 검색 결과가 없습니다.`}
              </p>
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6' : 'flex flex-col gap-2'}>
              {filteredCanvases.map((canvas) =>
                viewMode === 'grid' ? (
                  <CanvasCard
                    key={canvas.canvasId}
                    canvas={canvas}
                    onClick={() => handleCanvasClick(canvas.canvasId)}
                  />
                ) : (
                  <CanvasListItem
                    key={canvas.canvasId}
                    canvas={canvas}
                    onClick={() => handleCanvasClick(canvas.canvasId)}
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
