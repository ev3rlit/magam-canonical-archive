import type { StoreApi } from 'zustand';
import type { EditorState } from '../editor-state';
import type {
  EditorCanvasObject,
  EditorCanvasObjectKind,
  EditorContextMenuState,
  EditorFocusableField,
  EditorHistorySnapshot,
  EditorMarqueeState,
  EditorPanelId,
  EditorReferenceTarget,
  EditorTransformFrame,
  EditorTool,
} from '../editor-types';

export type EditorStoreSetState = StoreApi<EditorStore>['setState'];

export type EditorStoreMutation = Partial<EditorStore> | EditorStore;

export type EditorStoreMutationReducer = (state: EditorStore) => EditorStoreMutation;

export type EditorStoreCommitter = (
  label: string,
  reducer: EditorStoreMutationReducer,
) => void;

export interface BodyEditorActions {
  openBodyEditor: (objectId: string, pendingText?: string | null) => void;
  updateBodyEditorDraft: (objectId: string, body: EditorCanvasObject['body']) => void;
  commitActiveBodyEditor: () => void;
  discardActiveBodyEditor: () => void;
  closeBodyEditor: (options?: { clearPendingText?: boolean }) => void;
  consumeBodyEditorPendingText: () => string | null;
  updateObjectBody: (objectId: string, body: EditorCanvasObject['body']) => void;
}

export interface OverlayActions {
  setContextMenu: (menu: EditorContextMenuState | null) => void;
  requestNameFocus: (objectId: string) => void;
  requestStyleFocus: (objectId: string, field: Extract<EditorFocusableField, 'fill' | 'border'>) => void;
  clearFocusRequest: () => void;
}

export interface EditorStore extends EditorState, BodyEditorActions, OverlayActions {
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
  instantiateTemplateSnapshot: (objects: EditorCanvasObject[], libraryItemId: string) => void;
  placeLibraryAsset: (input: {
    itemId: string;
    src: string;
    alt: string;
    width?: number;
    height?: number;
  }) => void;
  placeReferenceItem: (input: {
    itemId: string;
    title: string;
    summary?: string | null;
    target: EditorReferenceTarget;
  }) => void;
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

export interface EditorStoreEnv {
  getState: () => EditorStore;
  setState: EditorStoreSetState;
  commitCanvasMutation: EditorStoreCommitter;
  nextFocusRequestId: () => number;
  shouldUseMobilePanel: () => boolean;
}
