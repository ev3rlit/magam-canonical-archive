'use client';

import clsx from 'clsx';
import {
  OUTLINE_PRESET_TOKENS,
  resolveReadableTextColor,
} from '@/core/editor/model/editor-appearance';
import { getObjectTransformFrame } from '@/core/editor/model/editor-geometry';
import type { EditorCanvasObject } from '@/core/editor/model/editor-types';
import { CanvasObjectBody } from '@/widgets/canvas-editor/ui/CanvasObjectBody';

function fillClass(object: EditorCanvasObject) {
  return {
    'canvas-object--frame': object.kind === 'frame',
    'canvas-object--group': object.kind === 'group',
    'canvas-object--image': object.kind === 'image',
    'canvas-object--shape': object.kind === 'shape',
    'canvas-object--sticky': object.kind === 'sticky',
    'canvas-object--text': object.kind === 'text',
  };
}

function CanvasObjectContent({ object }: { object: EditorCanvasObject }) {
  if (object.kind === 'group') {
    return (
      <div className="canvas-object__group-label">
        <strong>{object.name}</strong>
      </div>
    );
  }

  return null;
}

export function CanvasObject({
  object,
  objects,
  isSelected,
  panCursor,
  onContextMenu,
  onPointerDown,
}: {
  object: EditorCanvasObject;
  objects: EditorCanvasObject[];
  isSelected: boolean;
  panCursor?: string;
  onContextMenu: React.MouseEventHandler<HTMLDivElement>;
  onPointerDown: React.PointerEventHandler<HTMLDivElement>;
}) {
  const frame = getObjectTransformFrame(object, objects);

  return (
    <div
      className={clsx('canvas-object', fillClass(object), {
        'canvas-object--selected': isSelected,
        'canvas-object--locked': object.locked,
      })}
      data-fill={object.fillPreset}
      data-kind={object.kind}
      data-shape-variant={object.shapeVariant ?? 'rectangle'}
      onContextMenu={onContextMenu}
      onPointerDown={onPointerDown}
      style={{
        cursor: panCursor ?? (object.locked ? 'not-allowed' : 'pointer'),
        height: frame.height,
        left: frame.x,
        ['--object-bg' as string]: object.fillColor,
        ['--object-border-color' as string]: object.outlineColor,
        ['--object-border-style' as string]: OUTLINE_PRESET_TOKENS[object.outlinePreset].style,
        ['--object-border-width' as string]: OUTLINE_PRESET_TOKENS[object.outlinePreset].width,
        ['--object-text' as string]: resolveReadableTextColor(object.fillColor, object.fillPreset),
        top: frame.y,
        transform: `rotate(${frame.rotation}deg)`,
        transformOrigin: 'center',
        width: frame.width,
        zIndex: object.zIndex,
      }}
    >
      <CanvasObjectContent object={object} />
      {object.kind !== 'group' ? (
        <CanvasObjectBody isSelected={isSelected} object={object} />
      ) : null}
    </div>
  );
}
