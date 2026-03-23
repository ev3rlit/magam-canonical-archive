import { getSurface, querySurfaceNodes } from '@magam/shared';
import { withHeadlessContext } from '../headless/bootstrap';
import {
  getBoundsFlag,
  getOptionalNumberFlag,
  getOptionalStringFlag,
  getStringFlag,
  getStringListFlag,
  parseCommandOptions,
} from '../headless/options';
import type { ResourceCommandResult } from '../headless/json-output';
import { CLI_MESSAGES } from '../messages';

export async function runSurfaceCommand(args: string[]): Promise<ResourceCommandResult> {
  const subcommand = args[0];
  const parsed = parseCommandOptions(args.slice(1));

  switch (subcommand) {
    case 'get':
      return withHeadlessContext({
        targetDir: getOptionalStringFlag(parsed, 'target-dir'),
        canvasRef: getOptionalStringFlag(parsed, 'document'),
        requireDocument: true,
      }, async (context) => {
        const surfaceId = getStringFlag(parsed, 'surface');
        return {
          data: await getSurface(context, context.resolvedCanvasId!, surfaceId),
          meta: {
            command: 'surface.get',
            canvasId: context.resolvedCanvasId,
            surfaceId,
          },
        };
      });

    case 'query-nodes':
      return withHeadlessContext({
        targetDir: getOptionalStringFlag(parsed, 'target-dir'),
        canvasRef: getOptionalStringFlag(parsed, 'document'),
        requireDocument: true,
      }, async (context) => {
        const surfaceId = getStringFlag(parsed, 'surface');
        const page = await querySurfaceNodes(context, {
          canvasId: context.resolvedCanvasId!,
          surfaceId,
          workspaceId: getOptionalStringFlag(parsed, 'workspace'),
          bounds: getBoundsFlag(parsed),
          include: getStringListFlag(parsed, 'include'),
          limit: getOptionalNumberFlag(parsed, 'limit'),
          cursor: getOptionalStringFlag(parsed, 'cursor'),
        });

        return {
          data: page,
          meta: {
            command: 'surface.query-nodes',
            canvasId: context.resolvedCanvasId,
            surfaceId,
          },
        };
      });

    default:
      throw new Error(CLI_MESSAGES.command.unknownSubcommand('surface', subcommand));
  }
}
