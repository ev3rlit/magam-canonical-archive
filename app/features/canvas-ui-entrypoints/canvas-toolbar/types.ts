import type {
  CanvasEntrypointCreateNodeType,
  CanvasEntrypointCreateMode,
} from '@/features/canvas-ui-entrypoints/contracts';
import type { EntrypointInteractionMode } from '@/features/canvas-ui-entrypoints/ui-runtime-state';

export type CanvasToolbarSectionId =
  | 'interaction'
  | 'create'
  | 'viewport'
  | 'canvas-global';

export type CanvasToolbarActionKind =
  | 'interaction-mode'
  | 'create-node'
  | 'viewport'
  | 'canvas-global';

export type CanvasToolbarViewportActionId =
  | 'zoom-in'
  | 'zoom-out'
  | 'fit-view';

export type CanvasToolbarDisabledReasonCode =
  | 'pending-entrypoint-action'
  | 'missing-action-binding';

export interface CanvasToolbarDisabledReason {
  code: CanvasToolbarDisabledReasonCode;
  message: string;
}

export interface CanvasToolbarSectionDefinition {
  sectionId: CanvasToolbarSectionId;
  label: string;
  order: number;
}

interface CanvasToolbarActionDefinitionBase<TKind extends CanvasToolbarActionKind, TValue> {
  actionId: string;
  sectionId: CanvasToolbarSectionId;
  kind: TKind;
  label: string;
  value: TValue;
}

export type CanvasToolbarInteractionActionDefinition = CanvasToolbarActionDefinitionBase<
  'interaction-mode',
  EntrypointInteractionMode
>;

export type CanvasToolbarCreateActionDefinition = CanvasToolbarActionDefinitionBase<
  'create-node',
  Exclude<CanvasEntrypointCreateMode, null>
>;

export type CanvasToolbarViewportActionDefinition = CanvasToolbarActionDefinitionBase<
  'viewport',
  CanvasToolbarViewportActionId
>;

export type CanvasToolbarCanvasGlobalActionDefinition = CanvasToolbarActionDefinitionBase<
  'canvas-global',
  string
>;

export type CanvasToolbarActionDefinition =
  | CanvasToolbarInteractionActionDefinition
  | CanvasToolbarCreateActionDefinition
  | CanvasToolbarViewportActionDefinition
  | CanvasToolbarCanvasGlobalActionDefinition;

export interface CanvasToolbarActionBindings {
  onSelectInteractionMode?: (mode: EntrypointInteractionMode) => void;
  onSelectCreateMode?: (mode: Exclude<CanvasEntrypointCreateMode, null>) => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFitView?: () => void;
  onCanvasGlobalAction?: (actionId: string) => void;
}

export interface CanvasToolbarRuntimeState {
  interactionMode: EntrypointInteractionMode;
  createMode: CanvasEntrypointCreateMode;
  hasPendingEntrypointActions: boolean;
}

export type CanvasToolbarResolvedAction = CanvasToolbarActionDefinition & {
  active: boolean;
  disabled: boolean;
  disabledReason: CanvasToolbarDisabledReason | null;
  execute: () => void;
};

export interface CanvasToolbarResolvedSection extends CanvasToolbarSectionDefinition {
  actions: CanvasToolbarResolvedAction[];
}
