'use client';

import { create } from 'zustand';
import { UndoStack } from '../history/undo-stack';
import { clamp, createObjectMap, getChildObjects, getDescendantIds, getSelectionBounds, nextZIndex } from './editor-geometry';
import type {
  EditorCanvasObject,
  EditorCanvasObjectKind,
  EditorContextMenuState,
  EditorFillPreset,
  EditorHistorySnapshot,
  EditorImageFit,
  EditorMarqueeState,
  EditorPanelId,
  EditorSelectionState,
  EditorTextStyle,
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

const FILL_PRESETS: EditorFillPreset[] = ['iris', 'sky', 'mint', 'amber', 'blush', 'slate'];

const OBJECT_DEFAULTS: Record<
  Exclude<EditorCanvasObjectKind, 'group'>,
  Pick<
    EditorCanvasObject,
    'width' | 'height' | 'fillPreset' | 'text' | 'imageFit' | 'textStyle'
  >
> = {
  shape: {
    width: 184,
    height: 124,
    fillPreset: 'iris',
    text: 'New shape',
    imageFit: 'cover',
    textStyle: 'body',
  },
  sticky: {
    width: 208,
    height: 208,
    fillPreset: 'amber',
    text: 'Capture the next step while it is still fresh.',
    imageFit: 'cover',
    textStyle: 'body',
  },
  text: {
    width: 240,
    height: 108,
    fillPreset: 'slate',
    text: 'Headline the idea, then let the layout breathe.',
    imageFit: 'cover',
    textStyle: 'headline',
  },
  image: {
    width: 252,
    height: 180,
    fillPreset: 'sky',
    text: 'Reference',
    imageFit: 'cover',
    textStyle: 'body',
  },
  frame: {
    width: 380,
    height: 256,
    fillPreset: 'sky',
    text: 'New frame',
    imageFit: 'cover',
    textStyle: 'body',
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
    },
  };
}

function cloneCanvasObjects(objects: EditorCanvasObject[]) {
  return objects.map((object) => ({ ...object }));
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
    },
  };
}

function cycleFillPreset(current: EditorFillPreset) {
  const index = FILL_PRESETS.indexOf(current);
  return FILL_PRESETS[(index + 1 + FILL_PRESETS.length) % FILL_PRESETS.length];
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
    zIndex: input.zIndex,
    locked: false,
    visible: true,
    text: defaults.text,
    fillPreset: defaults.fillPreset,
    ...(input.kind === 'image'
      ? {
          imageFit: defaults.imageFit as EditorImageFit,
          imageSrc: PLACEHOLDER_IMAGE,
        }
      : {}),
    ...(input.kind === 'text' || input.kind === 'sticky'
      ? {
          textStyle: defaults.textStyle as EditorTextStyle,
        }
      : {}),
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
  direction: 'front' | 'back',
) {
  const selection = new Set(ids);
  const rest = objects.filter((object) => !selection.has(object.id)).sort((left, right) => left.zIndex - right.zIndex);
  const moving = objects.filter((object) => selection.has(object.id)).sort((left, right) => left.zIndex - right.zIndex);
  const ordered = direction === 'front' ? [...rest, ...moving] : [...moving, ...rest];
  return ordered.map((object, index) => ({
    ...object,
    zIndex: index + 1,
  }));
}

function setFieldPatch(
  object: EditorCanvasObject,
  field: keyof EditorCanvasObject,
  value: string,
) {
  if (field === 'x' || field === 'y' || field === 'width' || field === 'height' || field === 'zIndex') {
    const nextValue = Number(value);
    if (!Number.isFinite(nextValue)) {
      return object;
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

export interface EditorState {
  activeTool: EditorTool;
  temporaryToolOverride: EditorTool | null;
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
  updateObjectField: (objectId: string, field: keyof EditorCanvasObject, value: string) => void;
  updateObjectPatch: (objectId: string, patch: Partial<EditorCanvasObject>) => void;
  updateSelectionPatch: (patch: Partial<Pick<EditorCanvasObject, 'locked' | 'visible'>>) => void;
  cycleQuickProperty: (objectId: string) => void;
  setContextMenu: (menu: EditorContextMenuState | null) => void;
  requestNameFocus: (objectId: string) => void;
  clearFocusRequest: () => void;
  bringSelectionToFront: () => void;
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

      const before = createHistorySnapshot(state);
      const mergedState = { ...state, ...nextState };
      const after = createHistorySnapshot(mergedState);
      if (!historySnapshotsMatch(before, after)) {
        nextHistoryEntry = {
          label,
          before,
          after,
        };
      }
      return nextState;
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
            objects: moveObjects(state.scene.objects, moveIds, deltaX, deltaY),
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
            object.id === objectId ? { ...object, ...patch } : object
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
    cycleQuickProperty: (objectId) => {
      commitCanvasMutation('Cycle quick property', (state) => ({
        scene: {
          ...state.scene,
          objects: state.scene.objects.map((object) => {
            if (object.id !== objectId) {
              return object;
            }
            if (object.kind === 'image') {
              return {
                ...object,
                imageFit: object.imageFit === 'contain' ? 'cover' : 'contain',
              };
            }
            if (object.kind === 'text') {
              return {
                ...object,
                textStyle: object.textStyle === 'headline' ? 'body' : 'headline',
              };
            }
            return {
              ...object,
              fillPreset: cycleFillPreset(object.fillPreset),
            };
          }),
        },
      }));
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
    bringSelectionToFront: () => {
      commitCanvasMutation('Bring selection to front', (state) => ({
        scene: {
          ...state.scene,
          objects: restackObjects(state.scene.objects, state.selection.ids, 'front'),
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
        zIndex: nextZIndex(state.scene.objects),
        locked: false,
        visible: true,
        text: '',
        fillPreset: 'slate',
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

export function quickPropertyLabel(object: EditorCanvasObject | null) {
  if (!object) {
    return null;
  }

  if (object.kind === 'image') {
    return object.imageFit === 'contain' ? 'Fit contain' : 'Fit cover';
  }
  if (object.kind === 'text') {
    return object.textStyle === 'headline' ? 'Headline style' : 'Body style';
  }
  return `Fill ${object.fillPreset}`;
}
