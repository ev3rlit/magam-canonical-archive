import type {
  EditorOverlayState,
  EditorPanelsState,
  EditorSceneState,
  EditorSelectionState,
  EditorTool,
  EditorViewportState,
} from './editor-types';

export interface EditorState {
  activeTool: EditorTool;
  temporaryToolOverride: EditorTool | null;
  panels: EditorPanelsState;
  viewport: EditorViewportState;
  scene: EditorSceneState;
  selection: EditorSelectionState;
  overlays: EditorOverlayState;
}

export const initialEditorState: EditorState = {
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
    x: 0,
    y: 0,
    zoom: 1,
    width: 0,
    height: 0,
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
