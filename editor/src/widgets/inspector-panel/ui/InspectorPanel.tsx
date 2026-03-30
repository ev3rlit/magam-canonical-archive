'use client';

import clsx from 'clsx';
import { useEffect, useRef, type Ref } from 'react';
import { useEditorStore } from '@/core/editor/model/editor-store';
import type { EditorCanvasObject, EditorFillPreset } from '@/core/editor/model/editor-types';
import { WidgetBase } from '@/shared/ui/WidgetBase';

const FILL_OPTIONS: EditorFillPreset[] = ['iris', 'sky', 'mint', 'amber', 'blush', 'slate'];

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
  const blockSelection = useEditorStore((state) => state.overlays.blockSelection);
  const clearFocusRequest = useEditorStore((state) => state.clearFocusRequest);
  const insertBlock = useEditorStore((state) => state.insertBlock);
  const selectBlock = useEditorStore((state) => state.selectBlock);
  const startBlockEdit = useEditorStore((state) => state.startBlockEdit);
  const updateObjectField = useEditorStore((state) => state.updateObjectField);
  const updateObjectPatch = useEditorStore((state) => state.updateObjectPatch);
  const ungroupSelection = useEditorStore((state) => state.ungroupSelection);
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  const selectedBlock = blockSelection?.objectId === object.id
    ? object.contentBlocks.find((block) => block.id === blockSelection.blockId) ?? null
    : null;

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
      </section>
      <section className="inspector-card">
        <div className="inspector-card__header">
          <h3>Details</h3>
        </div>
        {object.kind !== 'group' ? (
          <>
            <p className="inspector-copy">
              {object.contentBlocks.length} block{object.contentBlocks.length === 1 ? '' : 's'}
              {selectedBlock ? ` selected: ${selectedBlock.blockType}` : ''}
            </p>
            <div className="inspector-actions">
              <button
                className="inspector-action"
                onClick={() => insertBlock(object.id, 'markdown', selectedBlock?.id ?? null)}
                type="button"
              >
                Add markdown
              </button>
              <button
                className="inspector-action"
                onClick={() => insertBlock(object.id, 'text', selectedBlock?.id ?? null)}
                type="button"
              >
                Add text
              </button>
              <button
                className="inspector-action"
                onClick={() => insertBlock(object.id, 'image', selectedBlock?.id ?? null)}
                type="button"
              >
                Add image
              </button>
              {object.contentBlocks[0] ? (
                <button
                  className="inspector-action"
                  onClick={() => {
                    selectBlock(object.id, selectedBlock?.id ?? object.contentBlocks[0]!.id);
                    startBlockEdit(object.id, selectedBlock?.id ?? object.contentBlocks[0]!.id);
                  }}
                  type="button"
                >
                  Edit on canvas
                </button>
              ) : null}
            </div>
          </>
        ) : null}
        {object.kind !== 'group' ? (
          <label className="inspector-field">
            <span className="inspector-field__label">Fill preset</span>
            <select
              className="inspector-field__input"
              onChange={(event) => updateObjectPatch(object.id, { fillPreset: event.target.value as EditorFillPreset })}
              value={object.fillPreset}
            >
              {FILL_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
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
