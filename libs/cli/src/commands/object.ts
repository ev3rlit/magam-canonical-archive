import {
  executeMutationBatch,
  getObject,
  normalizeCapabilityPatch,
  normalizeObjectContentPatch,
  queryObjects,
} from '@magam/shared';
import { withHeadlessContext } from '../headless/bootstrap';
import {
  getOptionalNumberFlag,
  getOptionalStringFlag,
  getStringFlag,
  getStringListFlag,
  parseCommandOptions,
  readJsonValue,
} from '../headless/options';
import type { ResourceCommandResult } from '../headless/json-output';

export async function runObjectCommand(args: string[]): Promise<ResourceCommandResult> {
  const subcommand = args[0];
  const parsed = parseCommandOptions(args.slice(1));

  switch (subcommand) {
    case 'get':
      return withHeadlessContext({
        targetDir: getOptionalStringFlag(parsed, 'target-dir'),
        workspaceRef: getOptionalStringFlag(parsed, 'workspace'),
        requireWorkspace: true,
      }, async (context) => {
        const objectId = getStringFlag(parsed, 'object');
        return {
          data: await getObject(context, {
            workspaceId: context.resolvedWorkspaceId!,
            objectId,
            include: getStringListFlag(parsed, 'include'),
          }),
          meta: {
            command: 'object.get',
            workspaceId: context.resolvedWorkspaceId,
            objectId,
          },
        };
      });

    case 'query':
      return withHeadlessContext({
        targetDir: getOptionalStringFlag(parsed, 'target-dir'),
        workspaceRef: getOptionalStringFlag(parsed, 'workspace'),
        requireWorkspace: true,
      }, async (context) => ({
        data: await queryObjects(context, {
          workspaceId: context.resolvedWorkspaceId!,
          semanticRole: getOptionalStringFlag(parsed, 'semantic-role'),
          contentKind: getOptionalStringFlag(parsed, 'content-kind'),
          hasCapability: getOptionalStringFlag(parsed, 'has-capability'),
          alias: getOptionalStringFlag(parsed, 'alias'),
          include: getStringListFlag(parsed, 'include'),
          limit: getOptionalNumberFlag(parsed, 'limit'),
          cursor: getOptionalStringFlag(parsed, 'cursor'),
        }),
        meta: {
          command: 'object.query',
          workspaceId: context.resolvedWorkspaceId,
        },
      }));

    case 'update-content':
      return withHeadlessContext({
        targetDir: getOptionalStringFlag(parsed, 'target-dir'),
        workspaceRef: getOptionalStringFlag(parsed, 'workspace'),
        requireWorkspace: true,
        canvasRef: getOptionalStringFlag(parsed, 'document'),
      }, async (context) => {
        const objectId = getStringFlag(parsed, 'object');
        const kind = getStringFlag(parsed, 'kind') as 'text' | 'markdown' | 'media' | 'sequence';
        const patch = normalizeObjectContentPatch(await readJsonValue(getStringFlag(parsed, 'patch'), 'object content patch'));
        return {
          data: await executeMutationBatch({
            context,
            batch: {
              workspaceRef: context.resolvedWorkspaceId!,
              ...(context.resolvedCanvasId ? { canvasRef: context.resolvedCanvasId } : {}),
              ...(getOptionalStringFlag(parsed, 'reason') ? { reason: getOptionalStringFlag(parsed, 'reason') } : {}),
              ...(getOptionalNumberFlag(parsed, 'revision') !== undefined
                ? { preconditions: { canvasRevision: getOptionalNumberFlag(parsed, 'revision') } }
                : {}),
              operations: [{
                op: 'object.content.update',
                objectId,
                kind,
                patch,
              }],
            },
            dryRun: false,
          }),
          meta: {
            command: 'object.update-content',
            workspaceId: context.resolvedWorkspaceId,
            ...(context.resolvedCanvasId ? { canvasId: context.resolvedCanvasId } : {}),
            objectId,
          },
        };
      });

    case 'patch-capability':
      return withHeadlessContext({
        targetDir: getOptionalStringFlag(parsed, 'target-dir'),
        workspaceRef: getOptionalStringFlag(parsed, 'workspace'),
        requireWorkspace: true,
        canvasRef: getOptionalStringFlag(parsed, 'document'),
      }, async (context) => {
        const objectId = getStringFlag(parsed, 'object');
        const capability = getStringFlag(parsed, 'capability');
        const patch = normalizeCapabilityPatch(
          capability,
          await readJsonValue(getStringFlag(parsed, 'patch'), 'capability patch'),
        );

        return {
          data: await executeMutationBatch({
            context,
            batch: {
              workspaceRef: context.resolvedWorkspaceId!,
              ...(context.resolvedCanvasId ? { canvasRef: context.resolvedCanvasId } : {}),
              ...(getOptionalStringFlag(parsed, 'reason') ? { reason: getOptionalStringFlag(parsed, 'reason') } : {}),
              ...(getOptionalNumberFlag(parsed, 'revision') !== undefined
                ? { preconditions: { canvasRevision: getOptionalNumberFlag(parsed, 'revision') } }
                : {}),
              operations: [{
                op: 'object.capability.patch',
                objectId,
                capability: capability as 'frame' | 'material' | 'texture' | 'attach' | 'ports' | 'bubble' | 'content',
                patch,
              }],
            },
            dryRun: false,
          }),
          meta: {
            command: 'object.patch-capability',
            workspaceId: context.resolvedWorkspaceId,
            ...(context.resolvedCanvasId ? { canvasId: context.resolvedCanvasId } : {}),
            objectId,
            capability,
          },
        };
      });

    default:
      throw new Error(`Unknown object subcommand: ${subcommand ?? '(missing)'}`);
  }
}
