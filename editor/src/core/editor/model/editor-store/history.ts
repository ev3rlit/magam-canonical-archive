import type { EditorState } from '../editor-state';
import type { EditorHistorySnapshot, EditorSelectionState } from '../editor-types';
import type { EditorStore } from './store-types';
import { cloneCanvasObjects } from './object-commands';
import { withClearedContext } from './selection-commands';

function cloneSelection(selection: EditorSelectionState): EditorSelectionState {
  return {
    ids: [...selection.ids],
    primaryId: selection.primaryId,
  };
}

export function createHistorySnapshot(state: Pick<EditorState, 'scene' | 'selection'>): EditorHistorySnapshot {
  return {
    objects: cloneCanvasObjects(state.scene.objects),
    selection: cloneSelection(state.selection),
  };
}

export function historySnapshotsMatch(left: EditorHistorySnapshot, right: EditorHistorySnapshot) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function restoreHistorySnapshot(state: EditorStore, snapshot: EditorHistorySnapshot) {
  return {
    scene: {
      ...state.scene,
      objects: cloneCanvasObjects(snapshot.objects),
      marquee: null,
    },
    ...withClearedContext(cloneSelection(snapshot.selection)),
  };
}
