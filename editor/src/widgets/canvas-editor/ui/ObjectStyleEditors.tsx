'use client';

import clsx from 'clsx';
import { useEffect, useState } from 'react';
import {
  FILL_PRESET_LABELS,
  FILL_PRESET_ORDER,
  OUTLINE_PRESET_LABELS,
  resolveFillColor,
  SHAPE_VARIANT_OPTIONS,
} from '@/core/editor/model/editor-appearance';
import { useEditorStore } from '@/core/editor/model/editor-store';
import type {
  EditorCanvasObject,
  EditorOutlinePreset,
} from '@/core/editor/model/editor-types';

type EditorMode = 'compact' | 'panel';

function HexColorField({
  hideLabel = false,
  label,
  mode,
  value,
  onCommit,
}: {
  hideLabel?: boolean;
  label: string;
  mode: EditorMode;
  value: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <div className={clsx('object-style-editor__field', `object-style-editor__field--${mode}`, {
      'object-style-editor__field--compact': hideLabel,
    })}>
      {!hideLabel ? <span className="object-style-editor__field-label">{label}</span> : null}
      <div className="object-style-editor__color-row">
        <input
          aria-label={label}
          className="object-style-editor__color-input"
          onChange={(event) => {
            setDraft(event.target.value);
            onCommit(event.target.value);
          }}
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#5851ff'}
        />
        <input
          className="inspector-field__input object-style-editor__hex-input"
          onBlur={() => onCommit(draft)}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onCommit(draft);
            }
          }}
          value={draft}
        />
      </div>
    </div>
  );
}

export function ShapeStyleEditor({
  mode,
  object,
}: {
  mode: EditorMode;
  object: EditorCanvasObject;
}) {
  const updateObjectPatch = useEditorStore((state) => state.updateObjectPatch);

  if (object.kind !== 'shape') {
    return null;
  }

  return (
    <div className={clsx('object-style-editor__section', `object-style-editor__section--${mode}`)}>
      <span className="object-style-editor__title">모양</span>
      <div className="object-style-editor__variant-grid">
        {SHAPE_VARIANT_OPTIONS.map((option) => (
          <button
            aria-label={option.label}
            aria-pressed={(object.shapeVariant ?? 'rectangle') === option.value}
            className={clsx('object-style-editor__variant', {
              'object-style-editor__variant--active': (object.shapeVariant ?? 'rectangle') === option.value,
            })}
            key={option.value}
            onClick={() => updateObjectPatch(object.id, { shapeVariant: option.value })}
            title={option.label}
            type="button"
          >
            <span
              className={clsx(
                'object-style-editor__variant-preview',
                `object-style-editor__variant-preview--${option.value}`,
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export function FillStyleEditor({
  mode,
  object,
}: {
  mode: EditorMode;
  object: EditorCanvasObject;
}) {
  const updateObjectPatch = useEditorStore((state) => state.updateObjectPatch);

  return (
    <div className={clsx('object-style-editor__section', `object-style-editor__section--${mode}`)}>
      <span className="object-style-editor__title">채우기</span>
      <div className="object-style-editor__swatch-grid">
        {FILL_PRESET_ORDER.map((preset) => (
          <button
            aria-label={`${FILL_PRESET_LABELS[preset]} 프리셋`}
            aria-pressed={object.fillColor === resolveFillColor(preset)}
            className={clsx('object-style-editor__swatch-button', {
              'object-style-editor__swatch-button--active': object.fillColor === resolveFillColor(preset),
            })}
            key={preset}
            onClick={() => updateObjectPatch(object.id, {
              fillPreset: preset,
              fillColor: resolveFillColor(preset),
            })}
            style={{ backgroundColor: resolveFillColor(preset) }}
            title={FILL_PRESET_LABELS[preset]}
            type="button"
          />
        ))}
      </div>
      <HexColorField
        hideLabel
        label="채우기 색상"
        mode={mode}
        onCommit={(value) => updateObjectPatch(object.id, { fillColor: value })}
        value={object.fillColor}
      />
    </div>
  );
}

export function BorderStyleEditor({
  mode,
  object,
}: {
  mode: EditorMode;
  object: EditorCanvasObject;
}) {
  const updateObjectPatch = useEditorStore((state) => state.updateObjectPatch);
  const outlinePresets: EditorOutlinePreset[] = ['none', 'thin', 'medium', 'dashed'];

  return (
    <div className={clsx('object-style-editor__section', `object-style-editor__section--${mode}`)}>
      <span className="object-style-editor__title">테두리</span>
      <div className="object-style-editor__preset-row">
        {outlinePresets.map((preset) => (
          <button
            aria-label={OUTLINE_PRESET_LABELS[preset]}
            aria-pressed={object.outlinePreset === preset}
            className={clsx('object-style-editor__outline-preset', {
              'object-style-editor__outline-preset--active': object.outlinePreset === preset,
            })}
            key={preset}
            onClick={() => updateObjectPatch(object.id, { outlinePreset: preset })}
            title={OUTLINE_PRESET_LABELS[preset]}
            type="button"
          >
            <span
              className={clsx(
                'object-style-editor__outline-preview',
                `object-style-editor__outline-preview--${preset}`,
              )}
              style={{ borderColor: object.outlineColor }}
            />
          </button>
        ))}
      </div>
      <HexColorField
        hideLabel
        label="테두리 색상"
        mode={mode}
        onCommit={(value) => updateObjectPatch(object.id, { outlineColor: value })}
        value={object.outlineColor}
      />
    </div>
  );
}
