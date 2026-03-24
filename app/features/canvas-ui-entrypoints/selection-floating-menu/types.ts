import type { FontFamilyPreset } from '@magam/core';
import type { Node } from 'reactflow';
import type { EditMeta } from '@/features/editing/editability';
import type { ActionRoutingRegistryEntry } from '@/features/editing/actionRoutingBridge/types';
import type { SelectionMenuItemContribution } from '@/processes/canvas-runtime/types';

export const SELECTION_FLOATING_MENU_ANCHOR_ID = 'selection-floating-menu:selection-bounds';

export type SelectionFloatingMenuControlId =
  | 'object-type'
  | 'font-family'
  | 'font-size'
  | 'bold'
  | 'align'
  | 'color'
  | 'more'
  | 'content'
  | 'washi-preset';

export type SelectionFloatingMenuControlGroup = 'primary' | 'overflow';

export type SelectionFloatingMenuDisabledReason =
  | 'NO_SELECTION'
  | 'MISSING_TARGET'
  | 'HETEROGENEOUS_SELECTION'
  | 'PENDING_ACTION'
  | 'READ_ONLY_SELECTION'
  | 'CONTROL_UNSUPPORTED'
  | 'MULTI_SELECTION_CONTENT'
  | 'OBJECT_TYPE_PLACEHOLDER';

export type SelectionFloatingMenuStylePatchKey =
  | 'fontFamily'
  | 'fontSize'
  | 'labelFontSize'
  | 'bold'
  | 'labelBold'
  | 'fill'
  | 'color'
  | 'pattern'
  | 'width'
  | 'height'
  | 'rotation';

export type SelectionFloatingMenuPatchValue =
  | string
  | number
  | boolean
  | null
  | Record<string, unknown>;

export interface SelectionFloatingMenuPresetOption {
  id: string;
  label: string;
}

export interface SelectionFloatingMenuInventoryItem extends SelectionMenuItemContribution {
  controlId: SelectionFloatingMenuControlId;
  group: SelectionFloatingMenuControlGroup;
}

export interface SelectionFloatingMenuSelectedNode {
  renderedNodeId: string;
  sourceId: string;
  canvasId: string | null;
  nodeType: string;
  semanticRole?: string;
  label: string;
  styleEditableKeys: string[];
  editMeta?: EditMeta;
  node: Node;
}

export interface SelectionFloatingMenuSelectionSummary {
  selectedCount: number;
  selectedNodeIds: string[];
  selectedNodes: SelectionFloatingMenuSelectedNode[];
  primaryNode: SelectionFloatingMenuSelectedNode | null;
  isHomogeneous: boolean;
  hasPendingActions: boolean;
  isReadOnlySelection: boolean;
  activeTextValue: string;
  activePresetId: string | null;
  commonValues: {
    fontFamily: FontFamilyPreset | null;
    fontSize: string | number | null;
    bold: boolean | null;
    color: string | null;
    align: string | null;
  };
}

export interface SelectionFloatingMenuControlState {
  inventory: SelectionFloatingMenuInventoryItem;
  visible: boolean;
  enabled: boolean;
  disabledReason?: SelectionFloatingMenuDisabledReason;
  patchKey?: SelectionFloatingMenuStylePatchKey;
  value?: SelectionFloatingMenuPatchValue;
}

export interface SelectionFloatingMenuRenderModel {
  visible: boolean;
  hiddenReason?: SelectionFloatingMenuDisabledReason;
  summary: SelectionFloatingMenuSelectionSummary;
  controls: SelectionFloatingMenuControlState[];
  primaryControls: SelectionFloatingMenuControlState[];
  overflowControls: SelectionFloatingMenuControlState[];
}

export interface SelectionFloatingMenuContributionShape {
  selectionMenuItems: SelectionMenuItemContribution[];
  intents: ActionRoutingRegistryEntry[];
}
