// Canonical public operator catalog for batch mutation payloads in the canvas runtime contract.
// Operator names remain domain-facing and decoupled from storage paths.

export type CanvasRuntimeOperatorNameV1 =
  | '$createNode'
  | '$moveNode'
  | '$reparentNode'
  | '$updateNode'
  | '$renameNode'
  | '$deleteNode'
  | '$updateNodeZOrder'
  | '$updateObjectContent'
  | '$patchObjectCapability'
  | '$insertObjectBodyBlock';

export interface CanvasRuntimeOperatorContractV1 {
  name: CanvasRuntimeOperatorNameV1;
  internalCommandName:
    | 'canvas.node.create'
    | 'canvas.node.move'
    | 'canvas.node.reparent'
    | 'canvas.node.update'
    | 'canvas.node.rename'
    | 'canvas.node.delete'
    | 'canvas.node.z-order.update'
    | 'object.content.update'
    | 'object.capability.patch'
    | 'object.body.block.insert';
  target: 'canvas-node' | 'object';
  requiresCanvasRef: boolean;
  supportsBatchCommand: true;
  supportsDryRun: true;
  rawFieldPatchAllowed: false;
  notes?: string[];
}

export const CANVAS_RUNTIME_OPERATOR_CATALOG_V1: readonly CanvasRuntimeOperatorContractV1[] = [
  {
    name: '$createNode',
    internalCommandName: 'canvas.node.create',
    target: 'canvas-node',
    requiresCanvasRef: true,
    supportsBatchCommand: true,
    supportsDryRun: true,
    rawFieldPatchAllowed: false,
  },
  {
    name: '$moveNode',
    internalCommandName: 'canvas.node.move',
    target: 'canvas-node',
    requiresCanvasRef: true,
    supportsBatchCommand: true,
    supportsDryRun: true,
    rawFieldPatchAllowed: false,
  },
  {
    name: '$reparentNode',
    internalCommandName: 'canvas.node.reparent',
    target: 'canvas-node',
    requiresCanvasRef: true,
    supportsBatchCommand: true,
    supportsDryRun: true,
    rawFieldPatchAllowed: false,
  },
  {
    name: '$updateNode',
    internalCommandName: 'canvas.node.update',
    target: 'canvas-node',
    requiresCanvasRef: true,
    supportsBatchCommand: true,
    supportsDryRun: true,
    rawFieldPatchAllowed: false,
  },
  {
    name: '$renameNode',
    internalCommandName: 'canvas.node.rename',
    target: 'canvas-node',
    requiresCanvasRef: true,
    supportsBatchCommand: true,
    supportsDryRun: true,
    rawFieldPatchAllowed: false,
  },
  {
    name: '$deleteNode',
    internalCommandName: 'canvas.node.delete',
    target: 'canvas-node',
    requiresCanvasRef: true,
    supportsBatchCommand: true,
    supportsDryRun: true,
    rawFieldPatchAllowed: false,
  },
  {
    name: '$updateNodeZOrder',
    internalCommandName: 'canvas.node.z-order.update',
    target: 'canvas-node',
    requiresCanvasRef: true,
    supportsBatchCommand: true,
    supportsDryRun: true,
    rawFieldPatchAllowed: false,
  },
  {
    name: '$updateObjectContent',
    internalCommandName: 'object.content.update',
    target: 'object',
    requiresCanvasRef: false,
    supportsBatchCommand: true,
    supportsDryRun: true,
    rawFieldPatchAllowed: false,
  },
  {
    name: '$patchObjectCapability',
    internalCommandName: 'object.capability.patch',
    target: 'object',
    requiresCanvasRef: false,
    supportsBatchCommand: true,
    supportsDryRun: true,
    rawFieldPatchAllowed: false,
  },
  {
    name: '$insertObjectBodyBlock',
    internalCommandName: 'object.body.block.insert',
    target: 'object',
    requiresCanvasRef: true,
    supportsBatchCommand: true,
    supportsDryRun: true,
    rawFieldPatchAllowed: false,
  },
] as const;
