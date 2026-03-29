'use client';

import { useEditorStore } from '@/core/editor/model/editor-store';

export function TopToolbar() {
  const selectionCount = useEditorStore((state) => state.selection.ids.length);

  return (
    <header className="top-toolbar" data-testid="top-toolbar">
      <div className="top-toolbar__identity">
        <div className="top-toolbar__heading">
          <strong>Magam Canvas</strong>
          {selectionCount > 0 ? <span>{selectionCount} selected</span> : null}
        </div>
      </div>
    </header>
  );
}
