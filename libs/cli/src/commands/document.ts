import { getDocument } from '@magam/shared';
import { withHeadlessContext } from '../headless/bootstrap';
import { parseCommandOptions, getOptionalStringFlag } from '../headless/options';
import type { ResourceCommandResult } from '../headless/json-output';

export async function runDocumentCommand(args: string[]): Promise<ResourceCommandResult> {
  const subcommand = args[0];
  const parsed = parseCommandOptions(args.slice(1));

  switch (subcommand) {
    case 'get':
      return withHeadlessContext({
        targetDir: getOptionalStringFlag(parsed, 'target-dir'),
        documentRef: getOptionalStringFlag(parsed, 'document'),
        requireDocument: true,
      }, async (context) => ({
        data: await getDocument(context, context.resolvedDocumentId!),
        meta: {
          command: 'document.get',
          documentId: context.resolvedDocumentId,
          targetDir: context.targetDir,
          dataDir: context.dataDir,
        },
      }));

    default:
      throw new Error(`Unknown document subcommand: ${subcommand ?? '(missing)'}`);
  }
}
