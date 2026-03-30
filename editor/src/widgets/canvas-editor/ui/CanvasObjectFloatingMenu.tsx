'use client';

import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { OUTLINE_PRESET_TOKENS } from '@/core/editor/model/editor-appearance';
import { clampFloatingPosition } from '@/core/editor/model/editor-geometry';
import { useEditorStore } from '@/core/editor/model/editor-store';
import type { EditorBounds, EditorCanvasObject } from '@/core/editor/model/editor-types';
import { EditorIcon, type EditorIconName } from '@/shared/ui/EditorIcon';
import { CanvasObjectActionList } from '@/widgets/canvas-editor/ui/CanvasObjectActionList';
import { BorderStyleEditor, FillStyleEditor, ShapeStyleEditor } from '@/widgets/canvas-editor/ui/ObjectStyleEditors';

type OpenPanel = 'shape' | 'fill' | 'border' | 'more' | null;

function TriggerButton({
  active,
  children,
  disabled = false,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  children?: ReactNode;
  disabled?: boolean;
  icon?: EditorIconName;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={label}
      className={clsx('floating-object-menu__trigger', {
        'floating-object-menu__trigger--active': active,
      })}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      {children ?? (icon ? <EditorIcon name={icon} /> : null)}
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
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const commitActiveBodyEditor = useEditorStore((state) => state.commitActiveBodyEditor);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isSingleSelection = selectionCount === 1;

  useEffect(() => {
    setOpenPanel(null);
  }, [primaryObject.id, selectionCount]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current || menuRef.current.contains(event.target as Node)) {
        return;
      }
      setOpenPanel(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenPanel(null);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const position = useMemo(() => clampFloatingPosition({
    stageRect: {
      width: stageWidth,
      height: stageHeight,
    } as DOMRect,
    menuHeight: openPanel ? 360 : 58,
    menuWidth: openPanel === 'more' ? 248 : 280,
    anchorX: selectionBounds.x + selectionBounds.width / 2,
    anchorY: selectionBounds.y - 18,
  }), [openPanel, selectionBounds.height, selectionBounds.width, selectionBounds.x, selectionBounds.y, stageHeight, stageWidth]);

  const togglePanel = (panel: Exclude<OpenPanel, null>) => {
    commitActiveBodyEditor();
    setOpenPanel((current) => current === panel ? null : panel);
  };

  const panel = (() => {
    if (!isSingleSelection || !openPanel) {
      return null;
    }

    switch (openPanel) {
      case 'shape':
        return primaryObject.kind === 'shape' ? <ShapeStyleEditor mode="compact" object={primaryObject} /> : null;
      case 'fill':
        return <FillStyleEditor mode="compact" object={primaryObject} />;
      case 'border':
        return <BorderStyleEditor mode="compact" object={primaryObject} />;
      case 'more':
        return <CanvasObjectActionList onActionComplete={() => setOpenPanel(null)} />;
    }
  })();

  return (
    <div
      className="floating-object-menu"
      ref={menuRef}
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <div className="floating-object-menu__bar">
        <TriggerButton
          active={openPanel === 'shape'}
          disabled={primaryObject.kind !== 'shape' || !isSingleSelection}
          icon="shape"
          label="모양"
          onClick={() => togglePanel('shape')}
        />
        <TriggerButton
          active={openPanel === 'fill'}
          disabled={!isSingleSelection || primaryObject.kind === 'group'}
          label="채우기"
          onClick={() => togglePanel('fill')}
        >
          <span
            className="floating-object-menu__swatch-preview"
            style={{ backgroundColor: primaryObject.fillColor }}
          />
        </TriggerButton>
        <TriggerButton
          active={openPanel === 'border'}
          disabled={!isSingleSelection || primaryObject.kind === 'group'}
          label="테두리"
          onClick={() => togglePanel('border')}
        >
          <span
            className={clsx(
              'floating-object-menu__outline-preview',
              `floating-object-menu__outline-preview--${primaryObject.outlinePreset}`,
            )}
            style={{
              borderColor: primaryObject.outlineColor,
              borderStyle: OUTLINE_PRESET_TOKENS[primaryObject.outlinePreset].style,
              borderWidth: OUTLINE_PRESET_TOKENS[primaryObject.outlinePreset].width,
            }}
          />
        </TriggerButton>
        <TriggerButton
          active={openPanel === 'more'}
          disabled={!isSingleSelection}
          icon="more"
          label="더보기"
          onClick={() => togglePanel('more')}
        />
      </div>
      {panel ? (
        <div
          className={clsx('floating-object-menu__drawer', {
            'floating-object-menu__drawer--more': openPanel === 'more',
          })}
        >
          {panel}
        </div>
      ) : null}
    </div>
  );
}
