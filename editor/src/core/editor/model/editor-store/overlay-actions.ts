import type { EditorFocusableField } from '../editor-types';
import { closeBodyEditorOverlays } from './selection-commands';
import type { EditorStoreEnv, OverlayActions } from './store-types';

function requestFocus(
  env: EditorStoreEnv,
  objectId: string,
  field: Extract<EditorFocusableField, 'name' | 'fill' | 'border'>,
) {
  if (env.getState().overlays.isBodyEditorOpen) {
    env.getState().commitActiveBodyEditor();
  }

  env.setState((state) => ({
    panels: {
      ...state.panels,
      open: {
        ...state.panels.open,
        inspector: true,
      },
      mobileOpenPanel: env.shouldUseMobilePanel() ? 'inspector' : state.panels.mobileOpenPanel,
    },
    overlays: closeBodyEditorOverlays(state.overlays, {
      contextMenu: null,
      focusRequest: {
        objectId,
        field,
        requestId: env.nextFocusRequestId(),
      },
    }),
  }));
}

export function createOverlayActions(env: EditorStoreEnv): OverlayActions {
  return {
    setContextMenu: (menu) => {
      if (menu && env.getState().overlays.isBodyEditorOpen) {
        env.getState().commitActiveBodyEditor();
      }

      env.setState((state) => ({
        overlays: {
          ...state.overlays,
          contextMenu: menu,
        },
      }));
    },
    requestNameFocus: (objectId) => {
      requestFocus(env, objectId, 'name');
    },
    requestStyleFocus: (objectId, field) => {
      requestFocus(env, objectId, field);
    },
    clearFocusRequest: () => {
      env.setState((state) => ({
        overlays: {
          ...state.overlays,
          focusRequest: null,
        },
      }));
    },
  };
}
