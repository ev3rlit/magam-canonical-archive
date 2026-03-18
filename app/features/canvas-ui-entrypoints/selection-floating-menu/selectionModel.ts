import type { EntrypointRuntimeState } from '@/features/canvas-ui-entrypoints/ui-runtime-state';
import type { ActionRoutingPendingRecord } from '@/features/editing/actionRoutingBridge/types';
import type { EditMeta } from '@/features/editing/editability';
import type { Node } from 'reactflow';
import { SELECTION_FLOATING_MENU_CONTROL_INVENTORY } from './controlInventory';
import type {
  SelectionFloatingMenuControlId,
  SelectionFloatingMenuControlState,
  SelectionFloatingMenuDisabledReason,
  SelectionFloatingMenuPatchValue,
  SelectionFloatingMenuRenderModel,
  SelectionFloatingMenuSelectedNode,
  SelectionFloatingMenuStylePatchKey,
} from './types';

const FONT_SIZE_KEYS: SelectionFloatingMenuStylePatchKey[] = ['fontSize', 'labelFontSize'];
const BOLD_KEYS: SelectionFloatingMenuStylePatchKey[] = ['bold', 'labelBold'];
const COLOR_KEYS: SelectionFloatingMenuStylePatchKey[] = ['fill', 'color'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deriveLocalSourceId(nodeId: string, frameScope: unknown): string {
  if (typeof frameScope !== 'string' || frameScope.length === 0) {
    return nodeId;
  }

  const prefix = `${frameScope}.`;
  return nodeId.startsWith(prefix) ? nodeId.slice(prefix.length) : nodeId;
}

function resolveLabel(node: Node): string {
  const data = (node.data || {}) as Record<string, unknown>;
  if (typeof data.label === 'string') {
    return data.label;
  }
  return node.id;
}

function resolveSelectedNode(node: Node, currentFile: string | null): SelectionFloatingMenuSelectedNode {
  const data = (node.data || {}) as Record<string, unknown>;
  const sourceMeta = isRecord(data.sourceMeta) ? data.sourceMeta : {};
  const sourceId = typeof sourceMeta.sourceId === 'string' && sourceMeta.sourceId.length > 0
    ? sourceMeta.sourceId
    : deriveLocalSourceId(node.id, sourceMeta.frameScope);
  const filePath = typeof sourceMeta.filePath === 'string' && sourceMeta.filePath.length > 0
    ? sourceMeta.filePath
    : currentFile;
  const editMeta = isRecord(data.editMeta) ? data.editMeta as EditMeta : undefined;
  const canonicalObject = isRecord(data.canonicalObject) ? data.canonicalObject : undefined;

  return {
    renderedNodeId: node.id,
    sourceId,
    filePath,
    nodeType: node.type ?? 'unknown',
    semanticRole: typeof canonicalObject?.semanticRole === 'string'
      ? canonicalObject.semanticRole
      : undefined,
    label: resolveLabel(node),
    styleEditableKeys: editMeta?.styleEditableKeys ?? [],
    editMeta,
    node,
  };
}

function firstSupportedPatchKey(
  selectedNodes: SelectionFloatingMenuSelectedNode[],
  keys: SelectionFloatingMenuStylePatchKey[],
): SelectionFloatingMenuStylePatchKey | undefined {
  const matchedKey = keys.find((key) => selectedNodes.every((node) => node.styleEditableKeys.includes(key)));
  return matchedKey;
}

function resolvePatchValue(
  node: SelectionFloatingMenuSelectedNode,
  patchKey: SelectionFloatingMenuStylePatchKey | undefined,
): SelectionFloatingMenuPatchValue | undefined {
  if (!patchKey) {
    return undefined;
  }

  const data = (node.node.data || {}) as Record<string, unknown>;
  if (patchKey === 'pattern') {
    const pattern = data.pattern;
    return isRecord(pattern) ? pattern : undefined;
  }
  return patchKey in data ? data[patchKey] as SelectionFloatingMenuPatchValue : undefined;
}

function resolveCommonValue(
  selectedNodes: SelectionFloatingMenuSelectedNode[],
  patchKey: SelectionFloatingMenuStylePatchKey | undefined,
): SelectionFloatingMenuPatchValue | null {
  if (!patchKey || selectedNodes.length === 0) {
    return null;
  }

  const first = resolvePatchValue(selectedNodes[0], patchKey);
  const serializedFirst = JSON.stringify(first ?? null);
  const allSame = selectedNodes.every((node) => (
    JSON.stringify(resolvePatchValue(node, patchKey) ?? null) === serializedFirst
  ));

  return allSame ? (first ?? null) : null;
}

function resolveWashiPresetId(selectedNodes: SelectionFloatingMenuSelectedNode[]): string | null {
  const patternKey = firstSupportedPatchKey(selectedNodes, ['pattern']);
  if (patternKey !== 'pattern') {
    return null;
  }

  const pattern = resolveCommonValue(selectedNodes, 'pattern');
  if (!isRecord(pattern) || pattern.type !== 'preset' || typeof pattern.id !== 'string') {
    return null;
  }
  return pattern.id;
}

function hasPendingSelectionActions(
  selectedNodes: SelectionFloatingMenuSelectedNode[],
  runtimeState: EntrypointRuntimeState,
  pendingByKey: Record<string, ActionRoutingPendingRecord>,
): boolean {
  if (Object.keys(runtimeState.pendingByRequestId).length > 0) {
    return true;
  }

  const selectedSourceIds = new Set(selectedNodes.map((node) => node.sourceId));
  const selectedRenderedIds = new Set(selectedNodes.map((node) => node.renderedNodeId));

  return Object.values(pendingByKey).some((pending) => (
    (pending.nodeId && selectedSourceIds.has(pending.nodeId))
    || (pending.nodeId && selectedRenderedIds.has(pending.nodeId))
  ));
}

function resolveHiddenReason(input: {
  selectedNodes: SelectionFloatingMenuSelectedNode[];
  isHomogeneous: boolean;
  hasAnyInteractiveControl: boolean;
}): SelectionFloatingMenuDisabledReason | undefined {
  if (input.selectedNodes.length === 0) {
    return 'NO_SELECTION';
  }
  if (!input.isHomogeneous) {
    return 'HETEROGENEOUS_SELECTION';
  }
  if (!input.hasAnyInteractiveControl) {
    return 'CONTROL_UNSUPPORTED';
  }
  return undefined;
}

function createControlState(input: {
  controlId: SelectionFloatingMenuControlId;
  selectedNodes: SelectionFloatingMenuSelectedNode[];
  hasPendingActions: boolean;
  isReadOnlySelection: boolean;
  commonValues: {
    fontFamily: string | null;
    fontSize: string | number | null;
    bold: boolean | null;
    color: string | null;
    align: string | null;
  };
  activeTextValue: string;
  activePresetId: string | null;
}): SelectionFloatingMenuControlState {
  const inventory = SELECTION_FLOATING_MENU_CONTROL_INVENTORY.find(
    (item) => item.controlId === input.controlId,
  );

  if (!inventory) {
    throw new Error(`SELECTION_MENU_CONTROL_MISSING:${input.controlId}`);
  }

  const disabledReason = input.hasPendingActions
    ? 'PENDING_ACTION'
    : input.isReadOnlySelection
      ? 'READ_ONLY_SELECTION'
      : undefined;

  if (input.controlId === 'object-type') {
    const visible = input.selectedNodes.length > 0;
    return {
      inventory,
      visible,
      enabled: false,
      disabledReason: visible ? 'OBJECT_TYPE_PLACEHOLDER' : 'NO_SELECTION',
      value: input.selectedNodes[0]?.nodeType,
    };
  }

  if (input.controlId === 'align') {
    const visible = input.selectedNodes.length > 0 && input.commonValues.align !== null;
    return {
      inventory,
      visible,
      enabled: false,
      disabledReason: visible ? 'CONTROL_UNSUPPORTED' : 'CONTROL_UNSUPPORTED',
      value: input.commonValues.align,
    };
  }

  if (input.controlId === 'font-family') {
    const patchKey = firstSupportedPatchKey(input.selectedNodes, ['fontFamily']);
    return {
      inventory,
      visible: Boolean(patchKey),
      enabled: Boolean(patchKey) && !disabledReason,
      ...(disabledReason ? { disabledReason } : {}),
      patchKey,
      value: input.commonValues.fontFamily,
    };
  }

  if (input.controlId === 'font-size') {
    const patchKey = firstSupportedPatchKey(input.selectedNodes, FONT_SIZE_KEYS);
    return {
      inventory,
      visible: Boolean(patchKey),
      enabled: Boolean(patchKey) && !disabledReason,
      ...(disabledReason ? { disabledReason } : {}),
      patchKey,
      value: input.commonValues.fontSize,
    };
  }

  if (input.controlId === 'bold') {
    const patchKey = firstSupportedPatchKey(input.selectedNodes, BOLD_KEYS);
    return {
      inventory,
      visible: Boolean(patchKey),
      enabled: Boolean(patchKey) && !disabledReason,
      ...(disabledReason ? { disabledReason } : {}),
      patchKey,
      value: input.commonValues.bold,
    };
  }

  if (input.controlId === 'color') {
    const patchKey = firstSupportedPatchKey(input.selectedNodes, COLOR_KEYS);
    return {
      inventory,
      visible: Boolean(patchKey),
      enabled: Boolean(patchKey) && !disabledReason,
      ...(disabledReason ? { disabledReason } : {}),
      patchKey,
      value: input.commonValues.color,
    };
  }

  if (input.controlId === 'content') {
    const supportsContent = input.selectedNodes.some((node) => node.editMeta?.contentCarrier !== undefined);
    const canEditContent = input.selectedNodes.length === 1
      && Boolean(input.selectedNodes[0]?.editMeta)
      && input.selectedNodes[0]?.editMeta?.contentCarrier !== undefined;
    return {
      inventory,
      visible: canEditContent || (input.selectedNodes.length > 1 && supportsContent),
      enabled: canEditContent && !disabledReason,
      disabledReason: input.selectedNodes.length > 1
        ? 'MULTI_SELECTION_CONTENT'
        : disabledReason,
      value: input.activeTextValue,
    };
  }

  if (input.controlId === 'washi-preset') {
    const patchKey = firstSupportedPatchKey(input.selectedNodes, ['pattern']);
    const visible = patchKey === 'pattern' && input.selectedNodes.every((node) => node.nodeType === 'washi-tape');
    return {
      inventory,
      visible,
      enabled: visible && !disabledReason,
      ...(disabledReason ? { disabledReason } : {}),
      patchKey: visible ? 'pattern' : undefined,
      value: input.activePresetId,
    };
  }

  return {
    inventory,
    visible: false,
    enabled: false,
    disabledReason: 'CONTROL_UNSUPPORTED',
  };
}

export interface ResolveSelectionFloatingMenuModelInput {
  nodes: Node[];
  selectedNodeIds: string[];
  currentFile: string | null;
  runtimeState: EntrypointRuntimeState;
  pendingActionRoutingByKey?: Record<string, ActionRoutingPendingRecord>;
}

export function resolveSelectionFloatingMenuModel(
  input: ResolveSelectionFloatingMenuModelInput,
): SelectionFloatingMenuRenderModel {
  const selectedNodes = input.selectedNodeIds
    .map((nodeId) => input.nodes.find((node) => node.id === nodeId))
    .filter((node): node is Node => Boolean(node))
    .map((node) => resolveSelectedNode(node, input.currentFile));
  const selectedNodeIds = selectedNodes.map((node) => node.renderedNodeId);
  const nodeTypeSet = new Set(selectedNodes.map((node) => node.nodeType));
  const isHomogeneous = selectedNodes.length <= 1 || nodeTypeSet.size === 1;
  const hasPendingActions = hasPendingSelectionActions(
    selectedNodes,
    input.runtimeState,
    input.pendingActionRoutingByKey ?? {},
  );
  const isReadOnlySelection = selectedNodes.length > 0
    && selectedNodes.every((node) => Boolean(node.editMeta?.readOnlyReason));
  const fontFamilyValue = resolveCommonValue(selectedNodes, 'fontFamily');
  const fontSizeValue = resolveCommonValue(
    selectedNodes,
    firstSupportedPatchKey(selectedNodes, FONT_SIZE_KEYS),
  );
  const boldValue = resolveCommonValue(
    selectedNodes,
    firstSupportedPatchKey(selectedNodes, BOLD_KEYS),
  );
  const colorValue = resolveCommonValue(
    selectedNodes,
    firstSupportedPatchKey(selectedNodes, COLOR_KEYS),
  );
  const activePresetId = resolveWashiPresetId(selectedNodes);
  const controls = SELECTION_FLOATING_MENU_CONTROL_INVENTORY
    .map((item) => createControlState({
      controlId: item.controlId,
      selectedNodes,
      hasPendingActions,
      isReadOnlySelection,
      commonValues: {
        fontFamily: typeof fontFamilyValue === 'string' ? fontFamilyValue : null,
        fontSize: typeof fontSizeValue === 'string' || typeof fontSizeValue === 'number'
          ? fontSizeValue
          : null,
        bold: typeof boldValue === 'boolean' ? boldValue : null,
        color: typeof colorValue === 'string' ? colorValue : null,
        align: null,
      },
      activeTextValue: selectedNodes[0]?.label ?? '',
      activePresetId,
    }))
    .sort((left, right) => (left.inventory.order ?? 0) - (right.inventory.order ?? 0));
  const overflowControls = controls.filter(
    (control) => control.inventory.group === 'overflow' && control.visible,
  );
  const hasAnyInteractiveControl = controls.some((control) => (
    control.visible && control.inventory.controlId !== 'object-type' && control.inventory.controlId !== 'align'
  ));
  const primaryControls = controls.filter((control) => (
    control.inventory.group === 'primary'
    && (
      control.inventory.controlId === 'more'
        ? overflowControls.length > 0
        : control.visible
    )
  ));
  const hiddenReason = resolveHiddenReason({
    selectedNodes,
    isHomogeneous,
    hasAnyInteractiveControl,
  });

  return {
    visible: !hiddenReason,
    ...(hiddenReason ? { hiddenReason } : {}),
    summary: {
      selectedCount: selectedNodes.length,
      selectedNodeIds,
      selectedNodes,
      primaryNode: selectedNodes[0] ?? null,
      isHomogeneous,
      hasPendingActions,
      isReadOnlySelection,
      activeTextValue: selectedNodes[0]?.label ?? '',
      activePresetId,
      commonValues: {
        fontFamily: typeof fontFamilyValue === 'string' ? fontFamilyValue as never : null,
        fontSize: typeof fontSizeValue === 'string' || typeof fontSizeValue === 'number'
          ? fontSizeValue
          : null,
        bold: typeof boldValue === 'boolean' ? boldValue : null,
        color: typeof colorValue === 'string' ? colorValue : null,
        align: null,
      },
    },
    controls,
    primaryControls,
    overflowControls,
  };
}
