import { CanvasEditorPage } from '@/features/editor/pages/CanvasEditorPage';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function CanvasPage({ params }: PageProps) {
  const { id } = await params;
  return <CanvasEditorPage canvasId={decodeURIComponent(id)} />;
}
