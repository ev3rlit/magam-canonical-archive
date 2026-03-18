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

export async function runSurfaceCommand(args: string[]): Promise<ResourceCommandResult> {
  const subcommand = args[0];
  const parsed = parseCommandOptions(args.slice(1));

  switch (subcommand) {
    case 'get':
      return withHeadlessContext({
        targetDir: getOptionalStringFlag(parsed, 'target-dir'),
        documentRef: getOptionalStringFlag(parsed, 'document'),
        requireDocument: true,
      }, async (context) => {
        const surfaceId = getStringFlag(parsed, 'surface');
        return {
          data: await getSurface(context, context.resolvedDocumentId!, surfaceId),
          meta: {
            command: 'surface.get',
            documentId: context.resolvedDocumentId,
            surfaceId,
          },
        };
      });

    case 'query-nodes':
      return withHeadlessContext({
        targetDir: getOptionalStringFlag(parsed, 'target-dir'),
        documentRef: getOptionalStringFlag(parsed, 'document'),
        requireDocument: true,
      }, async (context) => {
        const surfaceId = getStringFlag(parsed, 'surface');
        const page = await querySurfaceNodes(context, {
          documentId: context.resolvedDocumentId!,
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
            documentId: context.resolvedDocumentId,
            surfaceId,
          },
        };
      });

    default:
      throw new Error(`Unknown surface subcommand: ${subcommand ?? '(missing)'}`);
  }
}
