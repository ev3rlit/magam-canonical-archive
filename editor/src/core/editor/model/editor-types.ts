export type EditorTool = 'select' | 'pan' | 'shape' | 'sticky' | 'text' | 'image' | 'frame';

export type EditorPanelId = 'outliner' | 'inspector';

export type EditorCanvasObjectKind =
  | 'shape'
  | 'sticky'
  | 'text'
  | 'image'
  | 'frame'
  | 'group';

export type EditorFillPreset = 'iris' | 'sky' | 'mint' | 'amber' | 'blush' | 'slate';
export type EditorImageFit = 'cover' | 'contain';
export type EditorTextStyle = 'body' | 'headline';
export type EditorFocusableField = 'name';

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
  zIndex: number;
  locked: boolean;
  visible: boolean;
  text: string;
  fillPreset: EditorFillPreset;
  imageSrc?: string;
  imageFit?: EditorImageFit;
  textStyle?: EditorTextStyle;
}

export interface EditorBounds {
  x: number;
  y: number;
  width: number;
  height: number;
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

export interface EditorOverlayState {
  contextMenu: EditorContextMenuState | null;
  focusRequest: EditorFocusRequest | null;
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
