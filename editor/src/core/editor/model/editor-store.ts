'use client';

import { create } from 'zustand';
import { UndoStack } from '../history/undo-stack';
import {
  parseColorInput,
  resolveFillColor,
  resolveOutlineColor,
} from './editor-appearance';
import {
  cloneBody,
  createSeedBodyDocument,
  getCanvasObjectMinimumHeight,
} from './editor-content-blocks';
import { createBodyDocument } from './editor-body';
import {
  clamp,
  createObjectMap,
  getChildObjects,
  getDescendantIds,
  getFrameCenter,
  getObjectTransformFrame,
  getSelectionBounds,
  getSelectionRootIds,
  nextZIndex,
  normalizeRotationDegrees,
  syncGroupFrames,
} from './editor-geometry';
import type {
  EditorCanvasObject,
  EditorCanvasObjectKind,
  EditorContextMenuState,
  EditorFillPreset,
  EditorHistorySnapshot,
  EditorMarqueeState,
  EditorOutlinePreset,
  EditorPanelId,
  EditorSelectionState,
  EditorShapeVariant,
  EditorTransformFrame,
  EditorTool,
} from './editor-types';

const DEFAULT_VIEWPORT = {
  x: 48,
  y: 52,
  zoom: 1,
  width: 0,
  height: 0,
} as const;

const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520">
      <defs>
        <linearGradient id="a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#d7ddff" />
          <stop offset="50%" stop-color="#f4f7ff" />
          <stop offset="100%" stop-color="#cfe8ff" />
        </linearGradient>
      </defs>
      <rect width="800" height="520" rx="40" fill="url(#a)" />
      <circle cx="180" cy="146" r="78" fill="#bfc6ff" opacity="0.6" />
      <path d="M60 408L240 220L370 336L510 170L740 408H60Z" fill="#8bb6ff" opacity="0.65" />
      <path d="M120 408L288 264L412 344L580 198L730 408H120Z" fill="#5851FF" opacity="0.35" />
      <text x="64" y="470" fill="#20305b" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="600">
        Canvas mood reference
      </text>
    </svg>
  `);

const MIN_OBJECT_WIDTH = 120;
const MIN_OBJECT_HEIGHT = 96;

const OBJECT_DEFAULTS: Record<
  Exclude<EditorCanvasObjectKind, 'group'>,
  Pick<EditorCanvasObject, 'width' | 'height' | 'fillPreset' | 'outlinePreset'>
> = {
  shape: {
    width: 184,
    height: 124,
    fillPreset: 'iris',
    outlinePreset: 'thin',
  },
  sticky: {
    width: 208,
    height: 208,
    fillPreset: 'amber',
    outlinePreset: 'thin',
  },
  text: {
    width: 240,
    height: 108,
    fillPreset: 'slate',
    outlinePreset: 'none',
  },
  image: {
    width: 252,
    height: 180,
    fillPreset: 'sky',
    outlinePreset: 'thin',
  },
  frame: {
    width: 380,
    height: 256,
    fillPreset: 'sky',
    outlinePreset: 'thin',
  },
};

let objectCounter = 0;
let focusRequestCounter = 1;
const historyStack = new UndoStack<EditorHistorySnapshot>();

function shouldUseMobilePanel() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 920px)').matches;
}

function createObjectId(prefix: string) {
  objectCounter += 1;
  return `${prefix}-${objectCounter}`;
}

function getKindLabel(kind: EditorCanvasObjectKind) {
  switch (kind) {
    case 'shape':
      return 'Shape';
    case 'sticky':
      return 'Sticky';
    case 'text':
      return 'Text';
    case 'image':
      return 'Image';
    case 'frame':
      return 'Frame';
    case 'group':
      return 'Group';
  }
}

function seedObjects(): EditorCanvasObject[] {
  return [];
}

function createInitialState(): EditorState {
  return {
    activeTool: 'select',
    temporaryToolOverride: null,
    clipboard: {
      objects: [],
      rootIds: [],
      pasteCount: 0,
    },
    panels: {
      open: {
        outliner: true,
        inspector: true,
      },
      mobileOpenPanel: null,
      collapsedNodeIds: [],
    },
    viewport: {
      ...DEFAULT_VIEWPORT,
    },
    scene: {
      objects: seedObjects(),
      marquee: null,
    },
    selection: {
      ids: [],
      primaryId: null,
    },
    overlays: {
      contextMenu: null,
      focusRequest: null,
      activeBodyEditorObjectId: null,
      isBodyEditorOpen: false,
      bodyEditorPendingText: null,
    },
  };
}

function cloneCanvasObjects(objects: EditorCanvasObject[]) {
  return objects.map((object) => ({
    ...object,
    body: cloneBody(object.body),
  }));
}

function cloneSelection(selection: EditorSelectionState): EditorSelectionState {
  return {
    ids: [...selection.ids],
    primaryId: selection.primaryId,
  };
}

function createHistorySnapshot(state: Pick<EditorState, 'scene' | 'selection'>): EditorHistorySnapshot {
  return {
    objects: cloneCanvasObjects(state.scene.objects),
    selection: cloneSelection(state.selection),
  };
}

function historySnapshotsMatch(left: EditorHistorySnapshot, right: EditorHistorySnapshot) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function restoreHistorySnapshot(state: EditorState, snapshot: EditorHistorySnapshot) {
  return {
    scene: {
      ...state.scene,
      objects: cloneCanvasObjects(snapshot.objects),
      marquee: null,
    },
    ...withClearedContext(cloneSelection(snapshot.selection)),
  };
}

function normalizeSelection(ids: string[], primaryId: string | null): EditorSelectionState {
  const uniqueIds = [...new Set(ids)];
  return {
    ids: uniqueIds,
    primaryId: primaryId && uniqueIds.includes(primaryId) ? primaryId : uniqueIds[0] ?? null,
  };
}

function withClearedContext(selection: EditorSelectionState) {
  return {
    selection,
    overlays: {
      contextMenu: null,
      focusRequest: null,
      activeBodyEditorObjectId: null,
      isBodyEditorOpen: false,
      bodyEditorPendingText: null,
    },
  };
}

function buildDraftObject(input: {
  kind: Exclude<EditorCanvasObjectKind, 'group'>;
  x: number;
  y: number;
  zIndex: number;
  parentId?: string | null;
}): EditorCanvasObject {
  const defaults = OBJECT_DEFAULTS[input.kind];
  const id = createObjectId(input.kind);
  return {
    id,
    kind: input.kind,
    name: `${getKindLabel(input.kind)} ${objectCounter}`,
    parentId: input.parentId ?? null,
    x: input.x,
    y: input.y,
    width: defaults.width,
    height: defaults.height,
    rotation: 0,
    zIndex: input.zIndex,
    locked: false,
    visible: true,
    fillPreset: defaults.fillPreset,
    fillColor: resolveFillColor(defaults.fillPreset),
    outlinePreset: defaults.outlinePreset,
    outlineColor: resolveOutlineColor(defaults.fillPreset),
    shapeVariant: input.kind === 'shape' ? 'rectangle' : undefined,
    body: createSeedBodyDocument({
      kind: input.kind,
      placeholderImageSrc: PLACEHOLDER_IMAGE,
    }),
  };
}

function getSelectionRoots(selectionIds: string[], objects: EditorCanvasObject[]) {
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

function moveObjects(
  objects: EditorCanvasObject[],
  targetIds: string[],
  deltaX: number,
  deltaY: number,
) {
  const ids = new Set(targetIds);
  return objects.map((object) => (
    ids.has(object.id)
      ? {
          ...object,
          x: object.x + deltaX,
          y: object.y + deltaY,
        }
      : object
  ));
}

function collectMoveTargets(selectionIds: string[], objects: EditorCanvasObject[]) {
  const roots = getSelectionRoots(selectionIds, objects);
  const moveIds = new Set<string>();

  roots.forEach((rootId) => {
    moveIds.add(rootId);
    getDescendantIds(rootId, objects).forEach((descendantId) => moveIds.add(descendantId));
  });

  return [...moveIds];
}

function cloneBranch(
  rootId: string,
  objects: EditorCanvasObject[],
  offset: { x: number; y: number },
  parentId: string | null,
  clones: EditorCanvasObject[],
) {
  const original = objects.find((object) => object.id === rootId);
  if (!original) {
    return;
  }

  const nextId = createObjectId(original.kind);
  clones.push({
    ...original,
    id: nextId,
    name: `${original.name} copy`,
    body: cloneBody(original.body),
    parentId,
    x: original.x + offset.x,
    y: original.y + offset.y,
    zIndex: original.zIndex + 20,
  });

  getChildObjects(objects, rootId).forEach((child) => {
    cloneBranch(child.id, objects, offset, nextId, clones);
  });
}

function removeObjects(objects: EditorCanvasObject[], ids: string[]) {
  const removalIds = new Set<string>();
  ids.forEach((id) => {
    removalIds.add(id);
    getDescendantIds(id, objects).forEach((descendantId) => removalIds.add(descendantId));
  });
  return objects.filter((object) => !removalIds.has(object.id));
}

function restackObjects(
  objects: EditorCanvasObject[],
  ids: string[],
  direction: 'front' | 'back' | 'forward' | 'backward',
) {
  const selection = new Set(ids);
  const ordered = [...objects].sort((left, right) => left.zIndex - right.zIndex);

  if (direction === 'front' || direction === 'back') {
    const rest = ordered.filter((object) => !selection.has(object.id));
    const moving = ordered.filter((object) => selection.has(object.id));
    const nextOrdered = direction === 'front' ? [...rest, ...moving] : [...moving, ...rest];

    return nextOrdered.map((object, index) => ({
      ...object,
      zIndex: index + 1,
    }));
  }

  const nextOrdered = [...ordered];
  if (direction === 'forward') {
    for (let index = nextOrdered.length - 2; index >= 0; index -= 1) {
      if (selection.has(nextOrdered[index]!.id) && !selection.has(nextOrdered[index + 1]!.id)) {
        [nextOrdered[index], nextOrdered[index + 1]] = [nextOrdered[index + 1]!, nextOrdered[index]!];
      }
    }
  } else {
    for (let index = 1; index < nextOrdered.length; index += 1) {
      if (selection.has(nextOrdered[index]!.id) && !selection.has(nextOrdered[index - 1]!.id)) {
        [nextOrdered[index - 1], nextOrdered[index]] = [nextOrdered[index]!, nextOrdered[index - 1]!];
      }
    }
  }

  return nextOrdered.map((object, index) => ({
    ...object,
    zIndex: index + 1,
  }));
}

function createClipboardSnapshot(selectionIds: string[], objects: EditorCanvasObject[]) {
  const rootIds = getSelectionRoots(selectionIds, objects);
  const copiedIds = new Set<string>();

  rootIds.forEach((rootId) => {
    copiedIds.add(rootId);
    getDescendantIds(rootId, objects).forEach((descendantId) => copiedIds.add(descendantId));
  });

  return {
    objects: cloneCanvasObjects(objects.filter((object) => copiedIds.has(object.id))),
    rootIds,
    pasteCount: 0,
  };
}

function setFieldPatch(
  object: EditorCanvasObject,
  field: keyof EditorCanvasObject,
  value: string,
) {
  if (field === 'x' || field === 'y' || field === 'width' || field === 'height' || field === 'zIndex' || field === 'rotation') {
    const nextValue = Number(value);
    if (!Number.isFinite(nextValue)) {
      return object;
    }

    if (field === 'width') {
      return {
        ...object,
        width: Math.max(nextValue, MIN_OBJECT_WIDTH),
      };
    }

    if (field === 'height') {
      return {
        ...object,
        height: Math.max(nextValue, getMinimumObjectHeight(object)),
      };
    }

    if (field === 'rotation') {
      return {
        ...object,
        rotation: normalizeRotationDegrees(nextValue),
      };
    }

    return {
      ...object,
      [field]: nextValue,
    };
  }

  return {
    ...object,
    [field]: value,
  };
}

function getMinimumObjectHeight(object: EditorCanvasObject) {
  if (object.kind === 'group') {
    return MIN_OBJECT_HEIGHT;
  }
  return Math.max(MIN_OBJECT_HEIGHT, getCanvasObjectMinimumHeight(object));
}

function sanitizeObjectPatch(object: EditorCanvasObject, patch: Partial<EditorCanvasObject>) {
  const nextPatch = { ...patch };

  if (typeof nextPatch['width'] === 'number') {
    nextPatch.width = Math.max(nextPatch.width, MIN_OBJECT_WIDTH);
  }

  if (typeof nextPatch['height'] === 'number') {
    nextPatch.height = Math.max(nextPatch.height, getMinimumObjectHeight({
      ...object,
      width: typeof nextPatch['width'] === 'number' ? nextPatch.width : object.width,
    }));
  }

  if (typeof nextPatch['rotation'] === 'number') {
    nextPatch.rotation = normalizeRotationDegrees(nextPatch.rotation);
  }

  if (typeof nextPatch['fillColor'] === 'string') {
    nextPatch.fillColor = parseColorInput(nextPatch.fillColor, object.fillColor);
  }

  if (typeof nextPatch['outlineColor'] === 'string') {
    nextPatch.outlineColor = parseColorInput(nextPatch.outlineColor, object.outlineColor);
  }

  if (typeof nextPatch['shapeVariant'] === 'string' && object.kind !== 'shape') {
    delete nextPatch.shapeVariant;
  }

  return nextPatch;
}

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

function applySelectionTransform(input: {
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
    const nextWidth = Math.max(frame.width * (input.nextFrame.width / input.baseFrame.width), MIN_OBJECT_WIDTH);
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

export interface EditorState {
  activeTool: EditorTool;
  temporaryToolOverride: EditorTool | null;
  clipboard: {
    objects: EditorCanvasObject[];
    rootIds: string[];
    pasteCount: number;
  };
  panels: {
    open: Record<EditorPanelId, boolean>;
    mobileOpenPanel: EditorPanelId | null;
    collapsedNodeIds: string[];
  };
  viewport: {
    x: number;
    y: number;
    zoom: number;
    width: number;
    height: number;
  };
  scene: {
    objects: EditorCanvasObject[];
    marquee: import('./editor-types').EditorMarqueeState | null;
  };
  selection: EditorSelectionState;
  overlays: {
    contextMenu: EditorContextMenuState | null;
    focusRequest: import('./editor-types').EditorFocusRequest | null;
    activeBodyEditorObjectId: string | null;
    isBodyEditorOpen: boolean;
    bodyEditorPendingText: string | null;
  };
}

interface EditorStore extends EditorState {
  reset: () => void;
  setActiveTool: (tool: EditorTool) => void;
  togglePanel: (panelId: EditorPanelId) => void;
  showPanel: (panelId: EditorPanelId) => void;
  openMobilePanel: (panelId: EditorPanelId | null) => void;
  toggleHierarchyNode: (objectId: string) => void;
  setViewportRect: (width: number, height: number) => void;
  panViewport: (deltaX: number, deltaY: number) => void;
  setZoom: (nextZoom: number) => void;
  createObjectAtViewportCenter: (kind: Exclude<EditorCanvasObjectKind, 'group'>) => void;
  selectOnly: (objectId: string) => void;
  toggleSelection: (objectId: string) => void;
  selectMany: (objectIds: string[], primaryId?: string | null) => void;
  clearSelection: () => void;
  setMarquee: (bounds: EditorMarqueeState | null) => void;
  moveSelection: (deltaX: number, deltaY: number) => void;
  resizeSelection: (input: {
    baseObjects: EditorCanvasObject[];
    baseFrame: EditorTransformFrame;
    nextFrame: EditorTransformFrame;
  }) => void;
  rotateSelection: (input: {
    baseObjects: EditorCanvasObject[];
    baseFrame: EditorTransformFrame;
    nextFrame: EditorTransformFrame;
  }) => void;
  updateObjectField: (objectId: string, field: keyof EditorCanvasObject, value: string) => void;
  updateObjectPatch: (objectId: string, patch: Partial<EditorCanvasObject>) => void;
  updateSelectionPatch: (patch: Partial<Pick<EditorCanvasObject, 'locked' | 'visible'>>) => void;
  openBodyEditor: (objectId: string, pendingText?: string | null) => void;
  closeBodyEditor: (options?: { clearPendingText?: boolean }) => void;
  consumeBodyEditorPendingText: () => string | null;
  updateObjectBody: (objectId: string, body: EditorCanvasObject['body']) => void;
  setContextMenu: (menu: EditorContextMenuState | null) => void;
  requestNameFocus: (objectId: string) => void;
  requestStyleFocus: (objectId: string, field: Extract<import('./editor-types').EditorFocusableField, 'fill' | 'border'>) => void;
  clearFocusRequest: () => void;
  copySelection: () => void;
  pasteClipboard: () => void;
  bringSelectionToFront: () => void;
  bringSelectionForward: () => void;
  sendSelectionBackward: () => void;
  sendSelectionToBack: () => void;
  duplicateSelection: () => void;
  deleteSelection: () => void;
  groupSelection: () => void;
  ungroupSelection: () => void;
  setTemporaryToolOverride: (tool: EditorTool | null) => void;
  captureHistorySnapshot: () => EditorHistorySnapshot;
  commitHistoryEntry: (label: string, before: EditorHistorySnapshot) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export const useEditorStore = create<EditorStore>((set, get) => {
  function commitCanvasMutation(
    label: string,
    reducer: (state: EditorStore) => Partial<EditorStore> | EditorStore,
  ) {
    let nextHistoryEntry: {
      label: string;
      before: EditorHistorySnapshot;
      after: EditorHistorySnapshot;
    } | null = null;

    set((state) => {
      const nextState = reducer(state);
      if (nextState === state) {
        return state;
      }

      const normalizedNextState = 'scene' in nextState && nextState.scene?.objects
        ? {
            ...nextState,
            scene: {
              ...nextState.scene,
              objects: syncGroupFrames(nextState.scene.objects),
            },
          }
        : nextState;

      const before = createHistorySnapshot(state);
      const mergedState = { ...state, ...normalizedNextState };
      const after = createHistorySnapshot(mergedState);
      if (!historySnapshotsMatch(before, after)) {
        nextHistoryEntry = {
          label,
          before,
          after,
        };
      }
      return normalizedNextState;
    });

    if (nextHistoryEntry) {
      historyStack.push(nextHistoryEntry);
    }
  }

  return {
    ...createInitialState(),
    reset: () => {
      objectCounter = 0;
      focusRequestCounter = 1;
      historyStack.clear();
      set(createInitialState());
    },
    setActiveTool: (tool) => {
      set({
        activeTool: tool,
        temporaryToolOverride: null,
        overlays: {
          contextMenu: null,
          focusRequest: null,
          activeBodyEditorObjectId: null,
          isBodyEditorOpen: false,
          bodyEditorPendingText: null,
        },
      });
    },
    togglePanel: (panelId) => {
      set((state) => ({
        panels: {
          ...state.panels,
          open: {
            ...state.panels.open,
            [panelId]: !state.panels.open[panelId],
          },
        },
      }));
    },
    showPanel: (panelId) => {
      set((state) => ({
        panels: {
          ...state.panels,
          open: {
            ...state.panels.open,
            [panelId]: true,
          },
          mobileOpenPanel: shouldUseMobilePanel() ? panelId : state.panels.mobileOpenPanel,
        },
      }));
    },
    openMobilePanel: (panelId) => {
      set((state) => ({
        panels: {
          ...state.panels,
          mobileOpenPanel: panelId,
        },
      }));
    },
    toggleHierarchyNode: (objectId) => {
      set((state) => {
        const collapsed = new Set(state.panels.collapsedNodeIds);
        if (collapsed.has(objectId)) {
          collapsed.delete(objectId);
        } else {
          collapsed.add(objectId);
        }
        return {
          panels: {
            ...state.panels,
            collapsedNodeIds: [...collapsed],
          },
        };
      });
    },
    setViewportRect: (width, height) => {
      set((state) => ({
        viewport: {
          ...state.viewport,
          width,
          height,
        },
      }));
    },
    panViewport: (deltaX, deltaY) => {
      set((state) => ({
        viewport: {
          ...state.viewport,
          x: state.viewport.x + deltaX,
          y: state.viewport.y + deltaY,
        },
      }));
    },
    setZoom: (nextZoom) => {
      set((state) => ({
        viewport: {
          ...state.viewport,
          zoom: clamp(nextZoom, 0.65, 1.6),
        },
      }));
    },
    createObjectAtViewportCenter: (kind) => {
      commitCanvasMutation('Create object', (state) => {
        const defaults = OBJECT_DEFAULTS[kind];
        const x = (state.viewport.width / 2 - state.viewport.x) / state.viewport.zoom - defaults.width / 2;
        const y = (state.viewport.height / 2 - state.viewport.y) / state.viewport.zoom - defaults.height / 2;
        const nextObject = buildDraftObject({
          kind,
          x,
          y,
          zIndex: nextZIndex(state.scene.objects),
        });
        const selection = normalizeSelection([nextObject.id], nextObject.id);

        return {
          activeTool: 'select',
          temporaryToolOverride: null,
          scene: {
            ...state.scene,
            objects: [...state.scene.objects, nextObject],
          },
          ...withClearedContext(selection),
        };
      });
    },
    selectOnly: (objectId) => {
      set({
        ...withClearedContext(normalizeSelection([objectId], objectId)),
      });
    },
    toggleSelection: (objectId) => {
      set((state) => {
        const ids = state.selection.ids.includes(objectId)
          ? state.selection.ids.filter((id) => id !== objectId)
          : [...state.selection.ids, objectId];

        return {
          ...withClearedContext(normalizeSelection(ids, objectId)),
        };
      });
    },
    selectMany: (objectIds, primaryId = null) => {
      set({
        ...withClearedContext(normalizeSelection(objectIds, primaryId)),
      });
    },
    clearSelection: () => {
      set({
        ...withClearedContext({
          ids: [],
          primaryId: null,
        }),
      });
    },
    setMarquee: (marquee) => {
      set((state) => ({
        scene: {
          ...state.scene,
          marquee,
        },
      }));
    },
    moveSelection: (deltaX, deltaY) => {
      set((state) => {
        const moveIds = collectMoveTargets(state.selection.ids, state.scene.objects);
        return {
          scene: {
            ...state.scene,
            objects: syncGroupFrames(moveObjects(state.scene.objects, moveIds, deltaX, deltaY)),
          },
        };
      });
    },
    resizeSelection: ({ baseObjects, baseFrame, nextFrame }) => {
      set((state) => {
        const hasLockedSelection = state.selection.ids.some((id) => state.scene.objects.find((object) => object.id === id)?.locked);
        if (hasLockedSelection) {
          return state;
        }

        return {
          scene: {
            ...state.scene,
            objects: applySelectionTransform({
              baseObjects,
              selectionIds: state.selection.ids,
              baseFrame,
              nextFrame: {
                ...nextFrame,
                rotation: baseFrame.rotation,
              },
            }),
          },
        };
      });
    },
    rotateSelection: ({ baseObjects, baseFrame, nextFrame }) => {
      set((state) => {
        const hasLockedSelection = state.selection.ids.some((id) => state.scene.objects.find((object) => object.id === id)?.locked);
        if (hasLockedSelection) {
          return state;
        }

        return {
          scene: {
            ...state.scene,
            objects: applySelectionTransform({
              baseObjects,
              selectionIds: state.selection.ids,
              baseFrame,
              nextFrame: {
                ...nextFrame,
                width: baseFrame.width,
                height: baseFrame.height,
              },
            }),
          },
        };
      });
    },
    updateObjectField: (objectId, field, value) => {
      commitCanvasMutation('Update object field', (state) => ({
        scene: {
          ...state.scene,
          objects: state.scene.objects.map((object) => (
            object.id === objectId ? setFieldPatch(object, field, value) : object
          )),
        },
      }));
    },
    updateObjectPatch: (objectId, patch) => {
      commitCanvasMutation('Update object patch', (state) => ({
        scene: {
          ...state.scene,
          objects: state.scene.objects.map((object) => (
            object.id === objectId ? { ...object, ...sanitizeObjectPatch(object, patch) } : object
          )),
        },
      }));
    },
    updateSelectionPatch: (patch) => {
      commitCanvasMutation('Update selection patch', (state) => {
        const selection = new Set(state.selection.ids);
        return {
          scene: {
            ...state.scene,
            objects: state.scene.objects.map((object) => (
              selection.has(object.id) ? { ...object, ...patch } : object
            )),
          },
        };
      });
    },
    openBodyEditor: (objectId, pendingText = null) => {
      set((state) => {
        const object = state.scene.objects.find((candidate) => candidate.id === objectId);
        if (!object || object.kind === 'group') {
          return state;
        }

        const selection = normalizeSelection([objectId], objectId);
        return {
          selection,
          overlays: {
            contextMenu: null,
            focusRequest: null,
            activeBodyEditorObjectId: objectId,
            isBodyEditorOpen: true,
            bodyEditorPendingText: pendingText,
          },
        };
      });
    },
    closeBodyEditor: (options) => {
      set((state) => ({
        overlays: {
          ...state.overlays,
          activeBodyEditorObjectId: null,
          isBodyEditorOpen: false,
          bodyEditorPendingText: options?.clearPendingText === false ? state.overlays.bodyEditorPendingText : null,
        },
      }));
    },
    consumeBodyEditorPendingText: () => {
      const pendingText = get().overlays.bodyEditorPendingText;
      if (pendingText !== null) {
        set((state) => ({
          overlays: {
            ...state.overlays,
            bodyEditorPendingText: null,
          },
        }));
      }
      return pendingText;
    },
    updateObjectBody: (objectId, body) => {
      commitCanvasMutation('Edit document body', (state) => {
        const object = state.scene.objects.find((candidate) => candidate.id === objectId);
        if (!object || object.kind === 'group') {
          return state;
        }

        return {
          scene: {
            ...state.scene,
            objects: state.scene.objects.map((candidate) => (
              candidate.id === objectId
                ? {
                    ...candidate,
                    body: cloneBody(body),
                  }
                : candidate
            )),
          },
          overlays: {
            ...state.overlays,
            activeBodyEditorObjectId: null,
            isBodyEditorOpen: false,
            bodyEditorPendingText: null,
          },
        };
      });
    },
    setContextMenu: (menu) => {
      set((state) => ({
        overlays: {
          ...state.overlays,
          contextMenu: menu,
        },
      }));
    },
    requestNameFocus: (objectId) => {
      set((state) => ({
        panels: {
          ...state.panels,
          open: {
            ...state.panels.open,
            inspector: true,
          },
          mobileOpenPanel: shouldUseMobilePanel() ? 'inspector' : state.panels.mobileOpenPanel,
        },
        overlays: {
          ...state.overlays,
          contextMenu: null,
          focusRequest: {
            objectId,
            field: 'name',
            requestId: focusRequestCounter++,
          },
          activeBodyEditorObjectId: null,
          isBodyEditorOpen: false,
          bodyEditorPendingText: null,
        },
      }));
    },
    requestStyleFocus: (objectId, field) => {
      set((state) => ({
        panels: {
          ...state.panels,
          open: {
            ...state.panels.open,
            inspector: true,
          },
          mobileOpenPanel: shouldUseMobilePanel() ? 'inspector' : state.panels.mobileOpenPanel,
        },
        overlays: {
          ...state.overlays,
          contextMenu: null,
          focusRequest: {
            objectId,
            field,
            requestId: focusRequestCounter++,
          },
          activeBodyEditorObjectId: null,
          isBodyEditorOpen: false,
          bodyEditorPendingText: null,
        },
      }));
    },
    clearFocusRequest: () => {
      set((state) => ({
        overlays: {
          ...state.overlays,
          focusRequest: null,
        },
      }));
    },
    copySelection: () => {
      set((state) => {
        if (state.selection.ids.length === 0) {
          return state;
        }

        return {
          clipboard: createClipboardSnapshot(state.selection.ids, state.scene.objects),
        };
      });
    },
    pasteClipboard: () => {
      commitCanvasMutation('Paste selection', (state) => {
        if (state.clipboard.rootIds.length === 0) {
          return state;
        }

        const offsetMultiplier = state.clipboard.pasteCount + 1;
        const offset = {
          x: 24 * offsetMultiplier,
          y: 24 * offsetMultiplier,
        };
        const clones: EditorCanvasObject[] = [];
        const rootCloneIds: string[] = [];

        state.clipboard.rootIds.forEach((rootId) => {
          const root = state.clipboard.objects.find((candidate) => candidate.id === rootId);
          const previousLength = clones.length;
          const targetParentId = root?.parentId && state.scene.objects.some((object) => object.id === root.parentId)
            ? root.parentId
            : null;
          cloneBranch(rootId, state.clipboard.objects, offset, targetParentId, clones);
          const rootClone = clones[previousLength];
          if (rootClone) {
            rootCloneIds.push(rootClone.id);
          }
        });

        if (clones.length === 0) {
          return state;
        }

        const selection = normalizeSelection(rootCloneIds, rootCloneIds[0] ?? null);
        return {
          scene: {
            ...state.scene,
            objects: [...state.scene.objects, ...clones],
          },
          clipboard: {
            ...state.clipboard,
            pasteCount: offsetMultiplier,
          },
          ...withClearedContext(selection),
        };
      });
    },
    bringSelectionToFront: () => {
      commitCanvasMutation('Bring selection to front', (state) => ({
        scene: {
          ...state.scene,
          objects: restackObjects(state.scene.objects, state.selection.ids, 'front'),
        },
      }));
    },
    bringSelectionForward: () => {
      commitCanvasMutation('Bring selection forward', (state) => ({
        scene: {
          ...state.scene,
          objects: restackObjects(state.scene.objects, state.selection.ids, 'forward'),
        },
      }));
    },
    sendSelectionBackward: () => {
      commitCanvasMutation('Send selection backward', (state) => ({
        scene: {
          ...state.scene,
          objects: restackObjects(state.scene.objects, state.selection.ids, 'backward'),
        },
      }));
    },
    sendSelectionToBack: () => {
      commitCanvasMutation('Send selection to back', (state) => ({
        scene: {
          ...state.scene,
          objects: restackObjects(state.scene.objects, state.selection.ids, 'back'),
        },
      }));
    },
    duplicateSelection: () => {
      commitCanvasMutation('Duplicate selection', (state) => {
      const roots = getSelectionRoots(state.selection.ids, state.scene.objects);
      const clones: EditorCanvasObject[] = [];
      const rootCloneIds: string[] = [];
      roots.forEach((rootId) => {
        const root = state.scene.objects.find((candidate) => candidate.id === rootId);
        const previousLength = clones.length;
        cloneBranch(rootId, state.scene.objects, { x: 24, y: 24 }, root?.parentId ?? null, clones);
        const rootClone = clones[previousLength];
        if (rootClone) {
          rootCloneIds.push(rootClone.id);
        }
      });
      const selection = normalizeSelection(rootCloneIds, rootCloneIds[0] ?? null);

      return {
        scene: {
          ...state.scene,
          objects: [...state.scene.objects, ...clones],
        },
        ...withClearedContext(selection),
      };
    });
    },
    deleteSelection: () => {
      commitCanvasMutation('Delete selection', (state) => ({
        scene: {
          ...state.scene,
          objects: removeObjects(state.scene.objects, state.selection.ids),
        },
        ...withClearedContext({
          ids: [],
          primaryId: null,
        }),
      }));
    },
    groupSelection: () => {
      commitCanvasMutation('Group selection', (state) => {
      if (state.selection.ids.length < 2) {
        return state;
      }

      const bounds = getSelectionBounds(state.selection, state.scene.objects);
      if (!bounds) {
        return state;
      }

      const groupId = createObjectId('group');
      const roots = getSelectionRoots(state.selection.ids, state.scene.objects);
      const objectMap = createObjectMap(state.scene.objects);
      const parentId = objectMap.get(roots[0])?.parentId ?? null;

      const group: EditorCanvasObject = {
        id: groupId,
        kind: 'group',
        name: `Group ${objectCounter}`,
        parentId,
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        rotation: 0,
        zIndex: nextZIndex(state.scene.objects),
        locked: false,
        visible: true,
        fillPreset: 'slate',
        fillColor: resolveFillColor('slate'),
        outlinePreset: 'none',
        outlineColor: resolveOutlineColor('slate'),
        shapeVariant: undefined,
        body: createBodyDocument(),
      };

      const objects = state.scene.objects.map((object) => (
        roots.includes(object.id) ? { ...object, parentId: groupId } : object
      ));
      const selection = normalizeSelection([groupId], groupId);

      return {
        scene: {
          ...state.scene,
          objects: [...objects, group],
        },
        ...withClearedContext(selection),
      };
    });
    },
    ungroupSelection: () => {
      commitCanvasMutation('Ungroup selection', (state) => {
      const selectedGroups = state.scene.objects.filter((object) => (
        state.selection.ids.includes(object.id) && object.kind === 'group'
      ));

      if (selectedGroups.length === 0) {
        const objectMap = createObjectMap(state.scene.objects);
        const parentIds = [...new Set(
          state.selection.ids.map((id) => objectMap.get(id)?.parentId ?? null).filter(Boolean),
        )];
        const parentGroup = parentIds
          .map((parentId) => state.scene.objects.find((object) => object.id === parentId))
          .find((object): object is EditorCanvasObject => object?.kind === 'group');

        if (!parentGroup) {
          return state;
        }

        selectedGroups.push(parentGroup);
      }

      const groupIds = new Set(selectedGroups.map((group) => group.id));
      const parentByGroup = new Map(selectedGroups.map((group) => [group.id, group.parentId]));
      const childSelectionIds = state.scene.objects
        .filter((object) => object.parentId && groupIds.has(object.parentId))
        .map((object) => object.id);
      const objects = state.scene.objects
        .filter((object) => !groupIds.has(object.id))
        .map((object) => (
          object.parentId && groupIds.has(object.parentId)
            ? {
                ...object,
                parentId: parentByGroup.get(object.parentId) ?? null,
              }
            : object
        ));

      return {
        scene: {
          ...state.scene,
          objects,
        },
        ...withClearedContext(normalizeSelection(childSelectionIds, childSelectionIds[0] ?? null)),
      };
    });
    },
    setTemporaryToolOverride: (tool) => {
      set((state) => {
        if (tool === 'pan' && state.activeTool === 'pan') {
          return state;
        }
        if (state.temporaryToolOverride === tool) {
          return state;
        }
        return {
          temporaryToolOverride: tool,
        };
      });
    },
    captureHistorySnapshot: () => createHistorySnapshot(get()),
    commitHistoryEntry: (label, before) => {
      const after = createHistorySnapshot(get());
      if (historySnapshotsMatch(before, after)) {
        return;
      }

      historyStack.push({
        label,
        before,
        after,
      });
    },
    undo: () => {
      const entry = historyStack.undo();
      if (!entry) {
        return;
      }
      set((state) => restoreHistorySnapshot(state, entry.before));
    },
    redo: () => {
      const entry = historyStack.redo();
      if (!entry) {
        return;
      }
      set((state) => restoreHistorySnapshot(state, entry.after));
    },
    canUndo: () => historyStack.canUndo(),
    canRedo: () => historyStack.canRedo(),
  };
});

export function getEffectiveTool(state: Pick<EditorState, 'activeTool' | 'temporaryToolOverride'>) {
  return state.temporaryToolOverride ?? state.activeTool;
}

export function getPrimarySelectionObject(state: EditorStore) {
  return state.scene.objects.find((object) => object.id === state.selection.primaryId) ?? null;
}

export function getSelectionStats(state: EditorStore) {
  const bounds = getSelectionBounds(state.selection, state.scene.objects);
  return {
    count: state.selection.ids.length,
    bounds,
  };
}
