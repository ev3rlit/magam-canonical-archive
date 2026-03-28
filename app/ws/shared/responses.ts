import type { RpcContext } from './params';

export interface CompatibilityMutationSuccess {
  success: boolean;
  newVersion: string;
  commandId: string;
  canvasId?: string;
  filePath: string;
  resolvedFilePath: string;
}

export function notifyCanvasChanged(
  ctx: RpcContext,
  payload: {
    canvasId: string;
    canvasRevision: number;
    originId: string;
    commandId: string;
    rootPath?: string;
  },
): void {
  ctx.notifyCanvasChanged?.(payload);
}

export function notifyFileChanged(
  ctx: RpcContext,
  payload: {
    canvasId?: string;
    filePath: string;
    resolvedFilePath: string;
    newVersion: string;
    originId: string;
    commandId: string;
    rootPath?: string;
    canvasRevision?: number;
  },
): void {
  ctx.notifyFileChanged?.(payload);
}

export function buildCompatibilityMutationSuccess(input: {
  canvasId?: string;
  filePath: string;
  resolvedFilePath: string;
  newVersion: string;
  commandId: string;
}): CompatibilityMutationSuccess {
  return {
    success: true,
    newVersion: input.newVersion,
    commandId: input.commandId,
    ...(input.canvasId ? { canvasId: input.canvasId } : {}),
    filePath: input.filePath,
    resolvedFilePath: input.resolvedFilePath,
  };
}
