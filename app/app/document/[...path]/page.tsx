import { CanvasEditorPage } from '@/features/editor/pages/CanvasEditorPage';

export default function DocumentPage({ params }: { params: { path: string[] } }) {
  const filePath = '/' + params.path.join('/');
  return <CanvasEditorPage documentPath={filePath} />;
}
