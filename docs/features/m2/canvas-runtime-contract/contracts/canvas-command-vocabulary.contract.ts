// Public canvas runtime command vocabulary shared by UI, CLI, and other runtime consumers.
// This contract defines domain intents, not UI events and not raw DB patch shapes.

export type CanvasRuntimeCommandNameV1 =
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

export interface CanvasRuntimeCommandContractV1 {
  name: CanvasRuntimeCommandNameV1;
  target: 'canvas-node' | 'object';
  requiresCanvasRef: boolean;
  supportsDirectUiCommand: boolean;
  supportsCliDirectCommand: boolean;
  supportsBatchCommand: boolean;
  supportsDryRun: boolean;
  notes?: string[];
}

export const CANVAS_RUNTIME_COMMAND_VOCABULARY_V1: readonly CanvasRuntimeCommandContractV1[] = [
  {
    name: 'canvas.node.create',
    target: 'canvas-node',
    requiresCanvasRef: true,
    supportsDirectUiCommand: true,
    supportsCliDirectCommand: true,
    supportsBatchCommand: true,
    supportsDryRun: true,
    notes: [
      'Create stays domain-oriented and is expressed through placement modes.',
      'Public payload must not expose raw persistence row writes.',
    ],
  },
  {
    name: 'canvas.node.move',
    target: 'canvas-node',
    requiresCanvasRef: true,
    supportsDirectUiCommand: true,
    supportsCliDirectCommand: true,
    supportsBatchCommand: true,
    supportsDryRun: true,
  },
  {
    name: 'canvas.node.reparent',
    target: 'canvas-node',
    requiresCanvasRef: true,
    supportsDirectUiCommand: true,
    supportsCliDirectCommand: true,
    supportsBatchCommand: true,
    supportsDryRun: true,
  },
  {
    name: 'canvas.node.update',
    target: 'canvas-node',
    requiresCanvasRef: true,
    supportsDirectUiCommand: true,
    supportsCliDirectCommand: true,
    supportsBatchCommand: true,
    supportsDryRun: true,
    notes: [
      'Public payload may patch shell props/style only.',
      'Raw storage-path operators are not part of the contract.',
    ],
  },
  {
    name: 'canvas.node.rename',
    target: 'canvas-node',
    requiresCanvasRef: true,
    supportsDirectUiCommand: true,
    supportsCliDirectCommand: true,
    supportsBatchCommand: true,
    supportsDryRun: true,
  },
  {
    name: 'canvas.node.delete',
    target: 'canvas-node',
    requiresCanvasRef: true,
    supportsDirectUiCommand: true,
    supportsCliDirectCommand: true,
    supportsBatchCommand: true,
    supportsDryRun: true,
  },
  {
    name: 'canvas.node.z-order.update',
    target: 'canvas-node',
    requiresCanvasRef: true,
    supportsDirectUiCommand: true,
    supportsCliDirectCommand: true,
    supportsBatchCommand: true,
    supportsDryRun: true,
  },
  {
    name: 'object.content.update',
    target: 'object',
    requiresCanvasRef: false,
    supportsDirectUiCommand: true,
    supportsCliDirectCommand: true,
    supportsBatchCommand: true,
    supportsDryRun: true,
  },
  {
    name: 'object.capability.patch',
    target: 'object',
    requiresCanvasRef: false,
    supportsDirectUiCommand: true,
    supportsCliDirectCommand: true,
    supportsBatchCommand: true,
    supportsDryRun: true,
  },
  {
    name: 'object.body.block.insert',
    target: 'object',
    requiresCanvasRef: true,
    supportsDirectUiCommand: true,
    supportsCliDirectCommand: false,
    supportsBatchCommand: true,
    supportsDryRun: true,
    notes: [
      'Body block insert is part of the shared runtime command vocabulary even when direct CLI sugar is postponed.',
    ],
  },
] as const;
