'use client';

import { CanvasEditorPage } from '@/features/editor/pages/CanvasEditorPage';

export default function CanvasPage({ params }: { params: { id: string } }) {
  return <CanvasEditorPage canvasId={decodeURIComponent(params.id)} />;
}
