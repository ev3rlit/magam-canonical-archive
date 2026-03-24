import { describe, expect, it } from 'bun:test';
import { resolveCanvasToolbarModel } from './toolbarModel';
import type {
  CanvasToolbarActionBindings,
  CanvasToolbarRuntimeState,
} from './types';

function createBindings(): CanvasToolbarActionBindings {
  return {
    onSelectInteractionMode: () => undefined,
    onSelectCreateMode: () => undefined,
    onZoomIn: () => undefined,
    onZoomOut: () => undefined,
    onFitView: () => undefined,
  };
}

function createRuntimeState(
  overrides: Partial<CanvasToolbarRuntimeState> = {},
): CanvasToolbarRuntimeState {
  return {
    interactionMode: 'pointer',
    createMode: null,
    hasPendingEntrypointActions: false,
    ...overrides,
  };
}

describe('resolveCanvasToolbarModel', () => {
  it('derives active interaction and create actions from runtime state', () => {
    const model = resolveCanvasToolbarModel({
      runtimeState: createRuntimeState({
        interactionMode: 'hand',
        createMode: 'markdown',
      }),
      bindings: createBindings(),
    });

    expect(model.find((section) => section.sectionId === 'interaction')?.actions).toMatchObject([
      { actionId: 'interaction.pointer', active: false },
      { actionId: 'interaction.hand', active: true },
    ]);
    expect(model.find((section) => section.sectionId === 'create')?.actions).toMatchObject([
      { actionId: 'create.mindmap', active: false },
      { actionId: 'create.rectangle', active: false },
      { actionId: 'create.ellipse', active: false },
      { actionId: 'create.diamond', active: false },
      { actionId: 'create.text', active: false },
      { actionId: 'create.markdown', active: true },
      { actionId: 'create.line', active: false },
      { actionId: 'create.sticky', active: false },
      { actionId: 'create.image', active: false },
      { actionId: 'create.sticker', active: false },
      { actionId: 'create.washi-tape', active: false },
    ]);
  });

  it('disables create actions while entrypoint actions are pending', () => {
    const model = resolveCanvasToolbarModel({
      runtimeState: createRuntimeState({
        hasPendingEntrypointActions: true,
      }),
      bindings: createBindings(),
    });

    const createSection = model.find((section) => section.sectionId === 'create');
    const viewportSection = model.find((section) => section.sectionId === 'viewport');

    expect(createSection?.actions.every((action) => action.disabled)).toBe(true);
    expect(createSection?.actions.map((action) => action.disabledReason?.code)).toEqual([
      'pending-entrypoint-action',
      'pending-entrypoint-action',
      'pending-entrypoint-action',
      'pending-entrypoint-action',
      'pending-entrypoint-action',
      'pending-entrypoint-action',
      'pending-entrypoint-action',
      'pending-entrypoint-action',
      'pending-entrypoint-action',
      'pending-entrypoint-action',
      'pending-entrypoint-action',
    ]);
    expect(viewportSection?.actions.every((action) => !action.disabled)).toBe(true);
  });

  it('returns visible sections in fixed inventory order', () => {
    const model = resolveCanvasToolbarModel({
      runtimeState: createRuntimeState(),
      bindings: createBindings(),
    });

    expect(model.map((section) => section.sectionId)).toEqual([
      'interaction',
      'create',
      'viewport',
    ]);
  });
});
