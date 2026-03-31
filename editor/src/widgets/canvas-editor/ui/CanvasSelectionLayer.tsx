'use client';

import clsx from 'clsx';
import { useEffect, useRef } from 'react';
import {
  getFrameCenter,
  getSelectionBounds,
  getSelectionTransformFrame,
  marqueeToBounds,
  normalizeRotationDegrees,
  screenBoundsFromWorld,
  screenFrameFromWorld,
  worldPointFromClient,
} from '@/core/editor/model/editor-geometry';
import { useEditorStore } from '@/core/editor/model/editor-store';
import type { EditorHistorySnapshot, EditorTransformFrame } from '@/core/editor/model/editor-types';

const RESIZE_HANDLES = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const;
type ResizeHandle = (typeof RESIZE_HANDLES)[number];
const MIN_SELECTION_FRAME_SIZE = 36;

type TransformInteraction =
  | {
      type: 'resize';
      handle: ResizeHandle;
      baseFrame: EditorTransformFrame;
      historyBefore: EditorHistorySnapshot;
      changed: boolean;
    }
  | {
      type: 'rotate';
      baseFrame: EditorTransformFrame;
      historyBefore: EditorHistorySnapshot;
      changed: boolean;
    };

function toLayerStyle(bounds: { x: number; y: number; width: number; height: number }) {
  return {
    left: bounds.x,
    top: bounds.y,
    width: bounds.width,
    height: bounds.height,
  };
}

function toFrameLocalPoint(point: { x: number; y: number }, frame: EditorTransformFrame) {
  const center = getFrameCenter(frame);
  const radians = -frame.rotation * (Math.PI / 180);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const offsetX = point.x - center.x;
  const offsetY = point.y - center.y;

  return {
    x: frame.width / 2 + offsetX * cos - offsetY * sin,
    y: frame.height / 2 + offsetX * sin + offsetY * cos,
  };
}

function computeNextResizeFrame(
  frame: EditorTransformFrame,
  handle: ResizeHandle,
  pointerWorld: { x: number; y: number },
  keepAspectRatio: boolean,
) {
  const localPoint = toFrameLocalPoint(pointerWorld, frame);
  let left = 0;
  let top = 0;
  let right = frame.width;
  let bottom = frame.height;

  if (handle.includes('w')) {
    left = Math.min(localPoint.x, right - MIN_SELECTION_FRAME_SIZE);
  }
  if (handle.includes('e')) {
    right = Math.max(localPoint.x, left + MIN_SELECTION_FRAME_SIZE);
  }
  if (handle.includes('n')) {
    top = Math.min(localPoint.y, bottom - MIN_SELECTION_FRAME_SIZE);
  }
  if (handle.includes('s')) {
    bottom = Math.max(localPoint.y, top + MIN_SELECTION_FRAME_SIZE);
  }

  if (keepAspectRatio) {
    const widthRatio = (right - left) / frame.width;
    const heightRatio = (bottom - top) / frame.height;
    const dominantRatio = Math.abs(1 - widthRatio) > Math.abs(1 - heightRatio) ? widthRatio : heightRatio;
    const nextWidth = Math.max(frame.width * dominantRatio, MIN_SELECTION_FRAME_SIZE);
    const nextHeight = Math.max(frame.height * dominantRatio, MIN_SELECTION_FRAME_SIZE);

    if (handle.includes('w')) {
      left = right - nextWidth;
    } else if (handle.includes('e')) {
      right = left + nextWidth;
    } else {
      left = (frame.width - nextWidth) / 2;
      right = left + nextWidth;
    }

    if (handle.includes('n')) {
      top = bottom - nextHeight;
    } else if (handle.includes('s')) {
      bottom = top + nextHeight;
    } else {
      top = (frame.height - nextHeight) / 2;
      bottom = top + nextHeight;
    }
  }

  return {
    x: frame.x + left,
    y: frame.y + top,
    width: right - left,
    height: bottom - top,
    rotation: frame.rotation,
  };
}

function computeNextRotationFrame(
  frame: EditorTransformFrame,
  pointerWorld: { x: number; y: number },
  snap: boolean,
) {
  const center = getFrameCenter(frame);
  let nextRotation = Math.atan2(pointerWorld.y - center.y, pointerWorld.x - center.x) * (180 / Math.PI) + 90;
  nextRotation = normalizeRotationDegrees(nextRotation);

  if (snap) {
    nextRotation = normalizeRotationDegrees(Math.round(nextRotation / 15) * 15);
  }

  return {
    ...frame,
    rotation: nextRotation,
  };
}

export function CanvasSelectionLayer() {
  const objects = useEditorStore((state) => state.scene.objects);
  const marquee = useEditorStore((state) => state.scene.marquee);
  const selection = useEditorStore((state) => state.selection);
  const viewport = useEditorStore((state) => state.viewport);
  const contextMenu = useEditorStore((state) => state.overlays.contextMenu);
  const isBodyEditorOpen = useEditorStore((state) => state.overlays.isBodyEditorOpen);
  const commitHistoryEntry = useEditorStore((state) => state.commitHistoryEntry);
  const captureHistorySnapshot = useEditorStore((state) => state.captureHistorySnapshot);
  const resizeSelection = useEditorStore((state) => state.resizeSelection);
  const rotateSelection = useEditorStore((state) => state.rotateSelection);
  const setContextMenu = useEditorStore((state) => state.setContextMenu);

  const layerRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<TransformInteraction | null>(null);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const interaction = interactionRef.current;
      const layerNode = layerRef.current;
      if (!interaction || !layerNode) {
        return;
      }

      const state = useEditorStore.getState();
      const stageRect = layerNode.getBoundingClientRect();
      const point = worldPointFromClient({
        clientX: event.clientX,
        clientY: event.clientY,
        stageRect,
        viewport: state.viewport,
      });

      if (interaction.type === 'resize') {
        const nextFrame = computeNextResizeFrame(interaction.baseFrame, interaction.handle, point, event.shiftKey);
        interaction.changed ||= (
          nextFrame.x !== interaction.baseFrame.x
          || nextFrame.y !== interaction.baseFrame.y
          || nextFrame.width !== interaction.baseFrame.width
          || nextFrame.height !== interaction.baseFrame.height
        );
        resizeSelection({
          baseObjects: interaction.historyBefore.objects,
          baseFrame: interaction.baseFrame,
          nextFrame,
        });
        return;
      }

      const nextFrame = computeNextRotationFrame(interaction.baseFrame, point, event.shiftKey);
      interaction.changed ||= nextFrame.rotation !== interaction.baseFrame.rotation;
      rotateSelection({
        baseObjects: interaction.historyBefore.objects,
        baseFrame: interaction.baseFrame,
        nextFrame,
      });
    };

    const handlePointerUp = () => {
      const interaction = interactionRef.current;
      if (!interaction) {
        return;
      }

      if (interaction.changed) {
        commitHistoryEntry(
          interaction.type === 'resize' ? 'Resize selection' : 'Rotate selection',
          interaction.historyBefore,
        );
      }

      interactionRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [commitHistoryEntry, resizeSelection, rotateSelection]);

  const selectionBounds = getSelectionBounds(selection, objects);
  const selectionFrame = getSelectionTransformFrame(selection, objects);
  const screenFrame = selectionFrame ? screenFrameFromWorld(selectionFrame, viewport) : null;
  const hasLockedSelection = selection.ids.some((id) => objects.find((object) => object.id === id)?.locked);
  const showHandles = Boolean(selectionFrame && !hasLockedSelection && !contextMenu && !isBodyEditorOpen);
  const singleSelection = selection.ids.length === 1;

  return (
    <div className="canvas-selection-layer" data-testid="canvas-selection-layer" ref={layerRef}>
      {screenFrame ? (
        <div
          className={clsx('selection-outline', {
            'selection-outline--multi': !singleSelection,
            'selection-outline--transform': showHandles,
          })}
          data-testid="graph-canvas-selection-shell"
          style={{
            ...toLayerStyle(screenFrame),
            transform: `rotate(${singleSelection ? screenFrame.rotation : 0}deg)`,
          }}
        >
          {!singleSelection ? (
            <span className="selection-outline__label">{selection.ids.length} selected</span>
          ) : null}
          {showHandles ? (
            <>
              {RESIZE_HANDLES.map((handle) => (
                <button
                  aria-label={`Resize from ${handle}`}
                  className={`selection-outline__handle selection-outline__handle--${handle}`}
                  data-handle={handle}
                  data-testid="graph-canvas-resize-handle"
                  key={handle}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!selectionFrame) {
                      return;
                    }
                    setContextMenu(null);
                    interactionRef.current = {
                      type: 'resize',
                      handle,
                      baseFrame: selectionFrame,
                      historyBefore: captureHistorySnapshot(),
                      changed: false,
                    };
                  }}
                  type="button"
                />
              ))}
              <span className="selection-outline__rotate-stem" />
              <button
                aria-label="Rotate selection"
                className="selection-outline__rotate-handle"
                data-testid="graph-canvas-rotate-handle"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (!selectionFrame) {
                    return;
                  }
                  setContextMenu(null);
                  interactionRef.current = {
                    type: 'rotate',
                    baseFrame: selectionFrame,
                    historyBefore: captureHistorySnapshot(),
                    changed: false,
                  };
                }}
                type="button"
              />
            </>
          ) : null}
        </div>
      ) : null}
      {marquee ? (
        <div
          className="selection-marquee"
          style={toLayerStyle(screenBoundsFromWorld(marqueeToBounds(marquee), viewport))}
        />
      ) : null}
      {selectionBounds && !screenFrame && selection.ids.length > 1 ? (
        <div
          className="selection-outline selection-outline--multi"
          data-testid="graph-canvas-selection-shell"
          style={toLayerStyle(screenBoundsFromWorld(selectionBounds, viewport))}
        >
          <span className="selection-outline__label">{selection.ids.length} selected</span>
        </div>
      ) : null}
    </div>
  );
}
