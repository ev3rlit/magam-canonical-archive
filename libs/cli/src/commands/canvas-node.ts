import { executeMutationBatch } from '@magam/shared';
import { withHeadlessContext } from '../headless/bootstrap';
import {
  getOptionalNumberFlag,
  getOptionalStringFlag,
  getStringFlag,
  parseCommandOptions,
} from '../headless/options';
import type { ResourceCommandResult } from '../headless/json-output';

export async function runCanvasNodeCommand(args: string[]): Promise<ResourceCommandResult> {
  const subcommand = args[0];
  const parsed = parseCommandOptions(args.slice(1));

  switch (subcommand) {
    case 'move':
      return withHeadlessContext({
        targetDir: getOptionalStringFlag(parsed, 'target-dir'),
        workspaceRef: getOptionalStringFlag(parsed, 'workspace'),
        documentRef: getOptionalStringFlag(parsed, 'document'),
        requireDocument: true,
      }, async (context) => {
        const nodeId = getStringFlag(parsed, 'node');
        const x = getOptionalNumberFlag(parsed, 'x');
        const y = getOptionalNumberFlag(parsed, 'y');
        if (x === undefined || y === undefined) {
          throw new Error('--x and --y are required for canvas-node move.');
        }

        return {
          data: await executeMutationBatch({
            context,
            batch: {
              workspaceRef: context.resolvedWorkspaceId ?? context.defaultWorkspaceId,
              documentRef: context.resolvedDocumentId!,
              ...(getOptionalStringFlag(parsed, 'reason') ? { reason: getOptionalStringFlag(parsed, 'reason') } : {}),
              ...(getOptionalNumberFlag(parsed, 'revision') !== undefined
                ? { preconditions: { documentRevision: getOptionalNumberFlag(parsed, 'revision') } }
                : {}),
              operations: [{
                op: 'canvas.node.move',
                nodeId,
                patch: { x, y },
              }],
            },
            dryRun: false,
          }),
          meta: {
            command: 'canvas-node.move',
            documentId: context.resolvedDocumentId,
            nodeId,
          },
        };
      });

    case 'reparent':
      return withHeadlessContext({
        targetDir: getOptionalStringFlag(parsed, 'target-dir'),
        workspaceRef: getOptionalStringFlag(parsed, 'workspace'),
        documentRef: getOptionalStringFlag(parsed, 'document'),
        requireDocument: true,
      }, async (context) => {
        const nodeId = getStringFlag(parsed, 'node');
        const parentNodeId = getOptionalStringFlag(parsed, 'parent') ?? null;

        return {
          data: await executeMutationBatch({
            context,
            batch: {
              workspaceRef: context.resolvedWorkspaceId ?? context.defaultWorkspaceId,
              documentRef: context.resolvedDocumentId!,
              ...(getOptionalStringFlag(parsed, 'reason') ? { reason: getOptionalStringFlag(parsed, 'reason') } : {}),
              ...(getOptionalNumberFlag(parsed, 'revision') !== undefined
                ? { preconditions: { documentRevision: getOptionalNumberFlag(parsed, 'revision') } }
                : {}),
              operations: [{
                op: 'canvas.node.reparent',
                nodeId,
                parentNodeId,
              }],
            },
            dryRun: false,
          }),
          meta: {
            command: 'canvas-node.reparent',
            documentId: context.resolvedDocumentId,
            nodeId,
            parentNodeId,
          },
        };
      });

    default:
      throw new Error(`Unknown canvas-node subcommand: ${subcommand ?? '(missing)'}`);
  }
}
