import type {
  EditorCanvasObject,
  EditorOverlayState,
  EditorPanelsState,
  EditorSceneState,
  EditorSelectionState,
  EditorTool,
  EditorViewportState,
} from './editor-types';

export interface EditorClipboardState {
  objects: EditorCanvasObject[];
  rootIds: string[];
  pasteCount: number;
}

export interface EditorState {
  activeTool: EditorTool;
  temporaryToolOverride: EditorTool | null;
  clipboard: EditorClipboardState;
  panels: EditorPanelsState;
  viewport: EditorViewportState;
  scene: EditorSceneState;
  selection: EditorSelectionState;
  overlays: EditorOverlayState;
}

export function createInitialEditorState(input?: {
  viewport?: Partial<EditorViewportState>;
}): EditorState {
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
        quickExplorer: true,
      },
      mobileOpenPanel: null,
      collapsedNodeIds: [],
    },
    viewport: {
      x: input?.viewport?.x ?? 0,
      y: input?.viewport?.y ?? 0,
      zoom: input?.viewport?.zoom ?? 1,
      width: input?.viewport?.width ?? 0,
      height: input?.viewport?.height ?? 0,
    },
    scene: {
      objects: [],
      marquee: null,
    },
    selection: {
      ids: [],
      primaryId: null,
    },
    overlays: {
      contextMenu: null,
      focusRequest: null,
      bodyEditorSession: null,
      activeBodyEditorObjectId: null,
      isBodyEditorOpen: false,
      bodyEditorPendingText: null,
    },
  };
}

export const initialEditorState: EditorState = createInitialEditorState();
