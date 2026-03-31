import type { EditorBodyDocument } from './editor-body';

export type EditorTool = 'select' | 'pan' | 'shape' | 'sticky' | 'text' | 'image' | 'frame';

export type EditorPanelId = 'outliner' | 'inspector' | 'quickExplorer';

export interface EditorReferenceTarget {
  kind: 'url' | 'canvas' | 'object';
  value: string;
}

export type EditorCanvasObjectKind =
  | 'shape'
  | 'sticky'
  | 'text'
  | 'image'
  | 'frame'
  | 'group';

export type EditorFillPreset =
  | 'iris'
  | 'sky'
  | 'mint'
  | 'amber'
  | 'blush'
  | 'slate'
  | 'peach'
  | 'sage'
  | 'lavender'
  | 'sand';
export type EditorShapeVariant = 'rectangle' | 'rounded' | 'pill' | 'diamond';
export type EditorOutlinePreset = 'none' | 'thin' | 'medium' | 'dashed';
export type EditorFocusableField = 'name' | 'fill' | 'border';

export interface EditorViewportState {
  x: number;
  y: number;
  zoom: number;
  width: number;
  height: number;
}

export interface EditorCanvasObject {
  id: string;
  kind: EditorCanvasObjectKind;
  name: string;
  parentId: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  locked: boolean;
  visible: boolean;
  fillPreset: EditorFillPreset;
  fillColor: string;
  outlinePreset: EditorOutlinePreset;
  outlineColor: string;
  shapeVariant?: EditorShapeVariant;
  body: EditorBodyDocument;
  libraryItemId?: string | null;
  referenceTarget?: EditorReferenceTarget | null;
}

export interface EditorBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EditorTransformFrame extends EditorBounds {
  rotation: number;
}

export interface EditorSelectionState {
  ids: string[];
  primaryId: string | null;
}

export interface EditorHistorySnapshot {
  objects: EditorCanvasObject[];
  selection: EditorSelectionState;
}

export interface EditorMarqueeState extends EditorBounds {
  originX: number;
  originY: number;
}

export interface EditorContextMenuState {
  objectId: string;
  x: number;
  y: number;
}

export interface EditorPanelsState {
  open: Record<EditorPanelId, boolean>;
  mobileOpenPanel: EditorPanelId | null;
  collapsedNodeIds: string[];
}

export interface EditorFocusRequest {
  objectId: string;
  field: EditorFocusableField;
  requestId: number;
}

export interface EditorBodyEditorSession {
  objectId: string;
  draftBody: EditorBodyDocument;
  dirty: boolean;
  pendingEntryText: string | null;
}

export interface EditorOverlayState {
  contextMenu: EditorContextMenuState | null;
  focusRequest: EditorFocusRequest | null;
  bodyEditorSession: EditorBodyEditorSession | null;
  activeBodyEditorObjectId: string | null;
  isBodyEditorOpen: boolean;
  bodyEditorPendingText: string | null;
}

export interface EditorSceneState {
  objects: EditorCanvasObject[];
  marquee: EditorMarqueeState | null;
}

export interface EditorHierarchyNode {
  object: EditorCanvasObject;
  children: EditorHierarchyNode[];
  depth: number;
  selected: boolean;
  selectedDescendantCount: number;
  isCollapsed: boolean;
}
