import { getSelectionBounds, nextZIndex } from '../editor-geometry';
import {
  buildDraftObject,
  createAssetImageObject,
  createReferenceCanvasObject,
  duplicateSnapshotObjects,
  getObjectDefaults,
  type ObjectCommandDeps,
} from './object-commands';
import {
  getSelectionRoots,
  normalizeSelection,
  withClearedContext,
} from './selection-commands';
import type { EditorStore, EditorStoreEnv } from './store-types';

function getViewportCenterPosition(
  state: Pick<EditorStore, 'viewport'>,
  size: { width: number; height: number },
) {
  return {
    x: (state.viewport.width / 2 - state.viewport.x) / state.viewport.zoom - size.width / 2,
    y: (state.viewport.height / 2 - state.viewport.y) / state.viewport.zoom - size.height / 2,
  };
}

export function createSceneCreationActions(
  env: EditorStoreEnv,
  deps: ObjectCommandDeps,
): Pick<
  EditorStore,
  | 'createObjectAtViewportCenter'
  | 'instantiateTemplateSnapshot'
  | 'placeLibraryAsset'
  | 'placeReferenceItem'
> {
  return {
    createObjectAtViewportCenter: (kind) => {
      env.commitCanvasMutation('Create object', (state) => {
        const defaults = getObjectDefaults(kind);
        const position = getViewportCenterPosition(state, defaults);
        const nextObject = buildDraftObject({
          kind,
          x: position.x,
          y: position.y,
          zIndex: nextZIndex(state.scene.objects),
        }, deps);
        const selection = normalizeSelection([nextObject.id], nextObject.id);

        return {
          activeTool: 'select',
          temporaryToolOverride: null,
          scene: {
            ...state.scene,
            objects: [...state.scene.objects, nextObject],
          },
          ...withClearedContext(selection),
        };
      });
    },
    instantiateTemplateSnapshot: (objects, libraryItemId) => {
      env.commitCanvasMutation('Instantiate template', (state) => {
        if (objects.length === 0) {
          return state;
        }

        const sourceIds = objects.map((object) => object.id);
        const sourceBounds = getSelectionBounds(
          {
            ids: sourceIds,
            primaryId: sourceIds[0] ?? null,
          },
          objects,
        );
        const duplicated = duplicateSnapshotObjects(
          objects,
          sourceBounds
            ? {
                x: (state.viewport.width / 2 - state.viewport.x) / state.viewport.zoom
                  - (sourceBounds.x + sourceBounds.width / 2),
                y: (state.viewport.height / 2 - state.viewport.y) / state.viewport.zoom
                  - (sourceBounds.y + sourceBounds.height / 2),
              }
            : { x: 24, y: 24 },
          libraryItemId,
          deps,
        );
        const rootIds = getSelectionRoots(sourceIds, objects);
        const rootCloneIds = rootIds
          .map((rootId) => duplicated.idMap.get(rootId) ?? null)
          .filter((id): id is string => id !== null);
        const selection = normalizeSelection(rootCloneIds, rootCloneIds[0] ?? null);

        return {
          scene: {
            ...state.scene,
            objects: [...state.scene.objects, ...duplicated.clones.map((object, index) => ({
              ...object,
              zIndex: nextZIndex(state.scene.objects) + index,
            }))],
          },
          ...withClearedContext(selection),
        };
      });
    },
    placeLibraryAsset: (input) => {
      env.commitCanvasMutation('Place library asset', (state) => {
        const nextObject = createAssetImageObject(input, deps);
        const position = getViewportCenterPosition(state, nextObject);
        const placed = {
          ...nextObject,
          x: position.x,
          y: position.y,
          zIndex: nextZIndex(state.scene.objects),
        };
        const selection = normalizeSelection([placed.id], placed.id);

        return {
          scene: {
            ...state.scene,
            objects: [...state.scene.objects, placed],
          },
          ...withClearedContext(selection),
        };
      });
    },
    placeReferenceItem: (input) => {
      env.commitCanvasMutation('Place reference item', (state) => {
        const nextObject = createReferenceCanvasObject(input, deps);
        const position = getViewportCenterPosition(state, nextObject);
        const placed = {
          ...nextObject,
          x: position.x,
          y: position.y,
          zIndex: nextZIndex(state.scene.objects),
        };
        const selection = normalizeSelection([placed.id], placed.id);

        return {
          scene: {
            ...state.scene,
            objects: [...state.scene.objects, placed],
          },
          ...withClearedContext(selection),
        };
      });
    },
  };
}
