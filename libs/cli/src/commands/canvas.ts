import { getCanvas } from '@magam/shared';
import { withHeadlessContext } from '../headless/bootstrap';
import { parseCommandOptions, getOptionalStringFlag } from '../headless/options';
import type { ResourceCommandResult } from '../headless/json-output';

export async function runCanvasCommand(args: string[]): Promise<ResourceCommandResult> {
  const subcommand = args[0];
  const parsed = parseCommandOptions(args.slice(1));

  switch (subcommand) {
    case 'get':
      return withHeadlessContext({
        targetDir: getOptionalStringFlag(parsed, 'target-dir'),
        canvasRef: getOptionalStringFlag(parsed, 'canvas'),
        requireCanvas: true,
      }, async (context) => ({
        data: await getCanvas(context, context.resolvedCanvasId!),
        meta: {
          command: 'canvas.get',
          canvasId: context.resolvedCanvasId,
          targetDir: context.targetDir,
          dataDir: context.dataDir,
        },
      }));

    default:
      throw new Error(`Unknown canvas subcommand: ${subcommand ?? '(missing)'}`);
  }
}
