'use client';

import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import {
  OUTLINE_PRESET_TOKENS,
  resolveReadableTextColor,
} from '@/core/editor/model/editor-appearance';
import {
  getEffectiveBounds,
  getObjectTransformFrame,
  getSelectionBounds,
  intersectsBounds,
  marqueeToBounds,
  screenBoundsFromWorld,
  worldPointFromClient,
} from '@/core/editor/model/editor-geometry';
import { getEffectiveTool, getPrimarySelectionObject, useEditorStore } from '@/core/editor/model/editor-store';
import type { EditorCanvasObject, EditorHistorySnapshot, EditorMarqueeState } from '@/core/editor/model/editor-types';
import { CanvasContextMenu } from '@/widgets/canvas-editor/ui/CanvasContextMenu';
import { CanvasObjectBody } from '@/widgets/canvas-editor/ui/CanvasObjectBody';
import { CanvasObjectFloatingMenu } from '@/widgets/canvas-editor/ui/CanvasObjectFloatingMenu';

type InteractionState =
  | {
      type: 'pan';
      lastClientX: number;
      lastClientY: number;
    }
  | {
      type: 'drag';
      originWorldX: number;
      originWorldY: number;
      appliedDeltaX: number;
      appliedDeltaY: number;
      historyBefore: EditorHistorySnapshot;
    }
  | {
      type: 'marquee';
      originWorldX: number;
      originWorldY: number;
      seedIds: string[];
    };

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

export function CanvasViewport() {
  const effectiveTool = useEditorStore((state) => getEffectiveTool(state));
  const contextMenu = useEditorStore((state) => state.overlays.contextMenu);
  const objects = useEditorStore((state) => state.scene.objects);
  const selection = useEditorStore((state) => state.selection);
  const viewport = useEditorStore((state) => state.viewport);
  const setViewportRect = useEditorStore((state) => state.setViewportRect);
  const panViewport = useEditorStore((state) => state.panViewport);
  const setContextMenu = useEditorStore((state) => state.setContextMenu);
  const selectOnly = useEditorStore((state) => state.selectOnly);
  const toggleSelection = useEditorStore((state) => state.toggleSelection);
  const clearSelection = useEditorStore((state) => state.clearSelection);
  const setMarquee = useEditorStore((state) => state.setMarquee);
  const moveSelection = useEditorStore((state) => state.moveSelection);
  const selectMany = useEditorStore((state) => state.selectMany);
  const commitHistoryEntry = useEditorStore((state) => state.commitHistoryEntry);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const interactionRef = useRef<InteractionState | null>(null);
  const [isPanGestureActive, setIsPanGestureActive] = useState(false);
  const panCursor = isPanGestureActive ? 'grabbing' : effectiveTool === 'pan' ? 'grab' : undefined;

  useEffect(() => {
    const node = stageRef.current;
    if (!node) {
      return;
    }

    const updateRect = () => {
      setViewportRect(node.clientWidth, node.clientHeight);
    };

    updateRect();
    const observer = new ResizeObserver(updateRect);
    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [setViewportRect]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const interaction = interactionRef.current;
      const stageNode = stageRef.current;
      if (!interaction || !stageNode) {
        return;
      }

      const state = useEditorStore.getState();

      if (interaction.type === 'pan') {
        const deltaX = event.clientX - interaction.lastClientX;
        const deltaY = event.clientY - interaction.lastClientY;
        interaction.lastClientX = event.clientX;
        interaction.lastClientY = event.clientY;
        panViewport(deltaX, deltaY);
        return;
      }

      const stageRect = stageNode.getBoundingClientRect();
      const worldPoint = worldPointFromClient({
        clientX: event.clientX,
        clientY: event.clientY,
        stageRect,
        viewport: state.viewport,
      });

      if (interaction.type === 'drag') {
        const totalDeltaX = worldPoint.x - interaction.originWorldX;
        const totalDeltaY = worldPoint.y - interaction.originWorldY;
        const nextDeltaX = totalDeltaX - interaction.appliedDeltaX;
        const nextDeltaY = totalDeltaY - interaction.appliedDeltaY;
        interaction.appliedDeltaX = totalDeltaX;
        interaction.appliedDeltaY = totalDeltaY;
        moveSelection(nextDeltaX, nextDeltaY);
        return;
      }

      const nextMarquee: EditorMarqueeState = {
        x: interaction.originWorldX,
        y: interaction.originWorldY,
        width: worldPoint.x - interaction.originWorldX,
        height: worldPoint.y - interaction.originWorldY,
        originX: interaction.originWorldX,
        originY: interaction.originWorldY,
      };
      setMarquee(nextMarquee);
    };

    const handlePointerUp = () => {
      const interaction = interactionRef.current;
      if (!interaction) {
        return;
      }

      if (interaction.type === 'drag' && (interaction.appliedDeltaX !== 0 || interaction.appliedDeltaY !== 0)) {
        commitHistoryEntry('Move selection', interaction.historyBefore);
      }

      if (interaction.type === 'marquee') {
        const state = useEditorStore.getState();
        const bounds = state.scene.marquee ? marqueeToBounds(state.scene.marquee) : null;
        if (bounds) {
          const matchingIds = state.scene.objects
            .filter((object) => object.visible)
            .filter((object) => intersectsBounds(bounds, getEffectiveBounds(object, state.scene.objects)))
            .map((object) => object.id);
          const ids = interaction.seedIds.length > 0
            ? [...new Set([...interaction.seedIds, ...matchingIds])]
            : matchingIds;
          selectMany(ids, ids[ids.length - 1] ?? null);
        }
        setMarquee(null);
      }

      interactionRef.current = null;
      setIsPanGestureActive(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      setIsPanGestureActive(false);
    };
  }, [commitHistoryEntry, moveSelection, panViewport, selectMany, setMarquee]);

  const selectionBounds = getSelectionBounds(selection, objects);
  const primaryObject = getPrimarySelectionObject(useEditorStore.getState());
  const contextObject = contextMenu
    ? objects.find((object) => object.id === contextMenu.objectId) ?? null
    : null;

  return (
    <div
      className={clsx('canvas-viewport', {
        'canvas-viewport--pan': effectiveTool === 'pan',
        'canvas-viewport--panning': isPanGestureActive,
      })}
      data-testid="canvas-viewport"
      style={panCursor ? { cursor: panCursor } : undefined}
      onContextMenu={(event) => {
        if (event.target === stageRef.current) {
          event.preventDefault();
        }
      }}
      onPointerDown={(event) => {
        if (event.button !== 0 || !stageRef.current) {
          return;
        }

        const state = useEditorStore.getState();
        if (effectiveTool === 'pan') {
          interactionRef.current = {
            type: 'pan',
            lastClientX: event.clientX,
            lastClientY: event.clientY,
          };
          setIsPanGestureActive(true);
          setContextMenu(null);
          return;
        }

        const stageRect = stageRef.current.getBoundingClientRect();
        const point = worldPointFromClient({
          clientX: event.clientX,
          clientY: event.clientY,
          stageRect,
          viewport: state.viewport,
        });

        interactionRef.current = {
          type: 'marquee',
          originWorldX: point.x,
          originWorldY: point.y,
          seedIds: event.shiftKey ? [...state.selection.ids] : [],
        };
        setContextMenu(null);
        if (!event.shiftKey) {
          clearSelection();
        }
        setMarquee({
          x: point.x,
          y: point.y,
          width: 0,
          height: 0,
          originX: point.x,
          originY: point.y,
        });
      }}
      ref={stageRef}
    >
      <div
        className="canvas-viewport__grid"
        style={{
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
          backgroundSize: `${32 * viewport.zoom}px ${32 * viewport.zoom}px`,
        }}
      />
      <div
        className={clsx('canvas-viewport__world', {
          'canvas-viewport__world--pan': effectiveTool === 'pan',
        })}
        style={{
          cursor: panCursor,
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        }}
      >
        {objects
          .filter((object) => object.visible)
          .sort((left, right) => left.zIndex - right.zIndex)
          .map((object) => {
            const frame = getObjectTransformFrame(object, objects);
            const isSelected = selection.ids.includes(object.id);

            return (
              <div
                className={clsx('canvas-object', fillClass(object), {
                  'canvas-object--selected': isSelected,
                  'canvas-object--locked': object.locked,
                })}
                data-fill={object.fillPreset}
                data-kind={object.kind}
                data-shape-variant={object.shapeVariant ?? 'rectangle'}
                key={object.id}
                onContextMenu={(event) => {
                  if (!stageRef.current) {
                    return;
                  }

                  event.preventDefault();
                  event.stopPropagation();

                  if (!selection.ids.includes(object.id)) {
                    selectOnly(object.id);
                  } else {
                    selectMany(selection.ids, object.id);
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
                  setContextMenu(null);

                  if (effectiveTool === 'pan') {
                    interactionRef.current = {
                      type: 'pan',
                      lastClientX: event.clientX,
                      lastClientY: event.clientY,
                    };
                    setIsPanGestureActive(true);
                    return;
                  }

                  if (event.shiftKey) {
                    toggleSelection(object.id);
                    return;
                  }

                  if (!selection.ids.includes(object.id)) {
                    selectOnly(object.id);
                  } else {
                    selectMany(selection.ids, object.id);
                  }

                  if (object.locked) {
                    return;
                  }

                  const dragState = useEditorStore.getState();
                  const stageRect = stageRef.current.getBoundingClientRect();
                  const point = worldPointFromClient({
                    clientX: event.clientX,
                    clientY: event.clientY,
                    stageRect,
                    viewport: dragState.viewport,
                  });
                  interactionRef.current = {
                    type: 'drag',
                    originWorldX: point.x,
                    originWorldY: point.y,
                    appliedDeltaX: 0,
                    appliedDeltaY: 0,
                    historyBefore: dragState.captureHistorySnapshot(),
                  };
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
          })}
      </div>
      {selectionBounds && primaryObject && selection.ids.length === 1 && !contextMenu ? (
        <CanvasObjectFloatingMenu
          primaryObject={primaryObject}
          selectionBounds={screenBoundsFromWorld(selectionBounds, viewport)}
          selectionCount={selection.ids.length}
          stageHeight={viewport.height}
          stageWidth={viewport.width}
        />
      ) : null}
      {contextMenu && contextObject ? (
        <CanvasContextMenu
          contextMenu={contextMenu}
          stageHeight={viewport.height}
          stageWidth={viewport.width}
        />
      ) : null}
    </div>
  );
}
