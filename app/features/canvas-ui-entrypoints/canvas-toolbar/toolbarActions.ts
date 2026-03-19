import type {
  CanvasToolbarActionBindings,
  CanvasToolbarActionDefinition,
  CanvasToolbarCanvasGlobalActionDefinition,
  CanvasToolbarCreateActionDefinition,
  CanvasToolbarDisabledReason,
  CanvasToolbarResolvedAction,
  CanvasToolbarRuntimeState,
  CanvasToolbarSectionId,
  CanvasToolbarViewportActionDefinition,
  CanvasToolbarInteractionActionDefinition,
} from './types';

const PENDING_ENTRYPOINT_ACTION_DISABLED_REASON: CanvasToolbarDisabledReason = {
  code: 'pending-entrypoint-action',
  message: 'Create tools stay locked while another entrypoint action is pending.',
};

const MISSING_ACTION_BINDING_DISABLED_REASON: CanvasToolbarDisabledReason = {
  code: 'missing-action-binding',
  message: 'Toolbar action is not bound to a runtime callback.',
};

export const canvasToolbarInteractionActions = [
  {
    actionId: 'interaction.pointer',
    sectionId: 'interaction',
    kind: 'interaction-mode',
    label: 'Select',
    value: 'pointer',
  },
  {
    actionId: 'interaction.hand',
    sectionId: 'interaction',
    kind: 'interaction-mode',
    label: 'Pan',
    value: 'hand',
  },
] as const satisfies readonly CanvasToolbarInteractionActionDefinition[];

export const canvasToolbarCreateActions = [
  {
    actionId: 'create.rectangle',
    sectionId: 'create',
    kind: 'create-node',
    label: 'Rectangle',
    value: 'rectangle',
  },
  {
    actionId: 'create.ellipse',
    sectionId: 'create',
    kind: 'create-node',
    label: 'Ellipse',
    value: 'ellipse',
  },
  {
    actionId: 'create.diamond',
    sectionId: 'create',
    kind: 'create-node',
    label: 'Diamond',
    value: 'diamond',
  },
  {
    actionId: 'create.text',
    sectionId: 'create',
    kind: 'create-node',
    label: 'Text',
    value: 'text',
  },
  {
    actionId: 'create.markdown',
    sectionId: 'create',
    kind: 'create-node',
    label: 'Markdown',
    value: 'markdown',
  },
  {
    actionId: 'create.line',
    sectionId: 'create',
    kind: 'create-node',
    label: 'Line',
    value: 'line',
  },
  {
    actionId: 'create.sticky',
    sectionId: 'create',
    kind: 'create-node',
    label: 'Sticky',
    value: 'sticky',
  },
] as const satisfies readonly CanvasToolbarCreateActionDefinition[];

export const canvasToolbarViewportActions = [
  {
    actionId: 'viewport.zoom-in',
    sectionId: 'viewport',
    kind: 'viewport',
    label: 'Zoom in',
    value: 'zoom-in',
  },
  {
    actionId: 'viewport.zoom-out',
    sectionId: 'viewport',
    kind: 'viewport',
    label: 'Zoom out',
    value: 'zoom-out',
  },
  {
    actionId: 'viewport.fit-view',
    sectionId: 'viewport',
    kind: 'viewport',
    label: 'Fit view',
    value: 'fit-view',
  },
] as const satisfies readonly CanvasToolbarViewportActionDefinition[];

export const canvasToolbarCanvasGlobalActions = [] as const satisfies readonly CanvasToolbarCanvasGlobalActionDefinition[];

export const canvasToolbarActionsBySection: Readonly<Record<
  CanvasToolbarSectionId,
  readonly CanvasToolbarActionDefinition[]
>> = {
  interaction: canvasToolbarInteractionActions,
  create: canvasToolbarCreateActions,
  viewport: canvasToolbarViewportActions,
  'canvas-global': canvasToolbarCanvasGlobalActions,
};

function resolveCanvasToolbarActionHandler(
  action: CanvasToolbarActionDefinition,
  bindings: CanvasToolbarActionBindings,
): (() => void) | null {
  switch (action.kind) {
    case 'interaction-mode': {
      const handler = bindings.onSelectInteractionMode;
      return handler ? () => handler(action.value) : null;
    }
    case 'create-node': {
      const handler = bindings.onSelectCreateMode;
      return handler ? () => handler(action.value) : null;
    }
    case 'viewport':
      if (action.value === 'zoom-in') {
        return bindings.onZoomIn ?? null;
      }
      if (action.value === 'zoom-out') {
        return bindings.onZoomOut ?? null;
      }
      return bindings.onFitView ?? null;
    case 'canvas-global': {
      const handler = bindings.onCanvasGlobalAction;
      return handler ? () => handler(action.actionId) : null;
    }
  }
}

export function isCanvasToolbarActionActive(
  action: CanvasToolbarActionDefinition,
  runtimeState: CanvasToolbarRuntimeState,
): boolean {
  switch (action.kind) {
    case 'interaction-mode':
      return runtimeState.interactionMode === action.value;
    case 'create-node':
      return runtimeState.createMode === action.value;
    case 'viewport':
    case 'canvas-global':
      return false;
  }
}

export function resolveCanvasToolbarActionDisabledReason(input: {
  action: CanvasToolbarActionDefinition;
  runtimeState: CanvasToolbarRuntimeState;
  bindings: CanvasToolbarActionBindings;
}): CanvasToolbarDisabledReason | null {
  if (
    input.action.kind === 'create-node'
    && input.runtimeState.hasPendingEntrypointActions
  ) {
    return PENDING_ENTRYPOINT_ACTION_DISABLED_REASON;
  }

  return resolveCanvasToolbarActionHandler(input.action, input.bindings)
    ? null
    : MISSING_ACTION_BINDING_DISABLED_REASON;
}

export function invokeCanvasToolbarAction(input: {
  action: CanvasToolbarActionDefinition;
  bindings: CanvasToolbarActionBindings;
}): boolean {
  const handler = resolveCanvasToolbarActionHandler(input.action, input.bindings);
  if (!handler) {
    return false;
  }
  handler();
  return true;
}

export function resolveCanvasToolbarAction(input: {
  action: CanvasToolbarActionDefinition;
  runtimeState: CanvasToolbarRuntimeState;
  bindings: CanvasToolbarActionBindings;
}): CanvasToolbarResolvedAction {
  const handler = resolveCanvasToolbarActionHandler(input.action, input.bindings);
  const disabledReason = resolveCanvasToolbarActionDisabledReason(input);

  return {
    ...input.action,
    active: isCanvasToolbarActionActive(input.action, input.runtimeState),
    disabled: disabledReason !== null,
    disabledReason,
    execute: () => {
      if (disabledReason || !handler) {
        return;
      }
      handler();
    },
  };
}
