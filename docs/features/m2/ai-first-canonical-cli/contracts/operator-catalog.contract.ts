// Canonical public operator catalog for AI-first bulk mutation payloads.
// Public operator names are domain-facing and must remain decoupled from raw persistence fields.

export type BulkMutationOperatorNameV1 =
  | '$createNode'
  | '$moveNode'
  | '$reparentNode'
  | '$updateNode'
  | '$renameNode'
  | '$deleteNode'
  | '$updateNodeZOrder'
  | '$updateObjectContent'
  | '$patchObjectCapability';

export interface OperatorContractV1 {
  name: BulkMutationOperatorNameV1;
  internalMutationOp:
    | 'canvas.node.create'
    | 'canvas.node.move'
    | 'canvas.node.reparent'
    | 'canvas.node.update'
    | 'canvas.node.rename'
    | 'canvas.node.delete'
    | 'canvas.node.z-order.update'
    | 'object.content.update'
    | 'object.capability.patch';
  target: 'canvas-node' | 'object';
  requiresCanvasRef: boolean;
  supportsDirectCommand: boolean;
  supportsBatchCommand: true;
  supportsDryRun: true;
  bulkReady: boolean;
  rawFieldPatchAllowed: false;
  notes?: string[];
}

export const OPERATOR_CATALOG_V1: readonly OperatorContractV1[] = [
  {
    name: '$createNode',
    internalMutationOp: 'canvas.node.create',
    target: 'canvas-node',
    requiresCanvasRef: true,
    supportsDirectCommand: true,
    supportsBatchCommand: true,
    supportsDryRun: true,
    bulkReady: true,
    rawFieldPatchAllowed: false,
    notes: [
      'Node creation stays domain-oriented and does not expose raw row layout writes.',
      'Placement is expressed through domain placement modes rather than persistence coordinates alone.',
    ],
  },
  {
    name: '$moveNode',
    internalMutationOp: 'canvas.node.move',
    target: 'canvas-node',
    requiresCanvasRef: true,
    supportsDirectCommand: true,
    supportsBatchCommand: true,
    supportsDryRun: true,
    bulkReady: true,
    rawFieldPatchAllowed: false,
  },
  {
    name: '$reparentNode',
    internalMutationOp: 'canvas.node.reparent',
    target: 'canvas-node',
    requiresCanvasRef: true,
    supportsDirectCommand: true,
    supportsBatchCommand: true,
    supportsDryRun: true,
    bulkReady: true,
    rawFieldPatchAllowed: false,
  },
  {
    name: '$updateNode',
    internalMutationOp: 'canvas.node.update',
    target: 'canvas-node',
    requiresCanvasRef: true,
    supportsDirectCommand: true,
    supportsBatchCommand: true,
    supportsDryRun: true,
    bulkReady: true,
    rawFieldPatchAllowed: false,
    notes: [
      'Public payload may patch props/style only.',
      'Public payload must not reference storage paths such as canvasNodes.<id>.props.<field>.',
    ],
  },
  {
    name: '$renameNode',
    internalMutationOp: 'canvas.node.rename',
    target: 'canvas-node',
    requiresCanvasRef: true,
    supportsDirectCommand: true,
    supportsBatchCommand: true,
    supportsDryRun: true,
    bulkReady: true,
    rawFieldPatchAllowed: false,
  },
  {
    name: '$deleteNode',
    internalMutationOp: 'canvas.node.delete',
    target: 'canvas-node',
    requiresCanvasRef: true,
    supportsDirectCommand: true,
    supportsBatchCommand: true,
    supportsDryRun: true,
    bulkReady: true,
    rawFieldPatchAllowed: false,
  },
  {
    name: '$updateNodeZOrder',
    internalMutationOp: 'canvas.node.z-order.update',
    target: 'canvas-node',
    requiresCanvasRef: true,
    supportsDirectCommand: true,
    supportsBatchCommand: true,
    supportsDryRun: true,
    bulkReady: true,
    rawFieldPatchAllowed: false,
  },
  {
    name: '$updateObjectContent',
    internalMutationOp: 'object.content.update',
    target: 'object',
    requiresCanvasRef: false,
    supportsDirectCommand: true,
    supportsBatchCommand: true,
    supportsDryRun: true,
    bulkReady: true,
    rawFieldPatchAllowed: false,
  },
  {
    name: '$patchObjectCapability',
    internalMutationOp: 'object.capability.patch',
    target: 'object',
    requiresCanvasRef: false,
    supportsDirectCommand: true,
    supportsBatchCommand: true,
    supportsDryRun: true,
    bulkReady: true,
    rawFieldPatchAllowed: false,
    notes: [
      'Capability patching remains domain-scoped.',
      'Generic $set/$unset over object capability field paths is not part of the public contract.',
    ],
  },
] as const;
