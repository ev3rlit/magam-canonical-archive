'use client';

import clsx from 'clsx';
import { useEditorStore } from '@/core/editor/model/editor-store';
import { EditorIcon, type EditorIconName } from '@/shared/ui/EditorIcon';

interface ActionButtonProps {
  danger?: boolean;
  disabled?: boolean;
  icon: EditorIconName;
  label: string;
  onClick: () => void;
  shortcut?: string;
}

function ActionButton({
  danger = false,
  disabled = false,
  icon,
  label,
  onClick,
  shortcut,
}: ActionButtonProps) {
  return (
    <button
      aria-label={label}
      className={clsx('canvas-context-menu__button', {
        'canvas-context-menu__button--danger': danger,
      })}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      <span className="canvas-context-menu__button-label">
        <EditorIcon name={icon} />
        <span>{label}</span>
      </span>
      {shortcut ? <span className="canvas-context-menu__button-shortcut">{shortcut}</span> : null}
    </button>
  );
}

export function CanvasObjectActionList({
  onActionComplete,
  showShortcuts = false,
}: {
  onActionComplete?: () => void;
  showShortcuts?: boolean;
}) {
  const bringSelectionForward = useEditorStore((state) => state.bringSelectionForward);
  const bringSelectionToFront = useEditorStore((state) => state.bringSelectionToFront);
  const copySelection = useEditorStore((state) => state.copySelection);
  const deleteSelection = useEditorStore((state) => state.deleteSelection);
  const pasteClipboard = useEditorStore((state) => state.pasteClipboard);
  const sendSelectionBackward = useEditorStore((state) => state.sendSelectionBackward);
  const sendSelectionToBack = useEditorStore((state) => state.sendSelectionToBack);
  const canPaste = useEditorStore((state) => state.clipboard.rootIds.length > 0);

  const run = (action: () => void) => {
    action();
    onActionComplete?.();
  };

  return (
    <>
      <div className="canvas-context-menu__group">
        <ActionButton
          icon="copy"
          label="복사"
          onClick={() => run(() => copySelection())}
          shortcut={showShortcuts ? 'Mod+C' : undefined}
        />
        <ActionButton
          disabled={!canPaste}
          icon="paste"
          label="붙여넣기"
          onClick={() => run(() => pasteClipboard())}
          shortcut={showShortcuts ? 'Mod+V' : undefined}
        />
      </div>
      <div className="canvas-context-menu__divider" />
      <div className="canvas-context-menu__group">
        <ActionButton danger icon="delete" label="삭제" onClick={() => run(() => deleteSelection())} />
      </div>
      <div className="canvas-context-menu__divider" />
      <div className="canvas-context-menu__group">
        <ActionButton icon="front" label="맨앞으로" onClick={() => run(() => bringSelectionToFront())} />
        <ActionButton icon="forward" label="앞으로" onClick={() => run(() => bringSelectionForward())} />
        <ActionButton icon="backward" label="뒤로" onClick={() => run(() => sendSelectionBackward())} />
        <ActionButton icon="back" label="맨뒤로" onClick={() => run(() => sendSelectionToBack())} />
      </div>
    </>
  );
}
