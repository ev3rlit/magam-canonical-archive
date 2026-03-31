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
import type { EditorStore, EditorStoreEnv } from './store-types';

export function createSceneClipboardActions(
  env: EditorStoreEnv,
  deps: ObjectCommandDeps,
): Pick<EditorStore, 'copySelection' | 'pasteClipboard' | 'duplicateSelection'> {
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
        if (state.clipboard.rootIds.length === 0) {
          return state;
        }

        const offsetMultiplier = state.clipboard.pasteCount + 1;
        const offset = {
          x: 24 * offsetMultiplier,
          y: 24 * offsetMultiplier,
        };
        const clones: EditorStore['scene']['objects'] = [];
        const rootCloneIds: string[] = [];

        state.clipboard.rootIds.forEach((rootId) => {
          const root = state.clipboard.objects.find((candidate) => candidate.id === rootId);
          const previousLength = clones.length;
          const targetParentId = root?.parentId && state.scene.objects.some((object) => object.id === root.parentId)
            ? root.parentId
            : null;
          cloneBranch(rootId, state.clipboard.objects, offset, targetParentId, clones, deps);
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
          clipboard: {
            ...state.clipboard,
            pasteCount: offsetMultiplier,
          },
          ...withClearedContext(selection),
        };
      });
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
