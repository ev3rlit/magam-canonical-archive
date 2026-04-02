import {
  cloneBranch,
  createClipboardSnapshot,
  type ObjectCommandDeps,
} from './object-commands';
import {
  getSelectionRoots,
  normalizeSelection,
  withClearedContext,
} from './selection-commands';
import type { EditorClipboardState } from '../editor-state';
import type { EditorStore, EditorStoreEnv } from './store-types';

function pasteClipboardSnapshotIntoScene(
  state: EditorStore,
  clipboard: EditorClipboardState,
  deps: ObjectCommandDeps,
) {
  if (clipboard.rootIds.length === 0) {
    return state;
  }

  const offsetMultiplier = clipboard.pasteCount + 1;
  const offset = {
    x: 24 * offsetMultiplier,
    y: 24 * offsetMultiplier,
  };
  const clones: EditorStore['scene']['objects'] = [];
  const rootCloneIds: string[] = [];

  clipboard.rootIds.forEach((rootId) => {
    const root = clipboard.objects.find((candidate) => candidate.id === rootId);
    const previousLength = clones.length;
    const targetParentId = root?.parentId && state.scene.objects.some((object) => object.id === root.parentId)
      ? root.parentId
      : null;
    cloneBranch(rootId, clipboard.objects, offset, targetParentId, clones, deps);
    const rootClone = clones[previousLength];
    if (rootClone) {
      rootCloneIds.push(rootClone.id);
    }
  });

  if (clones.length === 0) {
    return state;
  }

  const selection = normalizeSelection(rootCloneIds, rootCloneIds[0] ?? null);
  return {
    scene: {
      ...state.scene,
      objects: [...state.scene.objects, ...clones],
    },
    ...withClearedContext(selection),
  };
}

export function createSceneClipboardActions(
  env: EditorStoreEnv,
  deps: ObjectCommandDeps,
): Pick<EditorStore, 'copySelection' | 'pasteClipboard' | 'pasteClipboardSnapshot' | 'duplicateSelection'> {
  return {
    copySelection: () => {
      env.setState((state) => {
        if (state.selection.ids.length === 0) {
          return state;
        }

        return {
          clipboard: createClipboardSnapshot(
            state.selection.ids,
            state.scene.objects,
            getSelectionRoots,
          ),
        };
      });
    },
    pasteClipboard: () => {
      env.commitCanvasMutation('Paste selection', (state) => {
        const nextState = pasteClipboardSnapshotIntoScene(state, state.clipboard, deps);
        if (nextState === state) {
          return state;
        }

        return {
          ...nextState,
          clipboard: {
            ...state.clipboard,
            pasteCount: state.clipboard.pasteCount + 1,
          },
        };
      });
    },
    pasteClipboardSnapshot: (snapshot) => {
      env.commitCanvasMutation('Paste selection', (state) => pasteClipboardSnapshotIntoScene(state, snapshot, deps));
    },
    duplicateSelection: () => {
      env.commitCanvasMutation('Duplicate selection', (state) => {
        const roots = getSelectionRoots(state.selection.ids, state.scene.objects);
        const clones: EditorStore['scene']['objects'] = [];
        const rootCloneIds: string[] = [];

        roots.forEach((rootId) => {
          const root = state.scene.objects.find((candidate) => candidate.id === rootId);
          const previousLength = clones.length;
          cloneBranch(rootId, state.scene.objects, { x: 24, y: 24 }, root?.parentId ?? null, clones, deps);
          const rootClone = clones[previousLength];
          if (rootClone) {
            rootCloneIds.push(rootClone.id);
          }
        });

        const selection = normalizeSelection(rootCloneIds, rootCloneIds[0] ?? null);
        return {
          scene: {
            ...state.scene,
            objects: [...state.scene.objects, ...clones],
          },
          ...withClearedContext(selection),
        };
      });
    },
  };
}
