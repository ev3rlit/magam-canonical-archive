import {
  createObjectMap,
  getDescendantIds,
  getFrameCenter,
  getObjectTransformFrame,
  getSelectionBounds,
  getSelectionRootIds,
  normalizeRotationDegrees,
  syncGroupFrames,
} from '../editor-geometry';
import type { EditorState } from '../editor-state';
import type {
  EditorCanvasObject,
  EditorOverlayState,
  EditorSelectionState,
  EditorTransformFrame,
} from '../editor-types';
import { getMinimumObjectHeight } from './object-commands';

function rotateVector(x: number, y: number, rotation: number) {
  const radians = rotation * (Math.PI / 180);
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  return {
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  };
}

function transformPointBetweenFrames(
  point: { x: number; y: number },
  baseFrame: EditorTransformFrame,
  nextFrame: EditorTransformFrame,
) {
  const baseCenter = getFrameCenter(baseFrame);
  const nextCenter = getFrameCenter(nextFrame);
  const deltaRotation = nextFrame.rotation - baseFrame.rotation;
  const inverse = rotateVector(point.x - baseCenter.x, point.y - baseCenter.y, -baseFrame.rotation);
  const scaled = {
    x: inverse.x * (nextFrame.width / baseFrame.width),
    y: inverse.y * (nextFrame.height / baseFrame.height),
  };
  const rotated = rotateVector(scaled.x, scaled.y, nextFrame.rotation);

  return {
    x: nextCenter.x + rotated.x,
    y: nextCenter.y + rotated.y,
    deltaRotation,
  };
}

export function createIdleOverlays(
  overrides: Partial<EditorOverlayState> = {},
): EditorOverlayState {
  return {
    contextMenu: null,
    focusRequest: null,
    bodyEditorSession: null,
    activeBodyEditorObjectId: null,
    isBodyEditorOpen: false,
    bodyEditorPendingText: null,
    ...overrides,
  };
}

export function closeBodyEditorOverlays(
  overlays: EditorOverlayState,
  overrides: Partial<EditorOverlayState> = {},
): EditorOverlayState {
  return {
    ...overlays,
    bodyEditorSession: null,
    activeBodyEditorObjectId: null,
    isBodyEditorOpen: false,
    bodyEditorPendingText: null,
    ...overrides,
  };
}

export function normalizeSelection(ids: string[], primaryId: string | null): EditorSelectionState {
  const uniqueIds = [...new Set(ids)];
  return {
    ids: uniqueIds,
    primaryId: primaryId && uniqueIds.includes(primaryId) ? primaryId : uniqueIds[0] ?? null,
  };
}

export function withClearedContext(selection: EditorSelectionState) {
  return {
    selection,
    overlays: createIdleOverlays(),
  } satisfies Pick<EditorState, 'selection' | 'overlays'>;
}

export function getSelectionRoots(selectionIds: string[], objects: EditorCanvasObject[]) {
  const objectMap = createObjectMap(objects);
  const selected = new Set(selectionIds);

  return selectionIds.filter((id) => {
    let current = objectMap.get(id)?.parentId ?? null;
    while (current) {
      if (selected.has(current)) {
        return false;
      }
      current = objectMap.get(current)?.parentId ?? null;
    }
    return true;
  });
}

export function collectMoveTargets(selectionIds: string[], objects: EditorCanvasObject[]) {
  const roots = getSelectionRoots(selectionIds, objects);
  const moveIds = new Set<string>();

  roots.forEach((rootId) => {
    moveIds.add(rootId);
    getDescendantIds(rootId, objects).forEach((descendantId) => moveIds.add(descendantId));
  });

  return [...moveIds];
}

export function applySelectionTransform(input: {
  baseObjects: EditorCanvasObject[];
  selectionIds: string[];
  baseFrame: EditorTransformFrame;
  nextFrame: EditorTransformFrame;
}) {
  const roots = getSelectionRootIds(input.selectionIds, input.baseObjects);
  const targetIds = new Set<string>();

  roots.forEach((rootId) => {
    targetIds.add(rootId);
    getDescendantIds(rootId, input.baseObjects).forEach((descendantId) => targetIds.add(descendantId));
  });

  const nextObjects = input.baseObjects.map((object) => {
    if (!targetIds.has(object.id)) {
      return object;
    }

    const frame = getObjectTransformFrame(object, input.baseObjects);
    const center = getFrameCenter(frame);
    const transformedCenter = transformPointBetweenFrames(center, input.baseFrame, input.nextFrame);
    const nextWidth = Math.max(frame.width * (input.nextFrame.width / input.baseFrame.width), 120);
    const nextHeight = Math.max(
      frame.height * (input.nextFrame.height / input.baseFrame.height),
      getMinimumObjectHeight({
        ...object,
        width: nextWidth,
        height: frame.height,
      }),
    );

    return {
      ...object,
      x: transformedCenter.x - nextWidth / 2,
      y: transformedCenter.y - nextHeight / 2,
      width: nextWidth,
      height: nextHeight,
      rotation: normalizeRotationDegrees(frame.rotation + transformedCenter.deltaRotation),
    };
  });

  return syncGroupFrames(nextObjects);
}

export function getSelectionStatsData(state: Pick<EditorState, 'selection' | 'scene'>) {
  const bounds = getSelectionBounds(state.selection, state.scene.objects);
  return {
    count: state.selection.ids.length,
    bounds,
  };
}
