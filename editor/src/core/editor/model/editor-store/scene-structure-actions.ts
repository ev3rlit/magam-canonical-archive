import { createObjectMap, getSelectionBounds, nextZIndex } from '../editor-geometry';
import {
  createGroupObject,
  removeObjects,
  restackObjects,
  type ObjectCommandDeps,
} from './object-commands';
import {
  getSelectionRoots,
  normalizeSelection,
  withClearedContext,
} from './selection-commands';
import type { EditorStore, EditorStoreEnv } from './store-types';

export function createSceneStructureActions(
  env: EditorStoreEnv,
  deps: ObjectCommandDeps,
): Pick<
  EditorStore,
  | 'bringSelectionToFront'
  | 'bringSelectionForward'
  | 'sendSelectionBackward'
  | 'sendSelectionToBack'
  | 'deleteSelection'
  | 'groupSelection'
  | 'ungroupSelection'
> {
  return {
    bringSelectionToFront: () => {
      env.commitCanvasMutation('Bring selection to front', (state) => ({
        scene: {
          ...state.scene,
          objects: restackObjects(state.scene.objects, state.selection.ids, 'front'),
        },
      }));
    },
    bringSelectionForward: () => {
      env.commitCanvasMutation('Bring selection forward', (state) => ({
        scene: {
          ...state.scene,
          objects: restackObjects(state.scene.objects, state.selection.ids, 'forward'),
        },
      }));
    },
    sendSelectionBackward: () => {
      env.commitCanvasMutation('Send selection backward', (state) => ({
        scene: {
          ...state.scene,
          objects: restackObjects(state.scene.objects, state.selection.ids, 'backward'),
        },
      }));
    },
    sendSelectionToBack: () => {
      env.commitCanvasMutation('Send selection to back', (state) => ({
        scene: {
          ...state.scene,
          objects: restackObjects(state.scene.objects, state.selection.ids, 'back'),
        },
      }));
    },
    deleteSelection: () => {
      env.commitCanvasMutation('Delete selection', (state) => ({
        scene: {
          ...state.scene,
          objects: removeObjects(state.scene.objects, state.selection.ids),
        },
        ...withClearedContext({
          ids: [],
          primaryId: null,
        }),
      }));
    },
    groupSelection: () => {
      env.commitCanvasMutation('Group selection', (state) => {
        if (state.selection.ids.length < 2) {
          return state;
        }

        const bounds = getSelectionBounds(state.selection, state.scene.objects);
        if (!bounds) {
          return state;
        }

        const roots = getSelectionRoots(state.selection.ids, state.scene.objects);
        const objectMap = createObjectMap(state.scene.objects);
        const parentId = objectMap.get(roots[0])?.parentId ?? null;
        const group = createGroupObject({
          parentId,
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          zIndex: nextZIndex(state.scene.objects),
        }, deps);
        const objects = state.scene.objects.map((object) => (
          roots.includes(object.id) ? { ...object, parentId: group.id } : object
        ));
        const selection = normalizeSelection([group.id], group.id);

        return {
          scene: {
            ...state.scene,
            objects: [...objects, group],
          },
          ...withClearedContext(selection),
        };
      });
    },
    ungroupSelection: () => {
      env.commitCanvasMutation('Ungroup selection', (state) => {
        const selectedGroups = state.scene.objects.filter((object) => (
          state.selection.ids.includes(object.id) && object.kind === 'group'
        ));

        if (selectedGroups.length === 0) {
          const objectMap = createObjectMap(state.scene.objects);
          const parentIds = [...new Set(
            state.selection.ids.map((id) => objectMap.get(id)?.parentId ?? null).filter(Boolean),
          )];
          const parentGroup = parentIds
            .map((parentId) => state.scene.objects.find((object) => object.id === parentId))
            .find((object): object is EditorStore['scene']['objects'][number] => object?.kind === 'group');

          if (!parentGroup) {
            return state;
          }

          selectedGroups.push(parentGroup);
        }

        const groupIds = new Set(selectedGroups.map((group) => group.id));
        const parentByGroup = new Map(selectedGroups.map((group) => [group.id, group.parentId]));
        const childSelectionIds = state.scene.objects
          .filter((object) => object.parentId && groupIds.has(object.parentId))
          .map((object) => object.id);
        const objects = state.scene.objects
          .filter((object) => !groupIds.has(object.id))
          .map((object) => (
            object.parentId && groupIds.has(object.parentId)
              ? {
                  ...object,
                  parentId: parentByGroup.get(object.parentId) ?? null,
                }
              : object
          ));

        return {
          scene: {
            ...state.scene,
            objects,
          },
          ...withClearedContext(normalizeSelection(childSelectionIds, childSelectionIds[0] ?? null)),
        };
      });
    },
  };
}
