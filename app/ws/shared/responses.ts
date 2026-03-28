import type { RpcContext } from './params';

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
