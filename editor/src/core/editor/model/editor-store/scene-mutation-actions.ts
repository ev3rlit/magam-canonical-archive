import {
  sanitizeObjectPatch,
  setFieldPatch,
} from './object-commands';
import type { EditorStore, EditorStoreEnv } from './store-types';

export function createSceneMutationActions(
  env: EditorStoreEnv,
): Pick<EditorStore, 'updateObjectField' | 'updateObjectPatch'> {
  return {
    updateObjectField: (objectId, field, value) => {
      env.commitCanvasMutation('Update object field', (state) => ({
        scene: {
          ...state.scene,
          objects: state.scene.objects.map((object) => (
            object.id === objectId ? setFieldPatch(object, field, value) : object
          )),
        },
      }));
    },
    updateObjectPatch: (objectId, patch) => {
      env.commitCanvasMutation('Update object patch', (state) => ({
        scene: {
          ...state.scene,
          objects: state.scene.objects.map((object) => (
            object.id === objectId ? { ...object, ...sanitizeObjectPatch(object, patch) } : object
          )),
        },
      }));
    },
  };
}
