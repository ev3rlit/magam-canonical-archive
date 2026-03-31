import { syncGroupFrames } from '../editor-geometry';
import {
  applySelectionTransform,
  collectMoveTargets,
  normalizeSelection,
  withClearedContext,
} from './selection-commands';
import type { EditorStore, EditorStoreEnv } from './store-types';

function moveObjects(
  objects: EditorStore['scene']['objects'],
  targetIds: string[],
  deltaX: number,
  deltaY: number,
) {
  const ids = new Set(targetIds);
  return objects.map((object) => (
    ids.has(object.id)
      ? {
          ...object,
          x: object.x + deltaX,
          y: object.y + deltaY,
        }
      : object
  ));
}

export function createSelectionActions(
  env: EditorStoreEnv,
): Pick<
  EditorStore,
  | 'selectOnly'
  | 'toggleSelection'
  | 'selectMany'
  | 'clearSelection'
  | 'setMarquee'
  | 'moveSelection'
  | 'resizeSelection'
  | 'rotateSelection'
  | 'updateSelectionPatch'
> {
  return {
    selectOnly: (objectId) => {
      env.setState({
        ...withClearedContext(normalizeSelection([objectId], objectId)),
      });
    },
    toggleSelection: (objectId) => {
      env.setState((state) => {
        const ids = state.selection.ids.includes(objectId)
          ? state.selection.ids.filter((id) => id !== objectId)
          : [...state.selection.ids, objectId];

        return {
          ...withClearedContext(normalizeSelection(ids, objectId)),
        };
      });
    },
    selectMany: (objectIds, primaryId = null) => {
      env.setState({
        ...withClearedContext(normalizeSelection(objectIds, primaryId)),
      });
    },
    clearSelection: () => {
      env.setState({
        ...withClearedContext({
          ids: [],
          primaryId: null,
        }),
      });
    },
    setMarquee: (marquee) => {
      env.setState((state) => ({
        scene: {
          ...state.scene,
          marquee,
        },
      }));
    },
    moveSelection: (deltaX, deltaY) => {
      env.setState((state) => {
        const moveIds = collectMoveTargets(state.selection.ids, state.scene.objects);
        return {
          scene: {
            ...state.scene,
            objects: syncGroupFrames(moveObjects(state.scene.objects, moveIds, deltaX, deltaY)),
          },
        };
      });
    },
    resizeSelection: ({ baseObjects, baseFrame, nextFrame }) => {
      env.setState((state) => {
        const hasLockedSelection = state.selection.ids.some((id) => state.scene.objects.find((object) => object.id === id)?.locked);
        if (hasLockedSelection) {
          return state;
        }

        return {
          scene: {
            ...state.scene,
            objects: applySelectionTransform({
              baseObjects,
              selectionIds: state.selection.ids,
              baseFrame,
              nextFrame: {
                ...nextFrame,
                rotation: baseFrame.rotation,
              },
            }),
          },
        };
      });
    },
    rotateSelection: ({ baseObjects, baseFrame, nextFrame }) => {
      env.setState((state) => {
        const hasLockedSelection = state.selection.ids.some((id) => state.scene.objects.find((object) => object.id === id)?.locked);
        if (hasLockedSelection) {
          return state;
        }

        return {
          scene: {
            ...state.scene,
            objects: applySelectionTransform({
              baseObjects,
              selectionIds: state.selection.ids,
              baseFrame,
              nextFrame: {
                ...nextFrame,
                width: baseFrame.width,
                height: baseFrame.height,
              },
            }),
          },
        };
      });
    },
    updateSelectionPatch: (patch) => {
      env.commitCanvasMutation('Update selection patch', (state) => {
        const selection = new Set(state.selection.ids);
        return {
          scene: {
            ...state.scene,
            objects: state.scene.objects.map((object) => (
              selection.has(object.id) ? { ...object, ...patch } : object
            )),
          },
        };
      });
    },
  };
}
