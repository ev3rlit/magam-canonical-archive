export type EditorTool = 'select' | 'pan' | 'shape' | 'sticky' | 'text' | 'image' | 'frame';

export type EditorPanelId = 'outliner' | 'inspector';

export type EditorContentBlockType = 'text' | 'markdown' | 'canvas.image';
export type EditorBlockPaletteType = 'markdown' | 'text' | 'image';

export type EditorCanvasObjectKind =
  | 'shape'
  | 'sticky'
  | 'text'
  | 'image'
  | 'frame'
  | 'group';

export type EditorFillPreset = 'iris' | 'sky' | 'mint' | 'amber' | 'blush' | 'slate';
export type EditorShapeVariant = 'rectangle' | 'rounded' | 'pill' | 'diamond';
export type EditorOutlinePreset = 'none' | 'thin' | 'medium' | 'dashed';
export type EditorFocusableField = 'name' | 'fill' | 'border';

export interface EditorTextContentBlock {
  id: string;
  blockType: 'text';
  text: string;
}

export interface EditorMarkdownContentBlock {
  id: string;
  blockType: 'markdown';
  source: string;
}

export interface EditorImageContentBlock {
  id: string;
  blockType: 'canvas.image';
  src: string;
  alt: string;
}

export type EditorContentBlock =
  | EditorTextContentBlock
  | EditorMarkdownContentBlock
  | EditorImageContentBlock;

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
  contentBlocks: EditorContentBlock[];
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

export interface EditorBlockSelectionState {
  objectId: string;
  blockId: string | null;
}

export interface EditorBlockEditorState {
  objectId: string;
  blockId: string;
}

export interface EditorOverlayState {
  contextMenu: EditorContextMenuState | null;
  focusRequest: EditorFocusRequest | null;
  blockSelection: EditorBlockSelectionState | null;
  blockEditor: EditorBlockEditorState | null;
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
