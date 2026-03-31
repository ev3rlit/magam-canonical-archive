'use client';

import { create } from 'zustand';
import { UndoStack } from '../history/undo-stack';
import { createInitialEditorState, type EditorState } from './editor-state';
import { syncGroupFrames } from './editor-geometry';
import { createBodyEditorActions } from './editor-store/body-editor-actions';
import { createEditorStoreEnv } from './editor-store/env';
import {
  createHistorySnapshot,
  historySnapshotsMatch,
  restoreHistorySnapshot,
} from './editor-store/history';
import { createOverlayActions } from './editor-store/overlay-actions';
import { createPanelActions } from './editor-store/panel-actions';
import { createSceneActions } from './editor-store/scene-actions';
import { createSelectionActions } from './editor-store/selection-actions';
import {
  getEffectiveTool,
  getPrimarySelectionObject,
  getSelectionStats,
} from './editor-store/selectors';
import type { EditorStore } from './editor-store/store-types';
import type { EditorHistorySnapshot } from './editor-types';

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

function createInitialState(): EditorState {
  return createInitialEditorState({
    viewport: DEFAULT_VIEWPORT,
  });
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

  const env = createEditorStoreEnv({
    getState: get,
    setState: set,
    commitCanvasMutation,
    nextFocusRequestId: () => {
      const nextId = focusRequestCounter;
      focusRequestCounter += 1;
      return nextId;
    },
    shouldUseMobilePanel,
  });

  const objectCommandDeps = {
    createObjectId,
    placeholderImageSrc: PLACEHOLDER_IMAGE,
  };

  return {
    ...createInitialState(),
    ...createBodyEditorActions(env),
    ...createOverlayActions(env),
    ...createPanelActions(
      env,
      createInitialState,
      () => {
        objectCounter = 0;
        focusRequestCounter = 1;
        historyStack.clear();
      },
    ),
    ...createSelectionActions(env),
    ...createSceneActions(env, objectCommandDeps),
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

export type { EditorStore } from './editor-store/store-types';
export type { EditorState } from './editor-state';
export { getEffectiveTool, getPrimarySelectionObject, getSelectionStats };
