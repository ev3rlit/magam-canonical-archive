'use client';

import clsx from 'clsx';
import { useEffect, useRef, type Ref } from 'react';
import { getBodyPlainText } from '@/core/editor/model/editor-body';
import { useEditorStore } from '@/core/editor/model/editor-store';
import type { EditorCanvasObject } from '@/core/editor/model/editor-types';
import { WidgetBase } from '@/shared/ui/WidgetBase';
import {
  BorderStyleEditor,
  FillStyleEditor,
  ShapeStyleEditor,
} from '@/widgets/canvas-editor/ui/ObjectStyleEditors';

function PropertyField({
  label,
  value,
  onChange,
  type = 'text',
  inputRef,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: 'text' | 'number';
  inputRef?: Ref<HTMLInputElement>;
}) {
  return (
    <label className="inspector-field">
      <span className="inspector-field__label">{label}</span>
      <input
        className="inspector-field__input"
        onChange={(event) => onChange(event.target.value)}
        ref={inputRef}
        type={type}
        value={value}
      />
    </label>
  );
}

function SingleSelectionInspector({ object }: { object: EditorCanvasObject }) {
  const focusRequest = useEditorStore((state) => state.overlays.focusRequest);
  const clearFocusRequest = useEditorStore((state) => state.clearFocusRequest);
  const openBodyEditor = useEditorStore((state) => state.openBodyEditor);
  const updateObjectField = useEditorStore((state) => state.updateObjectField);
  const updateObjectPatch = useEditorStore((state) => state.updateObjectPatch);
  const ungroupSelection = useEditorStore((state) => state.ungroupSelection);
  const fillSectionRef = useRef<HTMLDivElement | null>(null);
  const borderSectionRef = useRef<HTMLDivElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (
      focusRequest &&
      focusRequest.objectId === object.id &&
      focusRequest.field === 'name' &&
      nameInputRef.current
    ) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
      clearFocusRequest();
    }
    if (
      focusRequest &&
      focusRequest.objectId === object.id &&
      focusRequest.field === 'fill' &&
      fillSectionRef.current
    ) {
      fillSectionRef.current.focus();
      fillSectionRef.current.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
      clearFocusRequest();
    }
    if (
      focusRequest &&
      focusRequest.objectId === object.id &&
      focusRequest.field === 'border' &&
      borderSectionRef.current
    ) {
      borderSectionRef.current.focus();
      borderSectionRef.current.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
      clearFocusRequest();
    }
  }, [clearFocusRequest, focusRequest, object.id]);

  return (
    <div className="inspector-stack">
      <section className="inspector-card">
        <div className="inspector-card__header">
          <h3>Selection</h3>
        </div>
        <PropertyField
          inputRef={nameInputRef}
          label="Name"
          onChange={(value) => updateObjectField(object.id, 'name', value)}
          value={object.name}
        />
        <div className="inspector-toggle-grid">
          <button
            className={clsx('inspector-toggle', {
              'inspector-toggle--active': object.visible,
            })}
            onClick={() => updateObjectPatch(object.id, { visible: !object.visible })}
            type="button"
          >
            {object.visible ? 'Visible' : 'Hidden'}
          </button>
          <button
            className={clsx('inspector-toggle', {
              'inspector-toggle--active': object.locked,
            })}
            onClick={() => updateObjectPatch(object.id, { locked: !object.locked })}
            type="button"
          >
            {object.locked ? 'Locked' : 'Unlocked'}
          </button>
        </div>
      </section>
      <section className="inspector-card">
        <div className="inspector-card__header">
          <h3>Geometry</h3>
        </div>
        <div className="inspector-grid">
          <PropertyField
            label="X"
            onChange={(value) => updateObjectField(object.id, 'x', value)}
            type="number"
            value={object.x}
          />
          <PropertyField
            label="Y"
            onChange={(value) => updateObjectField(object.id, 'y', value)}
            type="number"
            value={object.y}
          />
          <PropertyField
            label="Width"
            onChange={(value) => updateObjectField(object.id, 'width', value)}
            type="number"
            value={object.width}
          />
          <PropertyField
            label="Height"
            onChange={(value) => updateObjectField(object.id, 'height', value)}
            type="number"
            value={object.height}
          />
        </div>
        <PropertyField
          label="Z index"
          onChange={(value) => updateObjectField(object.id, 'zIndex', value)}
          type="number"
          value={object.zIndex}
        />
        <PropertyField
          label="Rotation"
          onChange={(value) => updateObjectField(object.id, 'rotation', value)}
          type="number"
          value={object.rotation}
        />
      </section>
      <section className="inspector-card">
        <div className="inspector-card__header">
          <h3>Details</h3>
        </div>
        {object.kind !== 'group' ? (
          <>
            <p className="inspector-copy">
              {object.body.content.length} document block{object.body.content.length === 1 ? '' : 's'}
            </p>
            <p className="inspector-copy">{getBodyPlainText(object.body) || 'Empty body'}</p>
            <button className="inspector-action" onClick={() => openBodyEditor(object.id)} type="button">
              Edit on canvas
            </button>
          </>
        ) : null}
        {object.kind === 'group' ? (
          <button
            className="inspector-action"
            onClick={() => ungroupSelection()}
            type="button"
          >
            Ungroup children
          </button>
        ) : null}
      </section>
      {object.kind !== 'group' ? (
        <section className="inspector-card">
          <div className="inspector-card__header">
            <h3>스타일</h3>
          </div>
          <div className="inspector-appearance">
            {object.kind === 'shape' ? <ShapeStyleEditor mode="panel" object={object} /> : null}
            <div className="inspector-focus-target" ref={fillSectionRef} tabIndex={-1}>
              <FillStyleEditor mode="panel" object={object} />
            </div>
            <div className="inspector-focus-target" ref={borderSectionRef} tabIndex={-1}>
              <BorderStyleEditor mode="panel" object={object} />
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function MultiSelectionInspector({ objects }: { objects: EditorCanvasObject[] }) {
  const updateSelectionPatch = useEditorStore((state) => state.updateSelectionPatch);
  const groupSelection = useEditorStore((state) => state.groupSelection);
  const ungroupSelection = useEditorStore((state) => state.ungroupSelection);
  const bringSelectionToFront = useEditorStore((state) => state.bringSelectionToFront);
  const sendSelectionToBack = useEditorStore((state) => state.sendSelectionToBack);
  const deleteSelection = useEditorStore((state) => state.deleteSelection);

  const allVisible = objects.every((object) => object.visible);
  const allLocked = objects.every((object) => object.locked);
  const kinds = [...new Set(objects.map((object) => object.kind))];

  return (
    <div className="inspector-stack">
      <section className="inspector-card">
        <div className="inspector-card__header">
          <h3>Multi selection</h3>
        </div>
        <p className="inspector-copy">{objects.length} objects selected: {kinds.join(', ')}</p>
        <div className="inspector-toggle-grid">
          <button
            className={clsx('inspector-toggle', {
              'inspector-toggle--active': allVisible,
            })}
            onClick={() => updateSelectionPatch({ visible: !allVisible })}
            type="button"
          >
            {allVisible ? 'Hide selection' : 'Show selection'}
          </button>
          <button
            className={clsx('inspector-toggle', {
              'inspector-toggle--active': allLocked,
            })}
            onClick={() => updateSelectionPatch({ locked: !allLocked })}
            type="button"
          >
            {allLocked ? 'Unlock selection' : 'Lock selection'}
          </button>
        </div>
      </section>
      <section className="inspector-card">
        <div className="inspector-actions">
          <button className="inspector-action" onClick={() => groupSelection()} type="button">
            Group
          </button>
          <button className="inspector-action" onClick={() => ungroupSelection()} type="button">
            Ungroup
          </button>
          <button className="inspector-action" onClick={() => bringSelectionToFront()} type="button">
            Bring front
          </button>
          <button className="inspector-action" onClick={() => sendSelectionToBack()} type="button">
            Send back
          </button>
          <button className="inspector-action inspector-action--danger" onClick={() => deleteSelection()} type="button">
            Delete
          </button>
        </div>
      </section>
    </div>
  );
}

export function InspectorPanel() {
  const selection = useEditorStore((state) => state.selection);
  const objects = useEditorStore((state) => state.scene.objects);
  const selectedObjects = objects.filter((object) => selection.ids.includes(object.id));
  const primaryObject = selectedObjects.find((object) => object.id === selection.primaryId) ?? selectedObjects[0] ?? null;

  return (
    <WidgetBase
      collapsible
      entryDelayMs={220}
      panelId="inspector"
      side="right"
      subtitle={selectedObjects.length > 0 ? 'Quick edits for the current selection' : undefined}
      title="Inspector"
    >
      <div data-testid="inspector-panel">
        {selectedObjects.length === 1 && primaryObject ? (
          <SingleSelectionInspector object={primaryObject} />
        ) : null}
        {selectedObjects.length > 1 ? (
          <MultiSelectionInspector objects={selectedObjects} />
        ) : null}
      </div>
    </WidgetBase>
  );
}
