import { CanvasEditorPage } from '@/features/editor/pages/CanvasEditorPage';

export default function CanvasPage({ params }: { params: { path: string[] } }) {
  const canvasPath = '/' + params.path.join('/');
  return <CanvasEditorPage canvasPath={canvasPath} />;
}
