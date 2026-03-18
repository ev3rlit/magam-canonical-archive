import {
  canvasToolbarActionsBySection,
  resolveCanvasToolbarAction,
} from './toolbarActions';
import { canvasToolbarSectionInventory } from './toolbarSections';
import type {
  CanvasToolbarActionBindings,
  CanvasToolbarResolvedSection,
  CanvasToolbarRuntimeState,
} from './types';

export function resolveCanvasToolbarModel(input: {
  runtimeState: CanvasToolbarRuntimeState;
  bindings: CanvasToolbarActionBindings;
}): CanvasToolbarResolvedSection[] {
  return canvasToolbarSectionInventory
    .slice()
    .sort((left, right) => left.order - right.order)
    .map((section) => ({
      ...section,
      actions: canvasToolbarActionsBySection[section.sectionId].map((action) => (
        resolveCanvasToolbarAction({
          action,
          runtimeState: input.runtimeState,
          bindings: input.bindings,
        })
      )),
    }))
    .filter((section) => section.actions.length > 0);
}
