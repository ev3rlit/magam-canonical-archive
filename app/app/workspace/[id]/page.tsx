import React from 'react';
import { WorkspaceDetailPage } from '@/features/workspace/pages/WorkspaceDetailPage';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <WorkspaceDetailPage workspaceId={id} />;
}
