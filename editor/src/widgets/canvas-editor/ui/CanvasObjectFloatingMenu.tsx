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
const DRAWER_DIMENSIONS: Record<Exclude<OpenPanel, null>, { height: number; width: number }> = {
  shape: { width: 196, height: 154 },
  fill: { width: 248, height: 192 },
  border: { width: 220, height: 192 },
  more: { width: 248, height: 248 },
};

function TriggerButton({
  ariaControls,
  ariaExpanded,
  active,
  children,
  disabled = false,
  icon,
  label,
  onClick,
  triggerRef,
}: {
  ariaControls?: string;
  ariaExpanded?: boolean;
  active: boolean;
  children?: ReactNode;
  disabled?: boolean;
  icon?: EditorIconName;
  label: string;
  onClick: () => void;
  triggerRef?: (node: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      aria-label={label}
      aria-controls={ariaControls}
      aria-expanded={ariaExpanded}
      aria-haspopup="dialog"
      className={clsx('floating-object-menu__trigger', {
        'floating-object-menu__trigger--active': active,
      })}
      disabled={disabled}
      onClick={onClick}
      ref={triggerRef}
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
  const showPanel = useEditorStore((state) => state.showPanel);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRefs = useRef<Record<Exclude<OpenPanel, null>, HTMLButtonElement | null>>({
    shape: null,
    fill: null,
    border: null,
    more: null,
  });
  const lastActiveTrigger = useRef<Exclude<OpenPanel, null> | null>(null);
  const isSingleSelection = selectionCount === 1;
  const drawerId = openPanel ? `floating-object-menu-drawer-${openPanel}` : undefined;
  const drawerDimensions = openPanel ? DRAWER_DIMENSIONS[openPanel] : null;

  useEffect(() => {
    setOpenPanel(null);
  }, [primaryObject.id, selectionCount]);

  useEffect(() => {
    if (!openPanel || !lastActiveTrigger.current) {
      return;
    }
    const trigger = triggerRefs.current[lastActiveTrigger.current];
    if (trigger && document.activeElement === document.body) {
      trigger.focus();
    }
  }, [openPanel]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current || menuRef.current.contains(event.target as Node)) {
        return;
      }
      setOpenPanel((current) => {
        if (current && lastActiveTrigger.current) {
          queueMicrotask(() => {
            triggerRefs.current[lastActiveTrigger.current!]?.focus();
          });
        }
        return null;
      });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (openPanel && lastActiveTrigger.current) {
          triggerRefs.current[lastActiveTrigger.current]?.focus();
        }
        setOpenPanel(null);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [openPanel]);

  const position = useMemo(() => clampFloatingPosition({
    stageRect: {
      width: stageWidth,
      height: stageHeight,
    } as DOMRect,
    menuHeight: drawerDimensions ? drawerDimensions.height + 66 : 58,
    menuWidth: drawerDimensions ? drawerDimensions.width : 208,
    anchorX: selectionBounds.x + selectionBounds.width / 2,
    anchorY: selectionBounds.y - 18,
  }), [drawerDimensions, selectionBounds.height, selectionBounds.width, selectionBounds.x, selectionBounds.y, stageHeight, stageWidth]);

  const togglePanel = (panel: Exclude<OpenPanel, null>) => {
    commitActiveBodyEditor();
    lastActiveTrigger.current = panel;
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
      case 'more': {
        return (
          <>
            <div className="canvas-context-menu__group">
              <button
                aria-label="인스펙터 열기"
                className="canvas-context-menu__button"
                onClick={() => {
                  showPanel('inspector');
                  setOpenPanel(null);
                }}
                type="button"
              >
                <span className="canvas-context-menu__button-label">
                  <EditorIcon name="inspect" />
                  <span>인스펙터 열기</span>
                </span>
              </button>
            </div>
            <div className="canvas-context-menu__divider" />
            <CanvasObjectActionList onActionComplete={() => setOpenPanel(null)} />
          </>
        );
      }
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
          ariaControls={openPanel === 'shape' ? drawerId : undefined}
          ariaExpanded={openPanel === 'shape'}
          disabled={primaryObject.kind !== 'shape' || !isSingleSelection}
          icon="shape"
          label="모양"
          onClick={() => togglePanel('shape')}
          triggerRef={(node) => {
            triggerRefs.current.shape = node;
          }}
        />
        <TriggerButton
          active={openPanel === 'fill'}
          ariaControls={openPanel === 'fill' ? drawerId : undefined}
          ariaExpanded={openPanel === 'fill'}
          disabled={!isSingleSelection || primaryObject.kind === 'group'}
          label="채우기"
          onClick={() => togglePanel('fill')}
          triggerRef={(node) => {
            triggerRefs.current.fill = node;
          }}
        >
          <span
            className="floating-object-menu__swatch-preview"
            style={{ backgroundColor: primaryObject.fillColor }}
          />
        </TriggerButton>
        <TriggerButton
          active={openPanel === 'border'}
          ariaControls={openPanel === 'border' ? drawerId : undefined}
          ariaExpanded={openPanel === 'border'}
          disabled={!isSingleSelection || primaryObject.kind === 'group'}
          label="테두리"
          onClick={() => togglePanel('border')}
          triggerRef={(node) => {
            triggerRefs.current.border = node;
          }}
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
          ariaControls={openPanel === 'more' ? drawerId : undefined}
          ariaExpanded={openPanel === 'more'}
          disabled={!isSingleSelection}
          icon="more"
          label="더보기"
          onClick={() => togglePanel('more')}
          triggerRef={(node) => {
            triggerRefs.current.more = node;
          }}
        />
      </div>
      {panel ? (
        <div
          aria-label={`${openPanel} quick actions`}
          className={clsx('floating-object-menu__drawer', {
            'floating-object-menu__drawer--more': openPanel === 'more',
          })}
          id={drawerId}
          role="dialog"
          style={drawerDimensions ? { width: drawerDimensions.width } : undefined}
        >
          {panel}
        </div>
      ) : null}
    </div>
  );
}
