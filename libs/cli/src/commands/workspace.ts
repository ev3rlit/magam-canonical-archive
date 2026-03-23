import { getWorkspace, listWorkspaces } from '@magam/shared';
import { withHeadlessContext } from '../headless/bootstrap';
import { parseCommandOptions, getOptionalStringFlag } from '../headless/options';
import type { ResourceCommandResult } from '../headless/json-output';
import { CLI_MESSAGES } from '../messages';

export async function runWorkspaceCommand(args: string[]): Promise<ResourceCommandResult> {
  const subcommand = args[0];
  const parsed = parseCommandOptions(args.slice(1));

  switch (subcommand) {
    case 'list':
      return withHeadlessContext({
        targetDir: getOptionalStringFlag(parsed, 'target-dir'),
      }, async (context) => ({
        data: {
          items: await listWorkspaces(context),
          nextCursor: null,
        },
        meta: {
          command: 'workspace.list',
          targetDir: context.targetDir,
          dataDir: context.dataDir,
        },
      }));

    case 'get':
      return withHeadlessContext({
        targetDir: getOptionalStringFlag(parsed, 'target-dir'),
        workspaceRef: getOptionalStringFlag(parsed, 'workspace'),
        requireWorkspace: true,
      }, async (context) => ({
        data: await getWorkspace(context, context.resolvedWorkspaceId!),
        meta: {
          command: 'workspace.get',
          workspaceId: context.resolvedWorkspaceId,
          targetDir: context.targetDir,
          dataDir: context.dataDir,
        },
      }));

    default:
      throw new Error(CLI_MESSAGES.command.unknownSubcommand('workspace', subcommand));
  }
}
