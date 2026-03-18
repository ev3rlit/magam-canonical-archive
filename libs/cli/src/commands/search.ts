import { searchDocuments, searchObjects } from '@magam/shared';
import { withHeadlessContext } from '../headless/bootstrap';
import {
  getOptionalNumberFlag,
  getOptionalStringFlag,
  getStringFlag,
  getStringListFlag,
  parseCommandOptions,
} from '../headless/options';
import type { ResourceCommandResult } from '../headless/json-output';

export async function runSearchCommand(args: string[]): Promise<ResourceCommandResult> {
  const subcommand = args[0];
  const parsed = parseCommandOptions(args.slice(1));

  switch (subcommand) {
    case 'objects':
      return withHeadlessContext({
        targetDir: getOptionalStringFlag(parsed, 'target-dir'),
        workspaceRef: getOptionalStringFlag(parsed, 'workspace'),
      }, async (context) => ({
        data: await searchObjects(context, {
          workspaceId: context.resolvedWorkspaceId ?? getOptionalStringFlag(parsed, 'workspace'),
          text: getStringFlag(parsed, 'text'),
          semanticRole: getOptionalStringFlag(parsed, 'semantic-role'),
          include: getStringListFlag(parsed, 'include'),
          limit: getOptionalNumberFlag(parsed, 'limit'),
          cursor: getOptionalStringFlag(parsed, 'cursor'),
        }),
        meta: {
          command: 'search.objects',
          workspaceId: context.resolvedWorkspaceId ?? getOptionalStringFlag(parsed, 'workspace') ?? context.defaultWorkspaceId,
        },
      }));

    case 'documents':
      return withHeadlessContext({
        targetDir: getOptionalStringFlag(parsed, 'target-dir'),
        workspaceRef: getOptionalStringFlag(parsed, 'workspace'),
      }, async (context) => ({
        data: await searchDocuments(context, {
          workspaceId: context.resolvedWorkspaceId ?? getOptionalStringFlag(parsed, 'workspace'),
          text: getStringFlag(parsed, 'text'),
          limit: getOptionalNumberFlag(parsed, 'limit'),
          cursor: getOptionalStringFlag(parsed, 'cursor'),
        }),
        meta: {
          command: 'search.documents',
          workspaceId: context.resolvedWorkspaceId ?? getOptionalStringFlag(parsed, 'workspace') ?? context.defaultWorkspaceId,
        },
      }));

    default:
      throw new Error(`Unknown search subcommand: ${subcommand ?? '(missing)'}`);
  }
}
