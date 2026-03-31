import { getSelectionStatsData } from './selection-commands';
import type { EditorState } from '../editor-state';
import type { EditorStore } from './store-types';

export function getEffectiveTool(state: Pick<EditorState, 'activeTool' | 'temporaryToolOverride'>) {
  return state.temporaryToolOverride ?? state.activeTool;
}

export function getPrimarySelectionObject(state: EditorStore) {
  return state.scene.objects.find((object) => object.id === state.selection.primaryId) ?? null;
}

export function getSelectionStats(state: EditorStore) {
  return getSelectionStatsData(state);
}
