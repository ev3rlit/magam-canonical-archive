import { executeMutationBatch, type MutationBatch } from '@magam/shared';
import { withHeadlessContext } from '../headless/bootstrap';
import {
  getBooleanFlag,
  getOptionalStringFlag,
  parseCommandOptions,
  readJsonValue,
} from '../headless/options';
import type { ResourceCommandResult } from '../headless/json-output';
import { CLI_MESSAGES } from '../messages';

function normalizeMutationBatchInput(input: unknown): Partial<MutationBatch> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error(CLI_MESSAGES.command.mutationApplyInputMustBeJsonObject);
  }

  return input as Partial<MutationBatch>;
}

export async function runMutationCommand(args: string[]): Promise<ResourceCommandResult> {
  const subcommand = args[0];
  const parsed = parseCommandOptions(args.slice(1));

  switch (subcommand) {
    case 'apply':
      return withHeadlessContext({
        targetDir: getOptionalStringFlag(parsed, 'target-dir'),
        workspaceRef: getOptionalStringFlag(parsed, 'workspace'),
        canvasRef: getOptionalStringFlag(parsed, 'document'),
      }, async (context) => {
        const raw = await readJsonValue(getOptionalStringFlag(parsed, 'input') ?? '@stdin', 'mutation batch');
        const partial = normalizeMutationBatchInput(raw);
        const batch: MutationBatch = {
          workspaceRef: getOptionalStringFlag(parsed, 'workspace')
            ?? partial.workspaceRef
            ?? context.resolvedWorkspaceId
            ?? context.defaultWorkspaceId,
          ...(getOptionalStringFlag(parsed, 'document') || partial.canvasRef || context.resolvedCanvasId
            ? { canvasRef: getOptionalStringFlag(parsed, 'document') ?? partial.canvasRef ?? context.resolvedCanvasId }
            : {}),
          ...(partial.actor ? { actor: partial.actor } : {}),
          ...(getOptionalStringFlag(parsed, 'reason') || partial.reason
            ? { reason: getOptionalStringFlag(parsed, 'reason') ?? partial.reason }
            : {}),
          ...(partial.preconditions ? { preconditions: partial.preconditions } : {}),
          operations: Array.isArray(partial.operations) ? partial.operations : [],
        };

        return {
          data: await executeMutationBatch({
            context,
            batch,
            dryRun: getBooleanFlag(parsed, 'dry-run'),
          }),
          meta: {
            command: 'mutation.apply',
            workspaceId: batch.workspaceRef,
            ...(batch.canvasRef ? { canvasId: batch.canvasRef } : {}),
            dryRun: getBooleanFlag(parsed, 'dry-run'),
          },
        };
      });

    default:
      throw new Error(CLI_MESSAGES.command.unknownSubcommand('mutation', subcommand));
  }
}
