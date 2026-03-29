'use client';

import { clampFloatingPosition } from '@/core/editor/model/editor-geometry';
import { quickPropertyLabel, useEditorStore } from '@/core/editor/model/editor-store';
import type { EditorBounds, EditorCanvasObject } from '@/core/editor/model/editor-types';
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
      className={`floating-object-menu__button${danger ? ' floating-object-menu__button--danger' : ''}`}
      onClick={onClick}
      title={label}
      type="button"
    >
      <EditorIcon name={icon} />
    </button>
  );
}

export function CanvasObjectFloatingMenu({
  primaryObject,
  selectionBounds,
  selectionCount,
  stageHeight,
  stageWidth,
}: {
  primaryObject: EditorCanvasObject;
  selectionBounds: EditorBounds;
  selectionCount: number;
  stageHeight: number;
  stageWidth: number;
}) {
  const bringSelectionToFront = useEditorStore((state) => state.bringSelectionToFront);
  const cycleQuickProperty = useEditorStore((state) => state.cycleQuickProperty);
  const deleteSelection = useEditorStore((state) => state.deleteSelection);
  const duplicateSelection = useEditorStore((state) => state.duplicateSelection);
  const groupSelection = useEditorStore((state) => state.groupSelection);
  const showPanel = useEditorStore((state) => state.showPanel);
  const sendSelectionToBack = useEditorStore((state) => state.sendSelectionToBack);
  const ungroupSelection = useEditorStore((state) => state.ungroupSelection);

  const singleMenu = selectionCount === 1;
  const position = clampFloatingPosition({
    stageRect: {
      width: stageWidth,
      height: stageHeight,
    } as DOMRect,
    menuHeight: 58,
    menuWidth: 320,
    anchorX: selectionBounds.x + selectionBounds.width / 2,
    anchorY: selectionBounds.y - 16,
  });

  return (
    <div
      className="floating-object-menu"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      {singleMenu ? (
        <>
          <MenuButton
            icon="property"
            label={quickPropertyLabel(primaryObject) ?? 'Quick property'}
            onClick={() => cycleQuickProperty(primaryObject.id)}
          />
          <MenuButton icon="copy" label="Duplicate" onClick={() => duplicateSelection()} />
          <MenuButton icon="front" label="Bring to front" onClick={() => bringSelectionToFront()} />
          <MenuButton icon="back" label="Send to back" onClick={() => sendSelectionToBack()} />
          <MenuButton icon="inspect" label="Open inspector" onClick={() => showPanel('inspector')} />
          <MenuButton danger icon="delete" label="Delete" onClick={() => deleteSelection()} />
        </>
      ) : (
        <>
          <MenuButton icon="group" label="Group selection" onClick={() => groupSelection()} />
          <MenuButton icon="ungroup" label="Ungroup selection" onClick={() => ungroupSelection()} />
          <MenuButton icon="front" label="Bring to front" onClick={() => bringSelectionToFront()} />
          <MenuButton icon="back" label="Send to back" onClick={() => sendSelectionToBack()} />
          <MenuButton icon="inspect" label="Open inspector" onClick={() => showPanel('inspector')} />
          <MenuButton danger icon="delete" label="Delete" onClick={() => deleteSelection()} />
        </>
      )}
    </div>
  );
}
