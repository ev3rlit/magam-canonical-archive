'use client';

import clsx from 'clsx';
import type { RefObject } from 'react';
import {
  OUTLINE_PRESET_TOKENS,
  resolveReadableTextColor,
} from '@/core/editor/model/editor-appearance';
import { getObjectTransformFrame, worldPointFromClient } from '@/core/editor/model/editor-geometry';
import { useEditorStore } from '@/core/editor/model/editor-store';
import type { EditorCanvasObject, EditorHistorySnapshot, EditorTool } from '@/core/editor/model/editor-types';
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
  effectiveTool,
  panCursor,
  stageRef,
  startPanInteraction,
  startDragInteraction,
}: {
  object: EditorCanvasObject;
  objects: EditorCanvasObject[];
  isSelected: boolean;
  effectiveTool: EditorTool;
  panCursor?: string;
  stageRef: RefObject<HTMLDivElement | null>;
  startPanInteraction: (clientX: number, clientY: number) => void;
  startDragInteraction: (originWorldX: number, originWorldY: number, historyBefore: EditorHistorySnapshot) => void;
}) {
  const selectionIds = useEditorStore((state) => state.selection.ids);
  const commitActiveBodyEditor = useEditorStore((state) => state.commitActiveBodyEditor);
  const selectOnly = useEditorStore((state) => state.selectOnly);
  const selectMany = useEditorStore((state) => state.selectMany);
  const setContextMenu = useEditorStore((state) => state.setContextMenu);
  const toggleSelection = useEditorStore((state) => state.toggleSelection);
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
      onContextMenu={(event) => {
        if (!stageRef.current) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        commitActiveBodyEditor();

        if (!selectionIds.includes(object.id)) {
          selectOnly(object.id);
        } else {
          selectMany(selectionIds, object.id);
        }

        const stageRect = stageRef.current.getBoundingClientRect();
        setContextMenu({
          objectId: object.id,
          x: event.clientX - stageRect.left,
          y: event.clientY - stageRect.top,
        });
      }}
      onPointerDown={(event) => {
        if (!stageRef.current || event.button !== 0) {
          return;
        }

        event.stopPropagation();
        event.preventDefault();
        commitActiveBodyEditor();
        setContextMenu(null);

        if (effectiveTool === 'pan') {
          startPanInteraction(event.clientX, event.clientY);
          return;
        }

        if (event.shiftKey) {
          toggleSelection(object.id);
          return;
        }

        if (!selectionIds.includes(object.id)) {
          selectOnly(object.id);
        } else {
          selectMany(selectionIds, object.id);
        }

        if (object.locked) {
          return;
        }

        const state = useEditorStore.getState();
        const stageRect = stageRef.current.getBoundingClientRect();
        const point = worldPointFromClient({
          clientX: event.clientX,
          clientY: event.clientY,
          stageRect,
          viewport: state.viewport,
        });
        startDragInteraction(point.x, point.y, state.captureHistorySnapshot());
      }}
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
