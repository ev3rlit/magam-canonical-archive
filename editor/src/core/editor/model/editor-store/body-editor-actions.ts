import { cloneBody } from '../editor-content-blocks';
import type { BodyEditorActions, EditorStoreEnv } from './store-types';
import {
  closeBodyEditorOverlays,
  createIdleOverlays,
  normalizeSelection,
} from './selection-commands';

export function createBodyEditorActions(env: EditorStoreEnv): BodyEditorActions {
  return {
    openBodyEditor: (objectId, pendingText = null) => {
      env.setState((state) => {
        const object = state.scene.objects.find((candidate) => candidate.id === objectId);
        if (!object || object.kind === 'group') {
          return state;
        }

        const existingSession = state.overlays.bodyEditorSession;
        if (existingSession?.objectId === objectId && state.overlays.isBodyEditorOpen) {
          return {
            selection: normalizeSelection([objectId], objectId),
            overlays: {
              ...state.overlays,
              bodyEditorSession: {
                ...existingSession,
                pendingEntryText: pendingText ?? existingSession.pendingEntryText,
              },
              activeBodyEditorObjectId: objectId,
              isBodyEditorOpen: true,
              bodyEditorPendingText: pendingText ?? existingSession.pendingEntryText,
            },
          };
        }

        return {
          selection: normalizeSelection([objectId], objectId),
          overlays: createIdleOverlays({
            bodyEditorSession: {
              objectId,
              draftBody: cloneBody(object.body),
              dirty: false,
              pendingEntryText: pendingText,
            },
            activeBodyEditorObjectId: objectId,
            isBodyEditorOpen: true,
            bodyEditorPendingText: pendingText,
          }),
        };
      });
    },
    updateBodyEditorDraft: (objectId, body) => {
      env.setState((state) => {
        if (state.overlays.bodyEditorSession?.objectId !== objectId) {
          return state;
        }

        return {
          overlays: {
            ...state.overlays,
            bodyEditorSession: {
              ...state.overlays.bodyEditorSession,
              draftBody: cloneBody(body),
              dirty: true,
            },
          },
        };
      });
    },
    commitActiveBodyEditor: () => {
      const session = env.getState().overlays.bodyEditorSession;
      if (!session) {
        return;
      }

      if (!session.dirty) {
        env.setState((state) => ({
          overlays: closeBodyEditorOverlays(state.overlays),
        }));
        return;
      }

      env.commitCanvasMutation('Edit document body', (state) => {
        const activeSession = state.overlays.bodyEditorSession;
        if (!activeSession) {
          return state;
        }

        return {
          scene: {
            ...state.scene,
            objects: state.scene.objects.map((candidate) => (
              candidate.id === activeSession.objectId
                ? {
                    ...candidate,
                    body: cloneBody(activeSession.draftBody),
                  }
                : candidate
            )),
          },
          overlays: closeBodyEditorOverlays(state.overlays),
        };
      });
    },
    discardActiveBodyEditor: () => {
      env.setState((state) => ({
        overlays: closeBodyEditorOverlays(state.overlays),
      }));
    },
    closeBodyEditor: (options) => {
      if (options?.clearPendingText === false) {
        env.getState().commitActiveBodyEditor();
        return;
      }
      env.getState().discardActiveBodyEditor();
    },
    consumeBodyEditorPendingText: () => {
      const pendingText =
        env.getState().overlays.bodyEditorSession?.pendingEntryText ??
        env.getState().overlays.bodyEditorPendingText;

      if (pendingText !== null) {
        env.setState((state) => ({
          overlays: {
            ...state.overlays,
            bodyEditorSession: state.overlays.bodyEditorSession
              ? {
                  ...state.overlays.bodyEditorSession,
                  pendingEntryText: null,
                }
              : null,
            bodyEditorPendingText: null,
          },
        }));
      }

      return pendingText;
    },
    updateObjectBody: (objectId, body) => {
      env.commitCanvasMutation('Edit document body', (state) => {
        const object = state.scene.objects.find((candidate) => candidate.id === objectId);
        if (!object || object.kind === 'group') {
          return state;
        }

        return {
          scene: {
            ...state.scene,
            objects: state.scene.objects.map((candidate) => (
              candidate.id === objectId
                ? {
                    ...candidate,
                    body: cloneBody(body),
                  }
                : candidate
            )),
          },
          overlays: closeBodyEditorOverlays(state.overlays),
        };
      });
    },
  };
}
