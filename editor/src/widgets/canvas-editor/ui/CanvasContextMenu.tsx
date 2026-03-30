'use client';

import { useEffect, useRef } from 'react';
import { clampFloatingPosition } from '@/core/editor/model/editor-geometry';
import { useEditorStore } from '@/core/editor/model/editor-store';
import type { EditorContextMenuState } from '@/core/editor/model/editor-types';
import { CanvasObjectActionList } from '@/widgets/canvas-editor/ui/CanvasObjectActionList';

export function CanvasContextMenu({
  contextMenu,
  stageHeight,
  stageWidth,
}: {
  contextMenu: EditorContextMenuState;
  stageHeight: number;
  stageWidth: number;
}) {
  const setContextMenu = useEditorStore((state) => state.setContextMenu);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current || menuRef.current.contains(event.target as Node)) {
        return;
      }
      setContextMenu(null);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [setContextMenu]);

  const position = clampFloatingPosition({
    stageRect: {
      width: stageWidth,
      height: stageHeight,
    } as DOMRect,
    menuHeight: 356,
    menuWidth: 248,
    anchorX: contextMenu.x + 124,
    anchorY: contextMenu.y + 12,
  });

  return (
    <div
      className="canvas-context-menu"
      ref={menuRef}
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <CanvasObjectActionList
        onActionComplete={() => setContextMenu(null)}
        showShortcuts
      />
    </div>
  );
}
