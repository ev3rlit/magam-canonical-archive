import type { EditorStore, EditorStoreEnv } from './store-types';
import type { ObjectCommandDeps } from './object-commands';
import { createSceneClipboardActions } from './scene-clipboard-actions';
import { createSceneCreationActions } from './scene-creation-actions';
import { createSceneMutationActions } from './scene-mutation-actions';
import { createSceneStructureActions } from './scene-structure-actions';

export function createSceneActions(
  env: EditorStoreEnv,
  deps: ObjectCommandDeps,
): Pick<
  EditorStore,
  | 'createObjectAtViewportCenter'
  | 'instantiateTemplateSnapshot'
  | 'placeLibraryAsset'
  | 'placeReferenceItem'
  | 'updateObjectField'
  | 'updateObjectPatch'
  | 'copySelection'
  | 'pasteClipboard'
  | 'bringSelectionToFront'
  | 'bringSelectionForward'
  | 'sendSelectionBackward'
  | 'sendSelectionToBack'
  | 'duplicateSelection'
  | 'deleteSelection'
  | 'groupSelection'
  | 'ungroupSelection'
> {
  return {
    ...createSceneCreationActions(env, deps),
    ...createSceneMutationActions(env),
    ...createSceneClipboardActions(env, deps),
    ...createSceneStructureActions(env, deps),
  };
}
