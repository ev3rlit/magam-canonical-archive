'use client';

import { useEffect, useRef } from 'react';
import { clampFloatingPosition } from '@/core/editor/model/editor-geometry';
import { useEditorStore } from '@/core/editor/model/editor-store';
import type { EditorCanvasObject, EditorContextMenuState } from '@/core/editor/model/editor-types';
import { EditorIcon, type EditorIconName } from '@/shared/ui/EditorIcon';

function MenuButton({
  icon,
  label,
  onClick,
  danger = false,
}: {
  icon: EditorIconName;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      aria-label={label}
      className={`canvas-context-menu__button${danger ? ' canvas-context-menu__button--danger' : ''}`}
      onClick={onClick}
      title={label}
      type="button"
    >
      <EditorIcon name={icon} />
    </button>
  );
}

export function CanvasContextMenu({
  contextMenu,
  object,
  stageHeight,
  stageWidth,
}: {
  contextMenu: EditorContextMenuState;
  object: EditorCanvasObject;
  stageHeight: number;
  stageWidth: number;
}) {
  const deleteSelection = useEditorStore((state) => state.deleteSelection);
  const duplicateSelection = useEditorStore((state) => state.duplicateSelection);
  const bringSelectionToFront = useEditorStore((state) => state.bringSelectionToFront);
  const sendSelectionToBack = useEditorStore((state) => state.sendSelectionToBack);
  const updateSelectionPatch = useEditorStore((state) => state.updateSelectionPatch);
  const groupSelection = useEditorStore((state) => state.groupSelection);
  const ungroupSelection = useEditorStore((state) => state.ungroupSelection);
  const requestNameFocus = useEditorStore((state) => state.requestNameFocus);
  const showPanel = useEditorStore((state) => state.showPanel);
  const setContextMenu = useEditorStore((state) => state.setContextMenu);
  const selectionCount = useEditorStore((state) => state.selection.ids.length);
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
    menuHeight: 288,
    menuWidth: 228,
    anchorX: contextMenu.x + 114,
    anchorY: contextMenu.y + 14,
  });

  const closeAfter = (action: () => void) => {
    action();
    setContextMenu(null);
  };

  return (
    <div
      className="canvas-context-menu"
      ref={menuRef}
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <MenuButton icon="rename" label="Rename" onClick={() => closeAfter(() => requestNameFocus(object.id))} />
      <MenuButton icon="copy" label="Duplicate" onClick={() => closeAfter(() => duplicateSelection())} />
      <MenuButton icon="front" label="Bring to front" onClick={() => closeAfter(() => bringSelectionToFront())} />
      <MenuButton icon="back" label="Send to back" onClick={() => closeAfter(() => sendSelectionToBack())} />
      {object.kind === 'group' ? (
        <MenuButton icon="ungroup" label="Ungroup" onClick={() => closeAfter(() => ungroupSelection())} />
      ) : selectionCount > 1 ? (
        <MenuButton icon="group" label="Group" onClick={() => closeAfter(() => groupSelection())} />
      ) : null}
      <MenuButton
        icon={object.locked ? 'unlock' : 'lock'}
        label={object.locked ? 'Unlock' : 'Lock'}
        onClick={() => closeAfter(() => updateSelectionPatch({ locked: !object.locked }))}
      />
      <MenuButton icon="inspect" label="Open inspector" onClick={() => closeAfter(() => showPanel('inspector'))} />
      <MenuButton danger icon="delete" label="Delete" onClick={() => closeAfter(() => deleteSelection())} />
    </div>
  );
}
